import { useState } from "react";
import type { Project, ExtractedStudy } from "../lib/project";
import { Card, Input, Select, Pill, EmptyState, Button, Textarea } from "../components/ui";
import { toCsv, downloadText } from "../lib/project";
import { Sparkles, Loader2 } from "lucide-react";

const TYPES: ExtractedStudy["type"][] = ["binary", "continuous", "survival"];

function blank(): ExtractedStudy {
  return { study: "", type: "binary", int_events: null, int_n: null, ctrl_events: null, ctrl_n: null, int_mean: null, int_sd: null, ctrl_mean: null, ctrl_sd: null, hr: null, hr_lower: null, hr_upper: null, subgroup: "", design: "", year: null };
}

export default function Extraction({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const studies = project.extraction.studies;
  const [form, setForm] = useState<ExtractedStudy>(blank());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfText, setPdfText] = useState("");

  const set = (patch: Partial<ExtractedStudy>) => setForm({ ...form, ...patch });
  const num = (v: string) => (v === "" ? null : Number(v));

  const add = () => {
    if (!form.study.trim()) { setErr("Study name required"); return; }
    setErr(null);
    onChange({ ...project, extraction: { studies: [...studies, { ...form, study: form.study.trim() }] }, meta: { ...project.meta, settings: { ...project.meta.settings, data: [...studies, form] } } });
    setForm(blank());
  };

  const remove = (i: number) => {
    const next = studies.filter((_, idx) => idx !== i);
    onChange({ ...project, extraction: { studies: next }, meta: { ...project.meta, settings: { ...project.meta.settings, data: next } } });
  };

  const extractFromPDF = async () => {
    if (!pdfText.trim()) return;
    setBusy(true);
    try {
      const providers = JSON.parse(localStorage.getItem("poolr.aiProviders") || "[]");
      const activeProviders = providers.filter((p: any) => p.enabled && p.apiKey);
      const useProvider = activeProviders.length > 0 ? activeProviders[0] : {
        baseUrl: "https://openrouter.ai/api/v1",
        model: "auto",
        apiKey: "",
      };

      const messages = [
        {
          role: "system",
          content: 'You are a data extraction assistant for systematic reviews. Given the full-text of a study, extract the following fields and return ONLY a JSON object: {"study": "short study name (Author Year)", "type": "binary|continuous|survival", "int_events": number|null, "int_n": number|null, "ctrl_events": number|null, "ctrl_n": number|null, "int_mean": number|null, "int_sd": number|null, "ctrl_mean": number|null, "ctrl_sd": number|null, "hr": number|null, "hr_lower": number|null, "hr_upper": number|null, "subgroup": "", "design": "RCT|cohort|etc", "year": number|null}. If a field is not reported, use null.',
        },
        { role: "user", content: `Extract data from this study:\n\n${pdfText.slice(0, 8000)}` },
      ];

      const res = await fetch(`${useProvider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${useProvider.apiKey}` },
        body: JSON.stringify({ model: useProvider.model, messages, temperature: 0.1, max_tokens: 1024 }),
      });

      if (res.ok) {
        const data = await res.json();
        try {
          const parsed = JSON.parse(data.choices[0].message.content);
          setForm({
            study: parsed.study || "",
            type: parsed.type || "binary",
            int_events: parsed.int_events ?? null,
            int_n: parsed.int_n ?? null,
            ctrl_events: parsed.ctrl_events ?? null,
            ctrl_n: parsed.ctrl_n ?? null,
            int_mean: parsed.int_mean ?? null,
            int_sd: parsed.int_sd ?? null,
            ctrl_mean: parsed.ctrl_mean ?? null,
            ctrl_sd: parsed.ctrl_sd ?? null,
            hr: parsed.hr ?? null,
            hr_lower: parsed.hr_lower ?? null,
            hr_upper: parsed.hr_upper ?? null,
            subgroup: parsed.subgroup || "",
            design: parsed.design || "",
            year: parsed.year ?? null,
          });
        } catch {
          // If parsing fails, just fill the study name
          setForm({ ...form, study: data.choices[0].message.content.slice(0, 100) });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const rows = studies.map((s) => ({
      study: s.study, type: s.type,
      int_events: s.int_events ?? "", int_n: s.int_n ?? "", ctrl_events: s.ctrl_events ?? "", ctrl_n: s.ctrl_n ?? "",
      int_mean: s.int_mean ?? "", int_sd: s.int_sd ?? "", ctrl_mean: s.ctrl_mean ?? "", ctrl_sd: s.ctrl_sd ?? "",
      hr: s.hr ?? "", hr_lower: s.hr_lower ?? "", hr_upper: s.hr_upper ?? "",
      subgroup: s.subgroup ?? "", design: s.design ?? "", year: s.year ?? "",
    }));
    downloadText("poolr_extraction.csv", toCsv(rows), "text/csv");
  };

  return (
    <div className="space-y-3">
      <Card title="Data extraction" right={
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{studies.length} studies</Pill>
          <button className="btn-primary" onClick={exportCsv} disabled={!studies.length}>Export CSV</button>
        </div>
      }>
        {studies.length === 0 ? (
          <EmptyState>No studies extracted yet. Add one below — it will also populate the Meta-Analysis data table.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="text-[var(--color-text-muted)]">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-2 py-1.5 text-left font-medium">Study</th>
                  <th className="px-2 py-1.5 text-left font-medium">Type</th>
                  <th className="px-2 py-1.5 text-left font-medium">Interv. (ev/n)</th>
                  <th className="px-2 py-1.5 text-left font-medium">Control (ev/n)</th>
                  <th className="px-2 py-1.5 text-left font-medium">HR (lo–hi)</th>
                  <th className="px-2 py-1.5 text-left font-medium">Subgroup</th>
                  <th className="px-2 py-1.5 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {studies.map((s, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-1.5 text-[var(--color-text)]">{s.study}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{s.type}</td>
                    <td className="px-2 py-1.5 font-mono text-[var(--color-text)]">{s.int_events ?? "—"}/{s.int_n ?? "—"}</td>
                    <td className="px-2 py-1.5 font-mono text-[var(--color-text)]">{s.ctrl_events ?? "—"}/{s.ctrl_n ?? "—"}</td>
                    <td className="px-2 py-1.5 font-mono text-[var(--color-text)]">{s.hr ?? "—"}{s.hr != null ? ` (${s.hr_lower ?? "?"}-${s.hr_upper ?? "?"})` : ""}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{s.subgroup || "—"}</td>
                    <td className="px-2 py-1.5"><button className="btn-ghost" onClick={() => remove(i)}>remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Add study" right={
              <Button
                variant="outline"
                size="sm"
                onClick={extractFromPDF}
                disabled={busy || !pdfText.trim()}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {busy ? "Extracting…" : "Extract from PDF"}
              </Button>
            }>
              <div className="mb-3">
                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Paste full-text for AI extraction</div>
                <Textarea rows={3} value={pdfText} onChange={(e) => setPdfText(e.target.value)} placeholder="Paste the full-text of a study here, then click 'Extract from PDF' to auto-fill the fields below." />
              </div>
              {err && <div className="mb-2 text-[12px] text-[var(--color-exclude)]">{err}</div>}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Field label="Study name"><Input value={form.study} onChange={(e) => set({ study: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={form.type} onChange={(e) => set({ type: e.target.value as ExtractedStudy["type"] })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Subgroup"><Input value={form.subgroup ?? ""} onChange={(e) => set({ subgroup: e.target.value })} /></Field>
          <Field label="Design"><Input value={form.design ?? ""} onChange={(e) => set({ design: e.target.value })} placeholder="RCT / cohort" /></Field>

          {form.type === "binary" && (
            <>
              <Field label="Int. events"><Input type="number" value={form.int_events ?? ""} onChange={(e) => set({ int_events: num(e.target.value) })} /></Field>
              <Field label="Int. n"><Input type="number" value={form.int_n ?? ""} onChange={(e) => set({ int_n: num(e.target.value) })} /></Field>
              <Field label="Ctrl events"><Input type="number" value={form.ctrl_events ?? ""} onChange={(e) => set({ ctrl_events: num(e.target.value) })} /></Field>
              <Field label="Ctrl n"><Input type="number" value={form.ctrl_n ?? ""} onChange={(e) => set({ ctrl_n: num(e.target.value) })} /></Field>
            </>
          )}
          {form.type === "continuous" && (
            <>
              <Field label="Int. mean"><Input type="number" step="any" value={form.int_mean ?? ""} onChange={(e) => set({ int_mean: num(e.target.value) })} /></Field>
              <Field label="Int. SD"><Input type="number" step="any" value={form.int_sd ?? ""} onChange={(e) => set({ int_sd: num(e.target.value) })} /></Field>
              <Field label="Ctrl mean"><Input type="number" step="any" value={form.ctrl_mean ?? ""} onChange={(e) => set({ ctrl_mean: num(e.target.value) })} /></Field>
              <Field label="Ctrl SD"><Input type="number" step="any" value={form.ctrl_sd ?? ""} onChange={(e) => set({ ctrl_sd: num(e.target.value) })} /></Field>
            </>
          )}
          {form.type === "survival" && (
            <>
              <Field label="HR"><Input type="number" step="any" value={form.hr ?? ""} onChange={(e) => set({ hr: num(e.target.value) })} /></Field>
              <Field label="HR lower"><Input type="number" step="any" value={form.hr_lower ?? ""} onChange={(e) => set({ hr_lower: num(e.target.value) })} /></Field>
              <Field label="HR upper"><Input type="number" step="any" value={form.hr_upper ?? ""} onChange={(e) => set({ hr_upper: num(e.target.value) })} /></Field>
            </>
          )}
          <Field label="Year"><Input type="number" value={form.year ?? ""} onChange={(e) => set({ year: num(e.target.value) })} /></Field>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button className="btn-primary" onClick={add}>+ Add to table</button>
          <span className="text-[11px] text-[var(--color-text-muted)]">Studies flow automatically into Meta-Analysis → Run.</span>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      {children}
    </div>
  );
}
