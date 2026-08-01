import type { Project, SearchDb } from "../lib/project";
import { Card, Input, Textarea, SectionLabel, Pill, EmptyState } from "../components/ui";
import { downloadText } from "../lib/project";

const DB_LIST = ["PubMed", "Embase", "Cochrane CENTRAL", "Scopus", "Web of Science"];

function buildQuery(p: Project): string {
  const { population, intervention, comparator, outcomes } = p.pico;
  const parts = [population, intervention, comparator].filter((s) => s && s.trim()).map((s) => `("${s.trim()}")`);
  const out = outcomes ? `(${outcomes.trim()})` : "";
  const base = parts.join(" AND ");
  return [base, out].filter(Boolean).join(" AND ");
}

export default function Search({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const dbs = project.search?.databases ?? [];

  const ensure = () => {
    if (dbs.length) return;
    const seeded: SearchDb[] = DB_LIST.map((name) => ({ name, query: buildQuery(project), results: null }));
    onChange({ ...project, search: { databases: seeded } });
  };

  const addDb = () => {
    const list = [...dbs, { name: "New database", query: buildQuery(project), results: null }];
    onChange({ ...project, search: { databases: list } });
  };

  const update = (i: number, patch: Partial<SearchDb>) => {
    const list = dbs.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    onChange({ ...project, search: { databases: list } });
  };

  const regen = () => {
    const q = buildQuery(project);
    const list = dbs.map((d) => ({ ...d, query: q }));
    onChange({ ...project, search: { databases: list } });
  };

  const exportTxt = () => {
    const lines = dbs.map((d) => `${d.name}\n${d.query}\n(${d.results ?? "?"} results)\n`);
    downloadText("poolr_search_strategy.txt", `poolr search strategy\n\n${lines.join("\n")}`);
  };

  const totalResults = dbs.reduce((a, d) => a + (d.results ?? 0), 0);

  return (
    <div className="space-y-3">
      <Card title="Search strategy builder" right={
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{dbs.length} databases</Pill>
          <button className="btn-ghost" onClick={regen}>Regenerate from PICO</button>
          <button className="btn-ghost" onClick={addDb}>+ DB</button>
          <button className="btn-primary" onClick={exportTxt}>Export .txt</button>
        </div>
      }>
        <p className="mb-3 text-[12.5px] text-[#8b8d96]">
          Queries are derived from the Protocol PICO. Edit per-database, then export the full strategy.
        </p>

        {dbs.length === 0 ? (
          <EmptyState>Generate the base strategy from your PICO, or add a database manually.</EmptyState>
        ) : (
          <div className="space-y-3">
            {dbs.map((d, i) => (
              <div key={i} className="rounded-[5px] border border-[var(--color-border)] bg-[#0c0d11] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Input className="max-w-[220px]" value={d.name} onChange={(e) => update(i, { name: e.target.value })} />
                  <div className="ml-auto flex items-center gap-2">
                    <SectionLabel>results</SectionLabel>
                    <Input
                      type="number"
                      className="w-24"
                      value={d.results ?? ""}
                      placeholder="?"
                      onChange={(e) => update(i, { results: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                    <button className="btn-ghost" onClick={() => onChange({ ...project, search: { databases: dbs.filter((_, idx) => idx !== i) } })}>remove</button>
                  </div>
                </div>
                <Textarea rows={2} value={d.query} onChange={(e) => update(i, { query: e.target.value })} className="font-mono text-[11.5px]" />
              </div>
            ))}
          </div>
        )}

        {dbs.length === 0 && (
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={ensure}>Generate from PICO</button>
          </div>
        )}

        {dbs.length > 0 && (
          <div className="mt-3 border-t border-[var(--color-border)] pt-3 text-[12.5px] text-[#8b8d96]">
            Total retrieved across databases: <span className="font-mono text-[#e6e7ea]">{totalResults.toLocaleString()}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
