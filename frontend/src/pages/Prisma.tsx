import { useMemo, useState } from "react";
import type { Project, GradeRow, PrismaFlow } from "../lib/project";
import { Card, Input, Pill, EmptyState } from "../components/ui";
import { runGrade } from "../lib/project";
import { exportProject } from "../lib/api";
import DisclaimerModal from "../components/DisclaimerModal";

// v0.5.1 — PRISMA 2020 27-item checklist tracker (item numbers per the official checklist)
const PRISMA_ITEMS: { n: number; section: string; text: string }[] = [
  { n: 1, section: "TITLE", text: "Identify the report as a systematic review" },
  { n: 2, section: "TITLE", text: "Data sources in the title/abstract" },
  { n: 3, section: "ABSTRACT", text: "Structured summary (PRISMA Abstract checklist)" },
  { n: 4, section: "INTRODUCTION", text: "Rationale in the context of existing knowledge" },
  { n: 5, section: "INTRODUCTION", text: "Objectives with PICO elements stated" },
  { n: 6, section: "METHODS", text: "Eligibility criteria defined" },
  { n: 7, section: "METHODS", text: "Information sources (databases, dates searched)" },
  { n: 8, section: "METHODS", text: "Full search strategy for at least one database" },
  { n: 9, section: "METHODS", text: "Process for selecting studies described" },
  { n: 10, section: "METHODS", text: "Data extraction process described" },
  { n: 11, section: "METHODS", text: "Risk-of-bias assessment process per outcome" },
  { n: 12, section: "METHODS", text: "Effect measures specified" },
  { n: 13, section: "METHODS", text: "Synthesis methods described" },
  { n: 14, section: "METHODS", text: "Assessment of reporting biases planned" },
  { n: 15, section: "METHODS", text: "Certainty assessment method (GRADE)" },
  { n: 16, section: "RESULTS", text: "Study selection flow (numbers + citations)" },
  { n: 17, section: "RESULTS", text: "Study characteristics presented" },
  { n: 18, section: "RESULTS", text: "Risk of bias within studies reported" },
  { n: 19, section: "RESULTS", text: "Results of individual studies / syntheses" },
  { n: 20, section: "RESULTS", text: "Reporting biases examined" },
  { n: 21, section: "RESULTS", text: "Certainty of evidence per outcome" },
  { n: 22, section: "DISCUSSION", text: "Interpretation consistent with evidence" },
  { n: 23, section: "DISCUSSION", text: "Limitations of the evidence discussed" },
  { n: 24, section: "DISCUSSION", text: "Limitations of the review processes" },
  { n: 25, section: "DISCUSSION", text: "Implications for practice and research" },
  { n: 26, section: "OTHER", text: "Registration & protocol stated" },
  { n: 27, section: "OTHER", text: "Support, competing interests, data availability" },
];

const FLOW_FIELDS: { key: keyof PrismaFlow; label: string; hint: string }[] = [
  { key: "identified", label: "Records identified", hint: "databases + registers" },
  { key: "duplicates", label: "Duplicates removed", hint: "−" },
  { key: "screened", label: "Records screened", hint: "title / abstract" },
  { key: "excludedTa", label: "Excluded (title/abstract)", hint: "−" },
  { key: "fullText", label: "Full-text assessed", hint: "retrieved" },
  { key: "excludedFt", label: "Excluded (full text)", hint: "−" },
  { key: "included", label: "Studies included", hint: "in synthesis" },
];

async function tryExport(project: Project, onDone: () => void) {
  try {
    await exportProject(project, "docx");
    onDone();
  } catch (e) {
    console.error(e);
  }
}

export default function Prisma({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const flow = project.prisma.flow;
  const [grade, setGrade] = useState<GradeRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  // v0.5.1 — checklist state lives on the project (auto-saved): prisma.checklist[itemNumber]=true
  type Checklist = Record<string, boolean>;
  const checklist = ((project.prisma as unknown as { checklist?: Checklist }).checklist ?? {}) as Checklist;
  const setItem = (n: number, done: boolean) =>
    onChange({
      ...project,
      prisma: { ...project.prisma, ...( { checklist: { ...checklist, [String(n)]: done } } as object) },
    });
  const doneCount = PRISMA_ITEMS.filter((i) => checklist[String(i.n)]).length;

  const setFlow = (key: keyof PrismaFlow, v: string) =>
    onChange({ ...project, prisma: { ...project.prisma, flow: { ...flow, [key]: v === "" ? null : Number(v) } } });

  const autoGrade = async () => {
    setBusy(true);
    try {
      const meta = project.meta.results;
      const rob = project.rob.assessments.map((a) => ({ overall: a.overall === "—" ? undefined : a.overall }));
      const outcomes = project.pico.outcomes
        .split(/[;\n,]/).map((s) => s.trim()).filter(Boolean)
        .map((o) => ({ outcome: o, studies: project.extraction.studies.length, design: "RCT" }));
      const rows = await runGrade({ outcomes: outcomes.length ? outcomes : [{ outcome: "Primary outcome", studies: project.extraction.studies.length, design: "RCT" }], meta, rob });
      setGrade(rows);
    } finally {
      setBusy(false);
    }
  };

  const gradeTable = useMemo(() => grade ?? [], [grade]);

  return (
    <div className="space-y-3">
      <Card title="PRISMA 2020 flow" right={
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={autoGrade} disabled={busy || !project.meta.results}>Auto-GRADE</button>
          <button className="btn-primary" onClick={() => tryExport(project, () => setShowDisclaimer(true))}>Export report</button>
        </div>
      }>
        <div className="max-w-[460px] space-y-2">
          {FLOW_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="flex-1 text-[12.5px] text-[#e6e7ea]">{f.label}</span>
              <span className="w-32 text-right text-[10.5px] text-[#8b8d96]">{f.hint}</span>
              <Input type="number" className="w-24" value={flow[f.key] ?? ""} onChange={(e) => setFlow(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </Card>

      <Card title={`PRISMA 2020 checklist — ${doneCount}/27 complete`}>
        <div className="max-h-64 overflow-y-auto rounded-[3px] border border-[var(--color-border)]">
          {PRISMA_ITEMS.map((it) => (
            <label key={it.n} className="flex cursor-pointer items-center gap-2.5 border-b border-[var(--color-border)] px-2.5 py-1.5 last:border-0 hover:bg-white/[0.03]">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[#e6e7ea]"
                checked={!!checklist[String(it.n)]}
                onChange={(e) => setItem(it.n, e.target.checked)}
              />
              <span className="w-10 shrink-0 font-mono text-[10px] text-[#8b8d96]">{it.section}</span>
              <span className="w-6 shrink-0 text-right font-mono text-[10px] text-[#8b8d96]">{it.n}</span>
              <span className={`text-[12px] ${checklist[String(it.n)] ? "text-[#8b8d96] line-through" : "text-[#e6e7ea]"}`}>{it.text}</span>
            </label>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-[#8b8d96]">Tick items as your manuscript covers them — progress saves with the project.</div>
      </Card>

      <Card title="GRADE certainty of evidence">
        {gradeTable.length === 0 ? (
          <EmptyState>Run a meta-analysis, then <span className="text-[#e6e7ea]">Auto-GRADE</span> to build the evidence profile from your results + RoB.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="text-[#8b8d96]">
                <tr className="border-b border-[var(--color-border)]">
                  {["Outcome", "Studies", "RoB", "Incons.", "Indirect.", "Imprec.", "Pub bias", "Starting", "Final"].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gradeTable.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-1.5 text-[#e6e7ea]">{r.outcome}</td>
                    <td className="px-2 py-1.5 font-mono text-[#8b8d96]">{r.studies}</td>
                    <td className="px-2 py-1.5 text-[#8b8d96]">{r.risk_of_bias}</td>
                    <td className="px-2 py-1.5 text-[#8b8d96]">{r.inconsistency}</td>
                    <td className="px-2 py-1.5 text-[#8b8d96]">{r.indirectness}</td>
                    <td className="px-2 py-1.5 text-[#8b8d96]">{r.imprecision}</td>
                    <td className="px-2 py-1.5 text-[#8b8d96]">{r.publication_bias}</td>
                    <td className="px-2 py-1.5 text-[#8b8d96]">{r.starting_certainty}</td>
                    <td className="px-2 py-1.5"><Pill tone={certTone(r.final_certainty)}>{r.final_certainty}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {gradeTable.some((r) => r.downgrade_reasons && r.downgrade_reasons !== "None") && (
              <div className="mt-2 text-[11px] text-[#8b8d96]">
                Downgrades: {gradeTable.map((r) => `${r.outcome}: ${r.downgrade_reasons}`).join(" · ")}
              </div>
            )}
          </div>
        )}
      </Card>

      {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
    </div>
  );
}

function certTone(c: string): "include" | "unsure" | "exclude" | "neutral" {
  if (c === "High") return "include";
  if (c === "Moderate") return "unsure";
  if (c === "Low" || c === "Very Low") return "exclude";
  return "neutral";
}
