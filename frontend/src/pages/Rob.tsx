import { useEffect, useState } from "react";
import { findLinkedCitation, type Project, type RobAssessment } from "../lib/project";
import { Card, Select, Pill, EmptyState, Button, Input } from "../components/ui";
import { RadarChart } from "../components/charts/radar-chart";
import { RadarGrid } from "../components/charts/radar-grid";
import { RadarAxis } from "../components/charts/radar-axis";
import { RadarLabels } from "../components/charts/radar-labels";
import { RadarArea } from "../components/charts/radar-area";
import { suggestRoB } from "../lib/ai";
import { fetchRobFigure, openExternalUrl } from "../lib/api";
import { downloadText } from "../lib/project";
import { Sparkles, Loader2, Download, RefreshCw, ExternalLink, Highlighter } from "lucide-react";
import { StepCommentsButton } from "../components/StepCommentsDrawer";
import StudySourceViewer from "../components/StudySourceViewer";

const TOOLS = ["RoB2", "NOS", "PROBAST", "ROBINS-I", "QUADAS-2", "AMSTAR-2"] as const;
const OVERALL = ["Low", "Some concerns", "High", "Critical", "—"] as const;

const DOMAINS: Record<(typeof TOOLS)[number], string[]> = {
  RoB2: ["Randomization", "Deviations from intended", "Missing outcome", "Measurement of outcome", "Selection of reported result"],
  NOS: ["Selection", "Comparability", "Exposure / Outcome"],
  PROBAST: ["Participants", "Predictors", "Outcome", "Analysis"],
  "ROBINS-I": ["Confounding", "Selection of participants", "Classification of interventions", "Deviations from intended interventions", "Missing data", "Measurement of outcomes", "Selection of reported result"],
  "QUADAS-2": ["Patient selection", "Index test", "Reference standard", "Flow and timing"],
  "AMSTAR-2": ["Protocol a priori", "Comprehensive literature search", "Study selection in duplicate", "Data extraction in duplicate", "Excluded studies listed", "Risk of bias assessed", "Publication bias assessed", "Certainty of evidence reported"],
};

function blank(study: string, tool: (typeof TOOLS)[number], sourceId?: string): RobAssessment {
  const domains: Record<string, string> = {};
  for (const d of DOMAINS[tool]) domains[d] = "Low";
  return {
    id: `r${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    study,
    ...(sourceId ? { sourceId } : {}),
    tool,
    overall: "—",
    domains,
  };
}

export default function Rob({ project, onChange, focusStudy }: { project: Project; onChange: (p: Project) => void; focusStudy?: string }) {
  const list = project.rob.assessments;
  const studyNames = Array.from(new Set([
    ...project.extraction.studies.map((s) => s.study),
    ...list.map((a) => a.study),
  ])).filter(Boolean);
  const [tool, setTool] = useState<(typeof TOOLS)[number]>("RoB2");
  const [notice, setNotice] = useState("");
  const [busyDomain, setBusyDomain] = useState<string | null>(null);
  const [abstracts, setAbstracts] = useState<Record<string, string>>({});
  const [openSourceId, setOpenSourceId] = useState<string | null>(null);
  const [vizTab, setVizTab] = useState<"traffic" | "summary" | "radar">("traffic");
  const [robSvg, setRobSvg] = useState<string | null>(null);
  const [svgLoading, setSvgLoading] = useState(false);

  useEffect(() => {
    if (!focusStudy) return;
    const hit = project.rob.assessments.find(
      (a) => a.study.trim().toLowerCase() === focusStudy.trim().toLowerCase()
    );
    if (hit) setOpenSourceId(hit.id);
  }, [focusStudy, project.rob.assessments]);

  useEffect(() => {
    if (vizTab === "radar" || list.length === 0) return;
    const forTool = list.filter((a) => a.tool === tool);
    if (forTool.length === 0) {
      setRobSvg(null);
      return;
    }
    const domains = DOMAINS[tool];
    const studies = forTool.map((a) => a.study);
    const judgements = forTool.map((a) => domains.map((d) => a.domains[d] ?? "Low"));
    setSvgLoading(true);
    fetchRobFigure({ studies, domains, judgements }, vizTab)
      .then((svg) => setRobSvg(svg))
      .catch((e) => {
        console.error("Failed to fetch RoB figure", e);
        setRobSvg(null);
      })
      .finally(() => setSvgLoading(false));
  }, [vizTab, list, tool]);

  const add = () => {
    const first = project.extraction.studies[0];
    const name = first?.study || studyNames[0] || "New study";
    onChange({ ...project, rob: { assessments: [...list, blank(name, tool, first?.sourceId)] } });
  };

  const syncFromExtraction = () => {
    const existingByStudy = new Set(list.map((a) => a.study.trim().toLowerCase()));
    const existingSourceIds = new Set(list.map((a) => a.sourceId).filter(Boolean) as string[]);
    const missing = project.extraction.studies.filter((s) => {
      if (s.sourceId && existingSourceIds.has(s.sourceId)) return false;
      return !existingByStudy.has(s.study.trim().toLowerCase());
    });
    if (missing.length === 0) {
      setNotice("All extracted studies already have risk-of-bias entries.");
      return;
    }
    const created = missing.map((s) => blank(s.study, tool, s.sourceId));
    onChange({ ...project, rob: { assessments: [...list, ...created] } });
    setNotice(`Synced ${created.length} extracted stud${created.length === 1 ? "y" : "ies"} into Risk of Bias.`);
  };

  const resolvedAbstract = (a: RobAssessment): string => {
    if (abstracts[a.id] !== undefined) return abstracts[a.id];
    const linked = findLinkedCitation(project, { sourceId: a.sourceId, study: a.study });
    return linked?.abstract ?? "";
  };

  const update = (id: string, patch: Partial<RobAssessment>) => {
    onChange({ ...project, rob: { assessments: list.map((a) => (a.id === id ? { ...a, ...patch } : a)) } });
  };

  const remove = (id: string) => {
    if (!window.confirm("Remove this risk-of-bias assessment?")) return;
    onChange({ ...project, rob: { assessments: list.filter((a) => a.id !== id) } });
  };

  const handleSuggestRating = async (assessmentId: string, domain: string) => {
    const assessment = list.find((a) => a.id === assessmentId);
    const abstract = assessment ? resolvedAbstract(assessment) : "";
    if (!abstract.trim()) return;
    setNotice("");
    setBusyDomain(`${assessmentId}:${domain}`);
    try {
      const { rating } = await suggestRoB(abstract, domain);
      if (assessment) {
        update(assessmentId, { domains: { ...assessment.domains, [domain]: rating } });
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI risk-of-bias suggestion failed.");
    } finally {
      setBusyDomain(null);
    }
  };

  const counts = list.reduce((acc, a) => { acc[a.overall] = (acc[a.overall] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-3">
      {notice && <p role="status" className="rounded-[4px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-1.5 text-[12px]">{notice}</p>}
      <Card title="Risk of bias" right={
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-auto" value={tool} onChange={(e) => setTool(e.target.value as (typeof TOOLS)[number])}>
            {TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          {project.extraction.studies.length > 0 && (
            <Button variant="outline" size="sm" onClick={syncFromExtraction} title="Create RoB forms for all extracted studies">
              <RefreshCw className="h-3.5 w-3.5" /> Sync All Extracted ({project.extraction.studies.length})
            </Button>
          )}
          <button className="btn-primary" onClick={add}>+ Add</button>
          <StepCommentsButton step="rob" stepTitle="Risk of Bias" />
        </div>
      }>
        <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)]">
          Rate each study with the {tool} tool. Linked citation abstracts are loaded automatically for AI domain checks; overall ratings feed GRADE and Manuscript.
        </p>

        {list.length === 0 ? (
          <EmptyState>
            No assessments yet. Click <strong className="text-[var(--color-text)]">Sync All Extracted</strong> to import all included studies automatically, or click <strong className="text-[var(--color-text)]">+ Add</strong>.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {list.map((a) => {
              const linked = findLinkedCitation(project, { sourceId: a.sourceId, study: a.study });
              const effAbstract = resolvedAbstract(a);
              return (
              <div key={a.id} className="rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Select className="max-w-[240px]" value={a.study} onChange={(e) => {
                    const matched = project.extraction.studies.find((s) => s.study === e.target.value);
                    update(a.id, { study: e.target.value, ...(matched?.sourceId ? { sourceId: matched.sourceId } : {}) });
                  }}>
                    {studyNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    <option value="New study">New study</option>
                  </Select>
                  <Select className="w-auto" value={a.tool} onChange={(e) => { const t = e.target.value as (typeof TOOLS)[number]; update(a.id, { tool: t, domains: Object.fromEntries(DOMAINS[t].map((d) => [d, "Low"])) }); }}>
                    {TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  {linked && (
                    <Pill tone="accent">
                      Linked citation{linked.year ? ` (${linked.year})` : ""}
                    </Pill>
                  )}
                  {(linked?.pdfUrl || linked?.url || linked?.doi) && (
                    <button
                      type="button"
                      className="btn-ghost text-[11px]"
                      onClick={() => void openExternalUrl(linked.pdfUrl || linked.url || `https://doi.org/${linked.doi}`)}
                    >
                      <ExternalLink className="mr-1 inline h-3 w-3" /> Open source
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-ghost"
                      aria-pressed={openSourceId === a.id}
                      onClick={() => setOpenSourceId(openSourceId === a.id ? null : a.id)}
                    >
                      <Highlighter className="h-3.5 w-3.5" /> Source &amp; Quotes
                    </button>
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">Overall</span>
                    <Select className="w-auto" value={a.overall} onChange={(e) => update(a.id, { overall: e.target.value as RobAssessment["overall"] })}>
                      {OVERALL.map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                    <button className="btn-ghost" onClick={() => remove(a.id)}>remove</button>
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {linked?.abstract && abstracts[a.id] === undefined ? "Linked citation abstract (auto-loaded):" : "Abstract for AI RoB suggestions:"}
                  </span>
                  <Input
                    className="min-w-[260px] flex-1"
                    placeholder="No linked abstract found — paste abstract to enable AI suggestions…"
                    value={effAbstract}
                    onChange={(e) => setAbstracts({ ...abstracts, [a.id]: e.target.value })}
                  />
                </div>
                {openSourceId === a.id && (
                  <div className="mb-3">
                    <StudySourceViewer
                      citation={linked}
                      text={effAbstract}
                      onTextChange={(next) => setAbstracts({ ...abstracts, [a.id]: next })}
                      provenance={a.provenance}
                      onClearProvenance={(key) => {
                        const nextProv = { ...(a.provenance ?? {}) };
                        delete nextProv[key];
                        update(a.id, { provenance: nextProv });
                      }}
                      targets={DOMAINS[a.tool].map((dom) => ({
                        key: dom,
                        label: dom.split(" ")[0],
                        onAssign: (quote) => update(a.id, { provenance: { ...(a.provenance ?? {}), [dom]: quote } }),
                      }))}
                      placeholder="Attach study PDF or paste methods/results text, then highlight text to save domain support quotes…"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {DOMAINS[a.tool].map((d) => {
                    const isBusy = busyDomain === `${a.id}:${d}`;
                    return (
                    <div key={d} className="flex items-center gap-2">
                      <span className="flex-1 text-[12px] text-[var(--color-text-muted)]">{d}</span>
                      <Select className="w-auto" value={a.domains[d] ?? "Low"} onChange={(e) => update(a.id, { domains: { ...a.domains, [d]: e.target.value } })}>
                        <option>Low</option><option>Some concerns</option><option>High</option>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSuggestRating(a.id, d)}
                        disabled={isBusy || !effAbstract.trim()}
                      >
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Suggest
                      </Button>
                    </div>
                  );})}
                </div>
              </div>
            );})}
          </div>
        )}

        {list.length > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <span className="text-[11px] text-[var(--color-text-muted)]">Distribution:</span>
            {(["Low", "Some concerns", "High"] as const).map((o) => (
              <Pill key={o} tone={o === "Low" ? "include" : o === "High" ? "exclude" : "unsure"}>{o}: {counts[o] ?? 0}</Pill>
            ))}
          </div>
        )}
      </Card>

      {list.length > 0 && (
        <Card
          title="Risk of Bias Visualization"
          right={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--input-bg)] p-0.5 text-[11px]">
                <button
                  className={`rounded px-2.5 py-1 transition-colors ${
                    vizTab === "traffic"
                      ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] font-medium shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                  onClick={() => setVizTab("traffic")}
                >
                  Traffic Light
                </button>
                <button
                  className={`rounded px-2.5 py-1 transition-colors ${
                    vizTab === "summary"
                      ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] font-medium shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                  onClick={() => setVizTab("summary")}
                >
                  Summary Bar
                </button>
                <button
                  className={`rounded px-2.5 py-1 transition-colors ${
                    vizTab === "radar"
                      ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] font-medium shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                  onClick={() => setVizTab("radar")}
                >
                  Radar
                </button>
              </div>
              {vizTab !== "radar" && robSvg && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadText(`rob_${vizTab}_${tool.toLowerCase()}.svg`, robSvg, "image/svg+xml")}
                  title="Download publication-quality SVG"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export SVG
                </Button>
              )}
            </div>
          }
        >
          {vizTab === "radar" ? (
            <DomainRadar list={list} tool={tool} />
          ) : svgLoading ? (
            <div className="flex h-64 items-center justify-center text-[12px] text-[var(--color-text-muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--color-accent)]" />
              Generating Cochrane {vizTab === "traffic" ? "traffic light" : "summary bar"} figure…
            </div>
          ) : robSvg ? (
            <div className="flex flex-col items-center">
              <div
                className="max-w-full overflow-x-auto rounded-lg bg-[var(--color-surface)] p-2 shadow-inner"
                dangerouslySetInnerHTML={{ __html: robSvg }}
              />
              <p className="mt-2 text-center text-[11px] text-[var(--color-text-muted)]">
                Standard Cochrane robvis-style figure ({tool}) • Fully vector Scalable Vector Graphics (SVG)
              </p>
            </div>
          ) : (
            <EmptyState>No {tool} data available to render figure.</EmptyState>
          )}
        </Card>
      )}
    </div>
  );
}

/** Bklit RadarChart: one axis per RoB domain, value = % of studies at "Low". */
function DomainRadar({ list, tool }: { list: RobAssessment[]; tool: (typeof TOOLS)[number] }) {
  const domains = DOMAINS[tool];
  const forTool = list.filter((a) => a.tool === tool);
  if (forTool.length === 0) {
    return <EmptyState>No {tool} assessments yet.</EmptyState>;
  }
  const metrics = domains.map((d, i) => ({ key: `d${i}`, label: d }));
  const values: Record<string, number> = {};
  domains.forEach((d, i) => {
    const low = forTool.filter((a) => (a.domains[d] ?? "Low") === "Low").length;
    values[`d${i}`] = Math.round((low / forTool.length) * 100);
  });
  return (
    <div className="mx-auto max-w-[380px]">
      <RadarChart data={[{ label: `${tool} — low risk`, values }]} metrics={metrics} margin={64} levels={4}>
        <RadarGrid />
        <RadarAxis />
        <RadarLabels />
        <RadarArea index={0} />
      </RadarChart>
      <p className="mt-1 text-center text-[10.5px] text-[var(--color-text-muted)]">
        {forTool.length} {tool} assessment{forTool.length === 1 ? "" : "s"} — outer edge = 100% low risk
      </p>
    </div>
  );
}
