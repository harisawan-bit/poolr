import { useState } from "react";
import type { Project, RobAssessment } from "../lib/project";
import { Card, Select, Pill, EmptyState } from "../components/ui";

const TOOLS = ["RoB2", "NOS", "PROBAST"] as const;
const OVERALL = ["Low", "Some concerns", "High", "—"] as const;

const DOMAINS: Record<(typeof TOOLS)[number], string[]> = {
  RoB2: ["Randomization", "Deviations from intended", "Missing outcome", "Measurement of outcome", "Selection of reported result"],
  NOS: ["Selection", "Comparability", "Exposure / Outcome"],
  PROBAST: ["Participants", "Predictors", "Outcome", "Analysis"],
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
        <p className="mb-3 text-[12.5px] text-[#8b8d96]">
          Rate each study with the {tool} tool. Overall rating feeds the GRADE certainty on the PRISMA page.
        </p>

        {list.length === 0 ? (
          <EmptyState>No assessments. Add a study to begin — studies from Extraction are pre-listed.</EmptyState>
        ) : (
          <div className="space-y-3">
            {list.map((a) => (
              <div key={a.id} className="rounded-[5px] border border-[var(--color-border)] bg-[#0c0d11] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Select className="max-w-[220px]" value={a.study} onChange={(e) => update(a.id, { study: e.target.value })}>
                    {studyNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    <option value="New study">New study</option>
                  </Select>
                  <Select className="w-auto" value={a.tool} onChange={(e) => { const t = e.target.value as (typeof TOOLS)[number]; update(a.id, { tool: t, domains: Object.fromEntries(DOMAINS[t].map((d) => [d, "Low"])) }); }}>
                    {TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10.5px] text-[#8b8d96]">Overall</span>
                    <Select className="w-auto" value={a.overall} onChange={(e) => update(a.id, { overall: e.target.value as RobAssessment["overall"] })}>
                      {OVERALL.map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                    <button className="btn-ghost" onClick={() => remove(a.id)}>remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {DOMAINS[a.tool].map((d) => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="flex-1 text-[12px] text-[#8b8d96]">{d}</span>
                      <Select className="w-auto" value={a.domains[d] ?? "Low"} onChange={(e) => update(a.id, { domains: { ...a.domains, [d]: e.target.value } })}>
                        <option>Low</option><option>Some concerns</option><option>High</option>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {list.length > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <span className="text-[11px] text-[#8b8d96]">Distribution:</span>
            {(["Low", "Some concerns", "High"] as const).map((o) => (
              <Pill key={o} tone={o === "Low" ? "include" : o === "High" ? "exclude" : "unsure"}>{o}: {counts[o] ?? 0}</Pill>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
