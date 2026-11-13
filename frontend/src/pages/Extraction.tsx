import { useEffect, useRef, useState } from "react";
import type { Project, ExtractedStudy } from "../lib/project";
import { Card, Input, Select, Pill, EmptyState, Button } from "../components/ui";
import { toCsv, downloadText, findLinkedCitation, linkCitationToExtractedStudy, parseMetricSelection } from "../lib/project";
import { callAI, getActiveProviders, type AIMessage } from "../lib/ai";
import { validateStudyData } from "../lib/meta";
import { Sparkles, Loader2, Calculator, FileUp, Download, UserCheck, ShieldAlert, ExternalLink } from "lucide-react";
import EffectSizeCalculator from "../components/EffectSizeCalculator";
import { StepCommentsButton } from "../components/StepCommentsDrawer";
import { openExternalUrl } from "../lib/api";
import { getBuiltInTemplates } from "../lib/extraction-templates";
import StudySourceViewer from "../components/StudySourceViewer";

const TYPES: ExtractedStudy["type"][] = ["binary", "continuous", "survival", "proportion", "rate", "correlation", "generic"];

function blank(): ExtractedStudy {
  return { study: "", type: "binary", int_events: null, int_n: null, ctrl_events: null, ctrl_n: null, int_mean: null, int_sd: null, ctrl_mean: null, ctrl_sd: null, hr: null, hr_lower: null, hr_upper: null, subgroup: "", design: "", year: null };
}

export default function Extraction({ project, onChange, focusStudy }: { project: Project; onChange: (p: Project) => void; focusStudy?: string }) {
  const studies = project.extraction.studies;
  const [form, setForm] = useState<ExtractedStudy>(blank());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfText, setPdfText] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusStudy) return;
    const match = project.extraction.studies.find(
      (s) => s.study.trim().toLowerCase() === focusStudy.trim().toLowerCase()
    );
    if (match) {
      setForm({ ...match });
      const cit = findLinkedCitation(project, match);
      if (cit?.abstract) setPdfText(cit.abstract);
    }
  }, [focusStudy, project]);

  const set = (patch: Partial<ExtractedStudy>) => setForm({ ...form, ...patch });
  const num = (v: string) => (v === "" ? null : Number(v));

  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const importStudiesFromScreening = () => {
    const ftIncluded = (project.screening?.full_text ?? []).filter((s) => s.decision === "include");
    const taIncluded = (project.screening?.title_abstract ?? []).filter((s) => s.decision === "include");
    const source = ftIncluded.length > 0 ? ftIncluded : taIncluded;

    if (source.length === 0) {
      setNotice("No studies marked as 'Include' in screening yet. Screen some records first.");
      return;
    }

    const existingIds = new Set(studies.map((s) => s.sourceId).filter(Boolean));
    const existingNames = new Set(studies.map((s) => s.study.toLowerCase().trim()));
    const newStudies: ExtractedStudy[] = [];

    for (const item of source) {
      const candidate = linkCitationToExtractedStudy(item);
      if ((candidate.sourceId && existingIds.has(candidate.sourceId)) || existingNames.has(candidate.study.toLowerCase())) {
        continue;
      }
      if (candidate.sourceId) existingIds.add(candidate.sourceId);
      existingNames.add(candidate.study.toLowerCase());
      newStudies.push({
        ...candidate,
        int_events: null,
        int_n: null,
        ctrl_events: null,
        ctrl_n: null,
        int_mean: null,
        int_sd: null,
        ctrl_mean: null,
        ctrl_sd: null,
        hr: null,
        hr_lower: null,
        hr_upper: null,
        subgroup: "",
        design: "RCT",
      });
    }

    if (newStudies.length === 0) {
      setNotice("All included screening studies are already in the extraction table.");
      return;
    }

    const next = [...studies, ...newStudies];
    onChange({
      ...project,
      extraction: { studies: next },
      meta: { ...project.meta, settings: { ...project.meta.settings, data: next } },
    });
    setNotice(`Synced ${newStudies.length} ${ftIncluded.length > 0 ? "full-text" : "title/abstract"} included stud${newStudies.length === 1 ? "y" : "ies"} with linked citations.`);
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      const sep = lines[0].includes("\t") ? "\t" : ",";
      const headers = lines[0].split(sep).map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

      const parsedStudies: ExtractedStudy[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map((c) => c.replace(/^["']|["']$/g, "").trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });

        const study = row.study || row.author || row.name || row.title || `Study ${studies.length + parsedStudies.length + 1}`;
        const typeStr = (row.type || "").toLowerCase();
        const type: ExtractedStudy["type"] =
          typeStr.includes("cont") ? "continuous"
            : typeStr.includes("surv") ? "survival"
            : typeStr.includes("prop") ? "proportion"
            : typeStr.includes("rate") ? "rate"
            : typeStr.includes("corr") ? "correlation"
            : typeStr.includes("gen") ? "generic"
            : "binary";

        const toNum = (val: string | undefined) => {
          if (!val || val === "—" || val === "NA") return null;
          const n = Number(val);
          return isNaN(n) ? null : n;
        };

        parsedStudies.push({
          study,
          type,
          int_events: toNum(row.int_events || row.events_int || row.events1 || row.e1 || row.a),
          int_n: toNum(row.int_n || row.n_int || row.n1 || row.total1),
          ctrl_events: toNum(row.ctrl_events || row.events_ctrl || row.events2 || row.e2 || row.c),
          ctrl_n: toNum(row.ctrl_n || row.n_ctrl || row.n2 || row.total2),
          int_mean: toNum(row.int_mean || row.mean_int || row.m1 || row.mean1),
          int_sd: toNum(row.int_sd || row.sd_int || row.sd1),
          ctrl_mean: toNum(row.ctrl_mean || row.mean_ctrl || row.m2 || row.mean2),
          ctrl_sd: toNum(row.ctrl_sd || row.sd_ctrl || row.sd2),
          hr: toNum(row.hr || row.hazard_ratio),
          hr_lower: toNum(row.hr_lower || row.hr_ci_lower || row.ci_lower),
          hr_upper: toNum(row.hr_upper || row.hr_ci_upper || row.ci_upper),
          subgroup: row.subgroup || "",
          design: row.design || "",
          year: toNum(row.year),
        });
      }

      if (parsedStudies.length > 0) {
        const next = [...studies, ...parsedStudies];
        onChange({
          ...project,
          extraction: { studies: next },
          meta: { ...project.meta, settings: { ...project.meta.settings, data: next } },
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const add = () => {
    if (!form.study.trim()) { setErr("Study name required"); return; }
    setErr(null);
    const next = [...studies, { ...form, study: form.study.trim() }];
    onChange({ ...project, extraction: { studies: next }, meta: { ...project.meta, settings: { ...project.meta.settings, data: next } } });
    setForm(blank());
  };

  const remove = (i: number) => {
    setConfirmDelete(i);
  };

  const confirmRemove = () => {
    if (confirmDelete == null) return;
    const next = studies.filter((_, idx) => idx !== confirmDelete);
    onChange({ ...project, extraction: { studies: next }, meta: { ...project.meta, settings: { ...project.meta.settings, data: next } } });
    setConfirmDelete(null);
  };

  const extractFromPDF = async () => {
    if (!pdfText.trim()) return;
    setBusy(true);
    try {
      const provider = getActiveProviders()[0];
      if (!provider) throw new Error("Configure an AI provider in Settings before extracting study data.");
      const messages: AIMessage[] = [
        {
          role: "system",
          content: 'You are a data extraction assistant for systematic reviews. Given the full-text of a study, extract the following fields and return ONLY a JSON object: {"study": "short study name (Author Year)", "type": "binary|continuous|survival", "int_events": number|null, "int_n": number|null, "ctrl_events": number|null, "ctrl_n": number|null, "int_mean": number|null, "int_sd": number|null, "ctrl_mean": number|null, "ctrl_sd": number|null, "hr": number|null, "hr_lower": number|null, "hr_upper": number|null, "subgroup": "", "design": "RCT|cohort|etc", "year": number|null}. If a field is not reported, use null.',
        },
        { role: "user", content: `Extract data from this study:\n\n${pdfText.slice(0, 8000)}` },
      ];

      const response = await callAI(provider, messages);
      const parsed = JSON.parse(response.content);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || typeof parsed.study !== "string") {
        throw new Error("The provider returned an invalid study record.");
      }
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
    } catch (error) {
      setNotice(error instanceof SyntaxError ? "The AI provider returned invalid JSON." :
        error instanceof Error ? error.message : "AI extraction failed.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const rows = studies.map((s) => ({
      study: s.study, type: s.type, sourceId: s.sourceId ?? "",
      authors: s.authors ?? "", doi: s.doi ?? "", pmid: s.pmid ?? "",
      int_events: s.int_events ?? "", int_n: s.int_n ?? "", ctrl_events: s.ctrl_events ?? "", ctrl_n: s.ctrl_n ?? "",
      int_mean: s.int_mean ?? "", int_sd: s.int_sd ?? "", ctrl_mean: s.ctrl_mean ?? "", ctrl_sd: s.ctrl_sd ?? "",
      hr: s.hr ?? "", hr_lower: s.hr_lower ?? "", hr_upper: s.hr_upper ?? "",
      aux_time_int: s.aux_time_int ?? "", aux_time_ctrl: s.aux_time_ctrl ?? "",
      correlation: s.correlation ?? "", n_total: s.n_total ?? "",
      effect_size: s.effect_size ?? "", effect_se: s.effect_se ?? "",
      subgroup: s.subgroup ?? "", design: s.design ?? "", year: s.year ?? "",
    }));
    downloadText("poolr_extraction.csv", toCsv(rows), "text/csv");
  };

  return (
    <div className="space-y-3">
      {notice && (
        <div className="flex items-start gap-2 rounded-[3px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2.5 py-1.5 text-[12px] text-[var(--color-text)]">
          <span className="flex-1">{notice}</span>
          <button className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
      {confirmDelete != null && (
        <div className="flex items-center gap-2 rounded-[3px] border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">
          <span className="flex-1">Remove "{studies[confirmDelete]?.study ?? 'this study'}"?</span>
          <button className="shrink-0 rounded border border-[var(--color-exclude)]/50 px-2 py-0.5 text-[var(--color-exclude)] hover:bg-[var(--color-exclude)]/20" onClick={confirmRemove}>Remove</button>
          <button className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" onClick={() => setConfirmDelete(null)}>Cancel</button>
        </div>
      )}
      <Card title="Study Manager &amp; Data Extraction" right={
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral">{studies.length} studies</Pill>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleCsvFile}
          />
          <Button variant="outline" size="sm" onClick={importStudiesFromScreening} title="Import studies included during screening (Full-Text priority)">
            <UserCheck className="h-3.5 w-3.5 mr-1" />
            Sync from Screening
          </Button>
          <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()} title="Import dataset from CSV or TSV">
            <FileUp className="h-3.5 w-3.5 mr-1" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!studies.length} title="Export dataset to CSV">
            <Download className="h-3.5 w-3.5 mr-1" />
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowValidation(!showValidation)} title="Toggle data validation panel">
            <ShieldAlert className="h-3.5 w-3.5 mr-1" />
            {showValidation ? 'Hide' : 'Show'} Validation
          </Button>
          <StepCommentsButton step="extraction" stepTitle="Data Extraction" />
        </div>
      }>
        {studies.length === 0 ? (
          <EmptyState>No studies in Study Manager yet. Add one below, click <strong className="text-[var(--color-text)]">Sync from Screening</strong>, or upload a CSV dataset — all 7 effect types flow automatically into Meta-Analysis &amp; RoB.</EmptyState>
        ) : (
          <div tabIndex={0} role="region" aria-label="Included studies extraction table" className="overflow-auto max-h-[380px]">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-10 bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-2 py-1.5 text-left font-medium">Study (Citation &amp; RoB)</th>
                  <th className="px-2 py-1.5 text-left font-medium">Type</th>
                  <th className="px-2 py-1.5 text-left font-medium">Primary / Effect Summary</th>
                  <th className="px-2 py-1.5 text-left font-medium">Comparator / Precision</th>
                  <th className="px-2 py-1.5 text-left font-medium">Subgroup</th>
                  <th className="px-2 py-1.5 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studies.map((s, i) => (
                  <StudyTableRow
                    key={`${s.sourceId ?? s.study}_${i}`}
                    study={s}
                    index={i}
                    project={project}
                    onEdit={() => setForm({ ...s })}
                    onUpdate={(updated) => {
                      const next = studies.map((x, idx) => (idx === i ? updated : x));
                      onChange({ ...project, extraction: { studies: next } });
                    }}
                    onRemove={() => remove(i)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showValidation && studies.length > 0 && (
          <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Data Quality Report</div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {studies.map((s, i) => {
                const issues = validateStudyData(s as any);
                return issues.length > 0 ? (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-[var(--color-exclude)] mt-0.5">●</span>
                    <span className="text-[var(--color-text)]"><strong className="text-[var(--color-text-muted)]">{s.study || `Study ${i+1}`}</strong>: {issues.join('; ')}</span>
                  </div>
                ) : null;
              })}
              {studies.every(s => validateStudyData(s as any).length === 0) && (
                <div className="text-[11px] text-[var(--color-include)]">All {studies.length} studies pass data validation.</div>
              )}
            </div>
          </div>
        )}
      </Card>

      <StudyDossierWorkbench
        project={project}
        onChange={onChange}
        form={form}
        set={set}
        setForm={setForm}
        add={add}
        showCalculator={showCalculator}
        setShowCalculator={setShowCalculator}
        pdfText={pdfText}
        setPdfText={setPdfText}
        extractFromPDF={extractFromPDF}
        busy={busy}
        err={err}
      />
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

function summarizeStudy(s: ExtractedStudy): { primary: string; secondary: string } {
  switch (s.type) {
    case "continuous":
      return {
        primary: `${s.int_mean ?? "—"} ± ${s.int_sd ?? "—"} (n=${s.int_n ?? "—"})`,
        secondary: `${s.ctrl_mean ?? "—"} ± ${s.ctrl_sd ?? "—"} (n=${s.ctrl_n ?? "—"})`,
      };
    case "survival":
      return {
        primary: `HR ${s.hr ?? "—"}`,
        secondary: s.hr_lower != null && s.hr_upper != null ? `[${s.hr_lower}–${s.hr_upper}]` : "—",
      };
    case "proportion":
      return {
        primary: `${s.int_events ?? "—"}/${s.int_n ?? "—"}`,
        secondary: s.int_events != null && s.int_n ? `${((s.int_events / s.int_n) * 100).toFixed(1)}%` : "—",
      };
    case "rate":
      return {
        primary: `${s.int_events ?? "—"} / ${s.aux_time_int ?? "—"} PY`,
        secondary: `${s.ctrl_events ?? "—"} / ${s.aux_time_ctrl ?? "—"} PY`,
      };
    case "correlation":
      return {
        primary: `r = ${s.correlation ?? "—"}`,
        secondary: `N = ${s.n_total ?? "—"}`,
      };
    case "generic":
      return {
        primary: `θ = ${s.effect_size ?? "—"}`,
        secondary: `SE = ${s.effect_se ?? "—"}`,
      };
    default:
      return {
        primary: `${s.int_events ?? "—"}/${s.int_n ?? "—"}`,
        secondary: `${s.ctrl_events ?? "—"}/${s.ctrl_n ?? "—"}`,
      };
  }
}

function StudyTableRow({
  study,
  index,
  project,
  onEdit,
  onUpdate,
  onRemove,
}: {
  study: ExtractedStudy;
  index: number;
  project: Project;
  onEdit: () => void;
  onUpdate: (next: ExtractedStudy) => void;
  onRemove: () => void;
}) {
  const linked = findLinkedCitation(project, { sourceId: study.sourceId, study: study.study, doi: study.doi, pmid: study.pmid });
  const rob = project.rob.assessments.find(
    (a) => (study.sourceId && a.sourceId === study.sourceId) || a.study.trim().toLowerCase() === study.study.trim().toLowerCase()
  );
  const summary = summarizeStudy(study);
  const go = (p: string) => window.dispatchEvent(new CustomEvent("poolr:gopage", { detail: p }));

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--hover-surface)]">
      <td className="px-2 py-2 align-top">
        <div className="font-medium text-[var(--color-text)]">{study.study}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10.5px] text-[var(--color-text-muted)]">
          {study.year && <span>{study.year}</span>}
          {linked && <Pill tone="accent">Linked</Pill>}
          {rob && (
            <Pill tone={rob.overall === "Low" ? "include" : rob.overall === "High" || rob.overall === "Critical" ? "exclude" : "unsure"}>
              RoB: {rob.overall}
            </Pill>
          )}
          {(linked?.pdfUrl || linked?.url || study.doi || linked?.doi) && (
            <button
              type="button"
              className="underline hover:text-[var(--color-text)]"
              onClick={() => void openExternalUrl(linked?.pdfUrl || linked?.url || `https://doi.org/${study.doi || linked?.doi}`)}
            >
              source ↗
            </button>
          )}
        </div>
      </td>
      <td className="px-2 py-2 align-top text-[var(--color-text-muted)]">{study.type}</td>
      <td className="px-2 py-2 align-top font-mono text-[var(--color-text)]">{summary.primary}</td>
      <td className="px-2 py-2 align-top font-mono text-[var(--color-text)]">{summary.secondary}</td>
      <td className="px-2 py-2 align-top text-[var(--color-text-muted)]">
        <input
          aria-label={`Subgroup for ${study.study || index}`}
          className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-[11.5px] hover:border-[var(--color-border)] focus:border-[var(--color-border-strong)] focus:bg-[var(--input-bg)]"
          value={study.subgroup ?? ""}
          placeholder="—"
          onChange={(e) => onUpdate({ ...study, subgroup: e.target.value })}
        />
      </td>
      <td className="px-2 py-2 align-top whitespace-nowrap">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost text-[11px]" onClick={onEdit}>load/edit</button>
          <button type="button" className="btn-ghost text-[11px]" onClick={() => go("rob")}>{rob ? "RoB" : "+RoB"}</button>
          <button type="button" className="btn-ghost text-[11px]" onClick={onRemove}>remove</button>
        </div>
      </td>
    </tr>
  );
}

function StudyDossierWorkbench({
  project,
  onChange,
  form,
  set,
  setForm,
  add,
  showCalculator,
  setShowCalculator,
  pdfText,
  setPdfText,
  extractFromPDF,
  busy,
  err,
}: {
  project: Project;
  onChange: (p: Project) => void;
  form: ExtractedStudy;
  set: (patch: Partial<ExtractedStudy>) => void;
  setForm: (next: ExtractedStudy) => void;
  add: () => void;
  showCalculator: boolean;
  setShowCalculator: (v: boolean) => void;
  pdfText: string;
  setPdfText: (v: string) => void;
  extractFromPDF: () => void;
  busy: boolean;
  err: string | null;
}) {
  const [templateId, setTemplateId] = useState("");
  const [showWan, setShowWan] = useState(false);
  const [wan, setWan] = useState({ q1: "", median: "", q3: "", n: "", arm: "int" as "int" | "ctrl" });
  const templates = getBuiltInTemplates();
  const activeTemplate = templates.find((t) => t.id === templateId) ?? null;

  const existingIndex = project.extraction.studies.findIndex(
    (s) => (form.sourceId && s.sourceId === form.sourceId) || (form.study.trim() && s.study.trim().toLowerCase() === form.study.trim().toLowerCase())
  );
  const linked = findLinkedCitation(project, { sourceId: form.sourceId, study: form.study, doi: form.doi, pmid: form.pmid });
  const includedPool = [
    ...(project.screening?.full_text ?? []).filter((i) => i.decision === "include"),
    ...(project.screening?.title_abstract ?? []).filter((i) => i.decision === "include"),
  ];

  const num = (v: string) => (v === "" ? null : Number(v));

  // Wan et al. (2014) BMC Med Res Methodol 14:135 estimator for mean & SD from median & IQR
  const applyWan = () => {
    const q1 = parseFloat(wan.q1);
    const med = parseFloat(wan.median);
    const q3 = parseFloat(wan.q3);
    const n = parseFloat(wan.n);
    if (!Number.isFinite(q1) || !Number.isFinite(med) || !Number.isFinite(q3) || q3 < q1) return;
    const meanEst = Number(((q1 + med + q3) / 3).toFixed(4));
    const sdEst = Number(((q3 - q1) / 1.35).toFixed(4));
    if (wan.arm === "int") {
      set({ type: "continuous", int_mean: meanEst, int_sd: sdEst, ...(Number.isFinite(n) && n > 0 ? { int_n: n } : {}) });
    } else {
      set({ type: "continuous", ctrl_mean: meanEst, ctrl_sd: sdEst, ...(Number.isFinite(n) && n > 0 ? { ctrl_n: n } : {}) });
    }
    setShowWan(false);
  };

  const saveUpdate = () => {
    if (existingIndex < 0) {
      add();
      return;
    }
    const next = project.extraction.studies.map((s, idx) => (idx === existingIndex ? { ...form } : s));
    onChange({
      ...project,
      extraction: { studies: next },
      meta: { ...project.meta, settings: { ...project.meta.settings, data: next as any } },
    });
  };

  return (
    <Card
      title={existingIndex >= 0 ? `Study Dossier Editor — ${form.study}` : "Add / Extract Study"}
      right={
        <div className="flex flex-wrap items-center gap-2">
          {includedPool.length > 0 && (
            <select
              aria-label="Load linked citation"
              className="rounded-[4px] border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-1 text-[11.5px] text-[var(--color-text)]"
              value={form.sourceId ?? ""}
              onChange={(e) => {
                const picked = includedPool.find((i) => i.id === e.target.value);
                if (!picked) return;
                setForm({ ...linkCitationToExtractedStudy(picked, form.type) });
                if (picked.abstract && !pdfText) setPdfText(picked.abstract);
              }}
            >
              <option value="">Link included citation…</option>
              {includedPool.map((i) => (
                <option key={i.id} value={i.id}>{i.title.slice(0, 56)}</option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowWan((v) => !v)} title="Convert Median & IQR to Mean & SD (Wan 2014)">
            Median/IQR → Mean/SD
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCalculator(!showCalculator)} title="Effect size calculator">
            <Calculator className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={extractFromPDF} disabled={busy || !(pdfText.trim() || linked?.abstract?.trim())}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {busy ? "Extracting…" : "AI Extract"}
          </Button>
        </div>
      }
    >
      {linked && (
        <div className="mb-3 rounded-[4px] border border-[var(--color-border)] bg-[var(--input-bg)] p-2.5 text-[11.5px]">
          <div className="flex flex-wrap items-center justify-between gap-2 font-medium text-[var(--color-text)]">
            <span>{linked.title}</span>
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
              {linked.authors && <span>{linked.authors}</span>}
              {linked.year && <span>({linked.year})</span>}
              {(linked.pdfUrl || linked.url || linked.doi) && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[var(--color-include)] underline"
                  onClick={() => void openExternalUrl(linked.pdfUrl || linked.url || `https://doi.org/${linked.doi}`)}
                >
                  Open full text <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          {linked.abstract && (
            <p className="mt-1.5 max-h-24 overflow-y-auto text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              {linked.abstract}
            </p>
          )}
        </div>
      )}

      {showWan && (
        <div className="mb-3 rounded-[4px] border border-[var(--color-border)] bg-[var(--input-bg)] p-3 text-[12px]">
          <div className="mb-2 font-semibold">Median &amp; IQR → Mean &amp; SD (Wan et al., 2014)</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <Select value={wan.arm} onChange={(e) => setWan({ ...wan, arm: e.target.value as "int" | "ctrl" })}>
              <option value="int">Intervention</option>
              <option value="ctrl">Control</option>
            </Select>
            <Input type="number" step="any" placeholder="Q1" value={wan.q1} onChange={(e) => setWan({ ...wan, q1: e.target.value })} />
            <Input type="number" step="any" placeholder="Median" value={wan.median} onChange={(e) => setWan({ ...wan, median: e.target.value })} />
            <Input type="number" step="any" placeholder="Q3" value={wan.q3} onChange={(e) => setWan({ ...wan, q3: e.target.value })} />
            <Input type="number" placeholder="N" value={wan.n} onChange={(e) => setWan({ ...wan, n: e.target.value })} />
            <Button size="sm" onClick={applyWan}>Apply Mean/SD</Button>
          </div>
        </div>
      )}

      {showCalculator && (
        <div className="mb-3">
          <EffectSizeCalculator
            onCalculate={(result) => {
              const se = Math.abs(result.ci_upper - result.ci_lower) / 3.92;
              set({
                type: "generic",
                effect_size: Number(result.effect.toFixed(4)),
                effect_se: Number(Math.max(1e-4, se).toFixed(4)),
              });
              setShowCalculator(false);
            }}
          />
        </div>
      )}

      <div className="mb-3">
        <StudySourceViewer
          citation={linked}
          text={pdfText}
          onTextChange={setPdfText}
          provenance={form.provenance}
          onClearProvenance={(key) => {
            const nextProv = { ...(form.provenance ?? {}) };
            delete nextProv[key];
            set({ provenance: nextProv });
          }}
          targets={[
            {
              key: "int_arm",
              label: "Int. Arm",
              onAssign: (quote) => {
                const parsed = parseMetricSelection(quote);
                const nextProv = { ...(form.provenance ?? {}), int_arm: quote };
                if (parsed?.kind === "binary") {
                  set({ type: "binary", int_events: parsed.events ?? null, int_n: parsed.n ?? null, provenance: nextProv });
                } else if (parsed?.kind === "continuous") {
                  set({ type: "continuous", int_mean: parsed.mean ?? null, int_sd: parsed.sd ?? null, provenance: nextProv });
                } else if (parsed?.kind === "scalar") {
                  set({ int_n: parsed.value ?? null, provenance: nextProv });
                } else {
                  set({ provenance: nextProv });
                }
              },
            },
            {
              key: "ctrl_arm",
              label: "Ctrl. Arm",
              onAssign: (quote) => {
                const parsed = parseMetricSelection(quote);
                const nextProv = { ...(form.provenance ?? {}), ctrl_arm: quote };
                if (parsed?.kind === "binary") {
                  set({ type: "binary", ctrl_events: parsed.events ?? null, ctrl_n: parsed.n ?? null, provenance: nextProv });
                } else if (parsed?.kind === "continuous") {
                  set({ type: "continuous", ctrl_mean: parsed.mean ?? null, ctrl_sd: parsed.sd ?? null, provenance: nextProv });
                } else if (parsed?.kind === "scalar") {
                  set({ ctrl_n: parsed.value ?? null, provenance: nextProv });
                } else {
                  set({ provenance: nextProv });
                }
              },
            },
            {
              key: "effect",
              label: "HR / Effect",
              onAssign: (quote) => {
                const parsed = parseMetricSelection(quote);
                const nextProv = { ...(form.provenance ?? {}), effect: quote };
                if (parsed?.kind === "ratio") {
                  set({ type: "survival", hr: parsed.effect ?? null, hr_lower: parsed.ci_lower ?? null, hr_upper: parsed.ci_upper ?? null, provenance: nextProv });
                } else if (parsed?.kind === "scalar") {
                  set({ type: "generic", effect_size: parsed.value ?? null, provenance: nextProv });
                } else {
                  set({ provenance: nextProv });
                }
              },
            },
            {
              key: "design",
              label: "Design / Subgroup",
              onAssign: (quote) => {
                set({ design: quote.slice(0, 60), provenance: { ...(form.provenance ?? {}), design: quote } });
              },
            },
          ]}
          placeholder="Paste results paragraph/table, load abstract, or attach a study PDF — then highlight text to assign values & audit provenance…"
        />
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
            <Field label="Int. n"><Input type="number" value={form.int_n ?? ""} onChange={(e) => set({ int_n: num(e.target.value) })} /></Field>
            <Field label="Ctrl mean"><Input type="number" step="any" value={form.ctrl_mean ?? ""} onChange={(e) => set({ ctrl_mean: num(e.target.value) })} /></Field>
            <Field label="Ctrl SD"><Input type="number" step="any" value={form.ctrl_sd ?? ""} onChange={(e) => set({ ctrl_sd: num(e.target.value) })} /></Field>
            <Field label="Ctrl n"><Input type="number" value={form.ctrl_n ?? ""} onChange={(e) => set({ ctrl_n: num(e.target.value) })} /></Field>
          </>
        )}
        {form.type === "survival" && (
          <>
            <Field label="HR"><Input type="number" step="any" value={form.hr ?? ""} onChange={(e) => set({ hr: num(e.target.value) })} /></Field>
            <Field label="HR lower"><Input type="number" step="any" value={form.hr_lower ?? ""} onChange={(e) => set({ hr_lower: num(e.target.value) })} /></Field>
            <Field label="HR upper"><Input type="number" step="any" value={form.hr_upper ?? ""} onChange={(e) => set({ hr_upper: num(e.target.value) })} /></Field>
          </>
        )}
        {form.type === "proportion" && (
          <>
            <Field label="Events (r)"><Input type="number" value={form.int_events ?? ""} onChange={(e) => set({ int_events: num(e.target.value) })} /></Field>
            <Field label="Total (N)"><Input type="number" value={form.int_n ?? ""} onChange={(e) => set({ int_n: num(e.target.value) })} /></Field>
          </>
        )}
        {form.type === "rate" && (
          <>
            <Field label="Int. events"><Input type="number" value={form.int_events ?? ""} onChange={(e) => set({ int_events: num(e.target.value) })} /></Field>
            <Field label="Int. person-time"><Input type="number" step="any" value={form.aux_time_int ?? ""} onChange={(e) => set({ aux_time_int: num(e.target.value) })} /></Field>
            <Field label="Ctrl events"><Input type="number" value={form.ctrl_events ?? ""} onChange={(e) => set({ ctrl_events: num(e.target.value) })} /></Field>
            <Field label="Ctrl person-time"><Input type="number" step="any" value={form.aux_time_ctrl ?? ""} onChange={(e) => set({ aux_time_ctrl: num(e.target.value) })} /></Field>
          </>
        )}
        {form.type === "correlation" && (
          <>
            <Field label="Correlation (r)"><Input type="number" step="any" value={form.correlation ?? ""} onChange={(e) => set({ correlation: num(e.target.value) })} /></Field>
            <Field label="Total N"><Input type="number" value={form.n_total ?? ""} onChange={(e) => set({ n_total: num(e.target.value) })} /></Field>
          </>
        )}
        {form.type === "generic" && (
          <>
            <Field label="Effect (log/MD/SMD)"><Input type="number" step="any" value={form.effect_size ?? ""} onChange={(e) => set({ effect_size: num(e.target.value) })} /></Field>
            <Field label="Standard Error (SE)"><Input type="number" step="any" value={form.effect_se ?? ""} onChange={(e) => set({ effect_se: num(e.target.value) })} /></Field>
          </>
        )}
        <Field label="Year"><Input type="number" value={form.year ?? ""} onChange={(e) => set({ year: num(e.target.value) })} /></Field>
      </div>

      {/* Structured Cochrane / JBI / QUADAS-2 template extension */}
      <details className="mt-3 rounded-[4px] border border-[var(--color-border)] bg-[var(--input-bg)] p-2.5">
        <summary className="cursor-pointer text-[11.5px] font-medium text-[var(--color-text)]">
          Structured Extraction Template Fields (Cochrane RCT / JBI Observational / QUADAS-2)
        </summary>
        <div className="mt-2.5 space-y-2.5">
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Choose a structured template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.fields.length} fields</option>)}
          </Select>
          {activeTemplate && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeTemplate.fields.slice(0, 12).map((f) => {
                const val = form.customFields?.[f.id] ?? "";
                const updateField = (nextVal: string | number | boolean) =>
                  set({ customFields: { ...(form.customFields ?? {}), [f.id]: nextVal } });
                return (
                  <Field key={f.id} label={f.label}>
                    {f.type === "select" && f.options ? (
                      <Select value={String(val)} onChange={(e) => updateField(e.target.value)}>
                        <option value="">Select…</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </Select>
                    ) : (
                      <Input
                        type={f.type === "number" ? "number" : "text"}
                        value={String(val)}
                        onChange={(e) => updateField(f.type === "number" ? Number(e.target.value) : e.target.value)}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          )}
        </div>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={saveUpdate}>
          {existingIndex >= 0 ? "Save study changes" : "+ Add to table"}
        </button>
        {existingIndex >= 0 && (
          <button type="button" className="btn-ghost" onClick={() => setForm({ study: "", type: "binary" })}>
            Clear editor
          </button>
        )}
        <span className="text-[11px] text-[var(--color-text-muted)]">Studies flow automatically into Meta-Analysis, Hubs &amp; Risk of Bias.</span>
      </div>
    </Card>
  );
}
