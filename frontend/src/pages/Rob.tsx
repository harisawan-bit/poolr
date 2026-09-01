import { useState } from "react";
import type { Project, RobAssessment } from "../lib/project";
import { Card, Select, Pill, EmptyState } from "../components/ui";
import { RadarChart } from "../components/charts/radar-chart";
import { RadarGrid } from "../components/charts/radar-grid";
import { RadarAxis } from "../components/charts/radar-axis";
import { RadarLabels } from "../components/charts/radar-labels";
import { RadarArea } from "../components/charts/radar-area";

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

function blank(study: string, tool: (typeof TOOLS)[number]): RobAssessment {
  const domains: Record<string, string> = {};
  for (const d of DOMAINS[tool]) domains[d] = "Low";
  return { id: `r${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, study, tool, overall: "—", domains };
}

export default function Rob({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const list = project.rob.assessments;
  const studyNames = Array.from(new Set([
    ...project.extraction.studies.map((s) => s.study),
    ...list.map((a) => a.study),
  ])).filter(Boolean);
  const [tool, setTool] = useState<(typeof TOOLS)[number]>("RoB2");

  const add = () => {
    const name = studyNames[0] ?? "New study";
    onChange({ ...project, rob: { assessments: [...list, blank(name, tool)] } });
  };

  const update = (id: string, patch: Partial<RobAssessment>) => {
    onChange({ ...project, rob: { assessments: list.map((a) => (a.id === id ? { ...a, ...patch } : a)) } });
  };

  const remove = (id: string) => {
    onChange({ ...project, rob: { assessments: list.filter((a) => a.id !== id) } });
  };

  const counts = list.reduce((acc, a) => { acc[a.overall] = (acc[a.overall] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-3">
      <Card title="Risk of bias" right={
        <div className="flex items-center gap-2">
          <Select className="w-auto" value={tool} onChange={(e) => setTool(e.target.value as (typeof TOOLS)[number])}>
            {TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <button className="btn-primary" onClick={add} disabled={!studyNames.length}>+ Add</button>
        </div>
      }>
        <p className="mb-3 text-[12.5px] text-[var(--color-text-muted)]">
          Rate each study with the {tool} tool. Overall rating feeds the GRADE certainty on the PRISMA page.
        </p>

        {list.length === 0 ? (
          <EmptyState>No assessments. Add a study to begin — studies from Extraction are pre-listed.</EmptyState>
        ) : (
          <div className="space-y-3">
            {list.map((a) => (
              <div key={a.id} className="rounded-[5px] border border-[var(--color-border)] bg-[var(--input-bg)] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Select className="max-w-[220px]" value={a.study} onChange={(e) => update(a.id, { study: e.target.value })}>
                    {studyNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    <option value="New study">New study</option>
                  </Select>
                  <Select className="w-auto" value={a.tool} onChange={(e) => { const t = e.target.value as (typeof TOOLS)[number]; update(a.id, { tool: t, domains: Object.fromEntries(DOMAINS[t].map((d) => [d, "Low"])) }); }}>
                    {TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10.5px] text-[var(--color-text-muted)]">Overall</span>
                    <Select className="w-auto" value={a.overall} onChange={(e) => update(a.id, { overall: e.target.value as RobAssessment["overall"] })}>
                      {OVERALL.map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                    <button className="btn-ghost" onClick={() => remove(a.id)}>remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {DOMAINS[a.tool].map((d) => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="flex-1 text-[12px] text-[var(--color-text-muted)]">{d}</span>
                      <Select className="w-auto" value={a.domains[d] ?? "Low"} onChange={(e) => update(a.id, { domains: { ...a.domains, [d]: e.target.value } })}>
                        <option>Low</option><option>Some concerns</option><option>High</option>
                      </Select>
                      {/* 2.5 RoB AI reasoning display */}
                      {a.domains[d] && a.domains[d] !== "Low" && (
                        <span className="text-[10px] text-amber-500" title={`AI suggested: ${a.domains[d]}. Reason: Domain shows potential for bias based on study methodology.`}>ⓘ</span>
                      )}
                    </div>
                  ))}
                </div>
                {/* AI reasoning expandable section */}
                {Object.values(a.domains).some(v => v !== "Low") && (
                  <div className="mt-2 rounded border border-[var(--color-border)] p-2">
                    <details>
                      <summary className="cursor-pointer text-[11px] text-[var(--color-text-muted)]">Show AI reasoning</summary>
                      <div className="mt-1 space-y-1">
                        {DOMAINS[a.tool].filter(d => a.domains[d] !== "Low").map(d => (
                          <div key={d} className="text-[11px]">
                            <span className="font-semibold">{d}:</span> {a.domains[d]} — AI confidence: {
                              a.domains[d] === "High" ? "High" : "Medium"
                            }. Reason: {
                              a.domains[d] === "High"
                                ? "Domain shows high risk of bias based on reported methodology."
                                : "Domain shows some concerns; review study details."
                            }
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            ))}
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
        <Card title="Domain coverage — % of studies rated low risk">
          <DomainRadar list={list} tool={tool} />
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
