import type { Project } from "../lib/project";
import { Card, Pill } from "../components/ui";

export default function Dashboard({ project }: { project: Project; onChange: (p: Project) => void }) {
  const studies = project.extraction.studies;
  const meta = project.meta.results;
  const screeningItems = [
    ...project.screening.title_abstract,
    ...project.screening.full_text,
  ];
  const included = screeningItems.filter((s) => s.decision === "include").length;
  const excluded = screeningItems.filter((s) => s.decision === "exclude").length;
  const unsure = screeningItems.filter((s) => s.decision === "unsure").length;
  const robDone = project.rob.assessments.length;

  const kpis = [
    { k: "Studies (extracted)", v: String(studies.length) },
    { k: "Pooled effect", v: meta ? fmt(meta.pooled.effect, meta.measure) : "—" },
    { k: "95% CI", v: meta ? `${fmt(meta.pooled.ci_lower, meta.measure)} – ${fmt(meta.pooled.ci_upper, meta.measure)}` : "—" },
    { k: "I²", v: meta ? `${meta.heterogeneity.i2.toFixed(0)}%` : "—" },
    { k: "Screening incl.", v: String(included) },
    { k: "Screening excl.", v: String(excluded) },
    { k: "RoB done", v: String(robDone) },
    { k: "PICO", v: project.pico.population ? "set" : "empty" },
  ];

  return (
    <div className="space-y-3">
      <Card title={project.metadata.title || "Untitled review"} right={<Pill tone="accent">poolr v{project.metadata.version}</Pill>}>
        <p className="text-[12.5px] leading-relaxed text-[#8b8d96]">
          {project.protocol.objective || "No objective defined yet — set one in Protocol."} PICO:{" "}
          <span className="text-[#e6e7ea]">{project.pico.population || "—"} / {project.pico.intervention || "—"} / {project.pico.comparator || "—"} / {project.pico.outcomes || "—"}.</span>
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.k} className="card p-3">
            <div className="text-[20px] font-semibold tabular-nums">{kpi.v}</div>
            <div className="mt-0.5 text-[10.5px] text-[#8b8d96]">{kpi.k}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card title="Screening progress">
          <div className="flex items-center gap-4">
            <Donut include={included} exclude={excluded} unsure={unsure} />
            <div className="space-y-1.5 text-[12.5px]">
              <Legend color="#3fb950" label="Include" n={included} />
              <Legend color="#f05252" label="Exclude" n={excluded} />
              <Legend color="#f2b84b" label="Unsure" n={unsure} />
            </div>
          </div>
        </Card>

        <Card title="Heterogeneity">
          {meta ? (
            <div className="space-y-2 text-[12.5px]">
              <Row k="Model" v={meta.model} />
              <Row k="Q" v={`${meta.heterogeneity.q.toFixed(2)} (df ${meta.heterogeneity.df}, p ${meta.heterogeneity.q_p.toFixed(3)})`} />
              <Row k="I²" v={`${meta.heterogeneity.i2.toFixed(1)}%`} />
              <Row k="τ²" v={meta.heterogeneity.tau2.toFixed(4)} />
              <Row k="k" v={String(meta.k)} />
            </div>
          ) : (
            <p className="text-[12.5px] text-[#8b8d96]">Run a meta-analysis from the Meta-Analysis page to see heterogeneity.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function fmt(v: number, measure: string) {
  const logScale = measure === "OR" || measure === "RR" || measure === "HR";
  return logScale ? v.toFixed(2) : v.toFixed(3);
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] py-0.5 last:border-0">
      <span className="text-[#8b8d96]">{k}</span>
      <span className="font-mono text-[#e6e7ea]">{v}</span>
    </div>
  );
}

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="text-[#8b8d96]">{label}</span>
      <span className="ml-auto font-mono text-[#e6e7ea]">{n}</span>
    </div>
  );
}

function Donut({ include, exclude, unsure }: { include: number; exclude: number; unsure: number }) {
  const total = Math.max(include + exclude + unsure, 1);
  const seg = (n: number) => (n / total) * 100;
  const i = seg(include), e = seg(exclude), u = seg(unsure);
  const R = 34, C = 2 * Math.PI * R;
  const circ = (pct: number, offset: number) => (
    <circle r={R} cx="42" cy="42" fill="none" strokeWidth="11"
      strokeDasharray={`${(pct / 100) * C} ${C}`} strokeDashoffset={-offset}
      transform="rotate(-90 42 42)" />
  );
  return (
    <svg width="84" height="84" viewBox="0 0 84 84">
      <circle r={R} cx="42" cy="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="11" />
      {circ(i, 0) && <g>
        <circle r={R} cx="42" cy="42" fill="none" stroke="#3fb950" strokeWidth="11" strokeDasharray={`${(i / 100) * C} ${C}`} strokeDashoffset="0" transform="rotate(-90 42 42)" />
        <circle r={R} cx="42" cy="42" fill="none" stroke="#f05252" strokeWidth="11" strokeDasharray={`${(e / 100) * C} ${C}`} strokeDashoffset={(-i / 100) * C} transform="rotate(-90 42 42)" />
        <circle r={R} cx="42" cy="42" fill="none" stroke="#f2b84b" strokeWidth="11" strokeDasharray={`${(u / 100) * C} ${C}`} strokeDashoffset={(-(i + e) / 100) * C} transform="rotate(-90 42 42)" />
      </g>}
    </svg>
  );
}
