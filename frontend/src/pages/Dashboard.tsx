import type { Project } from "../lib/project";
import { Card, Pill } from "../components/ui";
import { RingChart } from "../components/charts/ring-chart";
import { Ring } from "../components/charts/ring";
import { RingCenter } from "../components/charts/ring-center";
import { Gauge } from "../components/charts/gauge";

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
  const decided = included + excluded + unsure;
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

  // Bklit RingChart data — one ring per decision class, progress vs decided total.
  const ringTotal = Math.max(decided, 1);
  const ringData = [
    { label: "Include", value: included, maxValue: ringTotal, color: "#3fb950" },
    { label: "Exclude", value: excluded, maxValue: ringTotal, color: "#f05252" },
    { label: "Unsure", value: unsure, maxValue: ringTotal, color: "#f2b84b" },
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
            <RingChart data={ringData} size={132} strokeWidth={10} ringGap={5} baseInnerRadius={34}>
              <Ring index={0} />
              <Ring index={1} />
              <Ring index={2} />
              <RingCenter defaultLabel="decided" />
            </RingChart>
            <div className="space-y-1.5 text-[12.5px]">
              <Legend color="#3fb950" label="Include" n={included} />
              <Legend color="#f05252" label="Exclude" n={excluded} />
              <Legend color="#f2b84b" label="Unsure" n={unsure} />
              <div className="pt-1 text-[10.5px] text-[#8b8d96]">{decided} of {screeningItems.length} records screened</div>
            </div>
          </div>
        </Card>

        <Card title="Heterogeneity">
          {meta ? (
            <div className="flex items-center gap-4">
              <Gauge
                value={Math.min(Math.max(meta.heterogeneity.i2, 0), 100)}
                orientation="arc"
                totalNotches={24}
                centerValue={Math.round(meta.heterogeneity.i2)}
                suffix="%"
                defaultLabel="I²"
                width={150}
                height={110}
                activeFill={meta.heterogeneity.i2 > 75 ? "#f05252" : meta.heterogeneity.i2 > 50 ? "#f2b84b" : "#3fb950"}
                useGradient={false}
              />
              <div className="flex-1 space-y-1 text-[12.5px]">
                <Row k="Model" v={meta.model} />
                <Row k="Q" v={`${meta.heterogeneity.q.toFixed(2)} (df ${meta.heterogeneity.df}, p ${meta.heterogeneity.q_p.toFixed(3)})`} />
                <Row k="τ²" v={meta.heterogeneity.tau2.toFixed(4)} />
                <Row k="k" v={String(meta.k)} />
              </div>
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
