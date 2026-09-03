import { useMemo, useState } from "react";
import type { Project, GradeRow, PrismaFlow } from "../lib/project";
import { Card, Input, Pill, EmptyState, Button, Textarea } from "../components/ui";
import SankeyChart from "../components/charts/SankeyChart";
import OptionsDrawer from "../components/kokonut/OptionsDrawer";
import { ListChecks, Sparkles, Loader2 } from "lucide-react";
import { runGrade } from "../lib/project";
import { exportProject } from "../lib/api";
import DisclaimerModal from "../components/DisclaimerModal";
import { draftManuscriptSection } from "../lib/ai";

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
  const [grade, setGrade] = useState<GradeRow[] | null>((project.prisma.grade as any) || null);
  const [busy, setBusy] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [draftingSection, setDraftingSection] = useState<string | null>(null);
  const [manuscriptDrafts, setManuscriptDrafts] = useState<Record<string, string>>({});
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
      onChange({
        ...project,
        prisma: {
          ...project.prisma,
          grade: rows as any,
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDraftSection = async (section: 'introduction' | 'methods' | 'results' | 'discussion') => {
    setDraftingSection(section);
    try {
      const text = await draftManuscriptSection(
        { title: project.metadata.title, pico: project.pico, results: project.meta.results },
        section
      );
      setManuscriptDrafts({ ...manuscriptDrafts, [section]: text });
    } finally {
      setDraftingSection(null);
    }
  };

  const gradeTable = useMemo(() => grade ?? [], [grade]);

  // v0.5.3 — live PRISMA flow diagram (sankey) from the recorded numbers.
  const sankeyData = {
    nodes: [
      { name: "Records identified", category: "source" as const, value: flow.identified ?? 0 },
      { name: "Screened", category: "stage" as const, value: flow.screened ?? 0 },
      { name: "Full-text assessed", category: "stage" as const, value: flow.fullText ?? 0 },
      { name: "Studies included", category: "outcome" as const, value: flow.included ?? 0 },
    ],
    links: [
      { source: 0, target: 1, value: Math.max(flow.screened ?? 0, 1) },
      { source: 1, target: 2, value: Math.max(flow.fullText ?? 0, 1) },
      { source: 2, target: 3, value: Math.max(flow.included ?? 0, 1) },
    ],
  };

  return (
    <div className="space-y-3">
      {/* v0.5.3 — PRISMA flow diagram + options drawer */}
      <Card title="PRISMA 2020 flow diagram">
        <SankeyChart data={sankeyData} />
      </Card>

      <div className="flex justify-start">
        <OptionsDrawer
          closeText="Close"
          description="Tick off the 27 checklist items and edit the flow numbers in a focused panel."
          icon={ListChecks}
          title="Checklist & flow tools"
          trigger={<button className="btn-ghost rounded-full">Checklist options</button>}
        >
          <div className="space-y-1.5">
            {FLOW_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <span className="flex-1 text-[12px] text-[var(--color-text)]">{f.label}</span>
                <Input type="number" className="w-24" value={flow[f.key] ?? ""} onChange={(e) => setFlow(f.key, e.target.value)} />
              </div>
            ))}
            <p className="pt-2 text-[11px] text-[var(--color-text-muted)]">Checklist progress autosaves with the project.</p>
          </div>
        </OptionsDrawer>
      </div>

      <Card title="PRISMA 2020 flow" right={
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={autoGrade} disabled={busy || !project.meta.results}>Auto-GRADE</button>
          <button className="btn-primary" onClick={() => tryExport(project, () => setShowDisclaimer(true))}>Export report</button>
        </div>
      }>
        <div className="max-w-[460px] space-y-2">
          {FLOW_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="flex-1 text-[12.5px] text-[var(--color-text)]">{f.label}</span>
              <span className="w-32 text-right text-[10.5px] text-[var(--color-text-muted)]">{f.hint}</span>
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
              <span className="w-10 shrink-0 font-mono text-[10px] text-[var(--color-text-muted)]">{it.section}</span>
              <span className="w-6 shrink-0 text-right font-mono text-[10px] text-[var(--color-text-muted)]">{it.n}</span>
              <span className={`text-[12px] ${checklist[String(it.n)] ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text)]"}`}>{it.text}</span>
            </label>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">Tick items as your manuscript covers them — progress saves with the project.</div>
      </Card>

      <Card title="GRADE certainty of evidence">
        {gradeTable.length === 0 ? (
          <EmptyState>Run a meta-analysis, then <span className="text-[var(--color-text)]">Auto-GRADE</span> to build the evidence profile from your results + RoB.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="text-[var(--color-text-muted)]">
                <tr className="border-b border-[var(--color-border)]">
                  {["Outcome", "Studies", "RoB", "Incons.", "Indirect.", "Imprec.", "Pub bias", "Starting", "Final"].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gradeTable.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-1.5 text-[var(--color-text)]">{r.outcome}</td>
                    <td className="px-2 py-1.5 font-mono text-[var(--color-text-muted)]">{r.studies}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{r.risk_of_bias}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{r.inconsistency}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{r.indirectness}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{r.imprecision}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{r.publication_bias}</td>
                    <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{r.starting_certainty}</td>
                    <td className="px-2 py-1.5"><Pill tone={certTone(r.final_certainty)}>{r.final_certainty}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {gradeTable.some((r) => r.downgrade_reasons && r.downgrade_reasons !== "None") && (
                          <div className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                            Downgrades: {gradeTable.map((r) => `${r.outcome}: ${r.downgrade_reasons}`).join(" · ")}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>

                  <Card title="AI Manuscript drafting">
                    <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)]">
                      Generate draft sections for your systematic review manuscript. Edit the generated text as needed.
                    </p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {(['introduction', 'methods', 'results', 'discussion'] as const).map((section) => (
                        <Button
                          key={section}
                          variant="outline"
                          size="sm"
                          onClick={() => handleDraftSection(section)}
                          disabled={draftingSection === section}
                        >
                          {draftingSection === section ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {draftingSection === section ? "Drafting…" : `Draft ${section.charAt(0).toUpperCase() + section.slice(1)}`}
                        </Button>
                      ))}
                    </div>
                    {Object.entries(manuscriptDrafts).length > 0 && (
                      <div className="space-y-3">
                        {Object.entries(manuscriptDrafts).map(([section, text]) => (
                          <div key={section}>
                            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{section}</div>
                            <Textarea
                              rows={6}
                              value={text}
                              onChange={(e) => setManuscriptDrafts({ ...manuscriptDrafts, [section]: e.target.value })}
                            />
                          </div>
                        ))}
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
