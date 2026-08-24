import { useEffect, useRef, useState } from "react";
import type { Project, MetaRequest, MetaResponse } from "../lib/project";
import { Card, Select, Pill, EmptyState } from "../components/ui";
import { runMeta, getFigure } from "../lib/project";
import { RingChart } from "../components/charts/ring-chart";
import { Ring } from "../components/charts/ring";
import { RingCenter } from "../components/charts/ring-center";

const MEASURES: MetaRequest["measure"][] = ["OR", "RR", "RD", "MD", "SMD", "HR"];
const METHODS: MetaRequest["method"][] = ["DL", "REML", "PM", "HS", "ML", "EB"];
const MODELS: MetaRequest["model"][] = ["random", "fixed"];
const PUB: MetaRequest["pub_bias"][] = ["none", "egger", "begg", "all"];

const DEFAULTS: MetaRequest = { model: "random", measure: "OR", method: "DL", subgroup: "none", pub_bias: "none", data: [] };

export default function Meta({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const settings = { ...DEFAULTS, ...(project.meta?.settings ?? {}) };
  const studies = project.extraction?.studies ?? [];
  // Results live on the project (single source of truth) so switching pages or
  // reloading a saved project keeps the pooled estimate on screen.
  const resp: MetaResponse | null = project.meta?.results ?? null;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forest, setForest] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const set = (patch: Partial<MetaRequest>) => {
    const next = { ...settings, ...patch };
    onChange({ ...project, meta: { ...project.meta, settings: next } });
  };

  const run = async () => {
    if (!studies.length) { setErr("Add at least one study in Extraction first."); return; }
    setBusy(true); setErr(null); setForest(null); setFunnel(null);
    let r: MetaResponse;
    try {
      const data = studies.map(({ study, type, int_events, int_n, ctrl_events, ctrl_n, int_mean, int_sd, ctrl_mean, ctrl_sd, hr, hr_lower, hr_upper, subgroup, design, year }) => ({
        study, type, int_events, int_n, ctrl_events, ctrl_n, int_mean, int_sd, ctrl_mean, ctrl_sd, hr, hr_lower, hr_upper, subgroup, design, year,
      }));
      r = await runMeta({ ...settings, data });
      if (!mounted.current) return;
      onChange({ ...project, meta: { ...project.meta, settings, results: r } });
    } catch (e) {
      if (mounted.current) { setErr(msg(e)); setBusy(false); }
      return;
    }
    // Figures are a separate step: a plot failure must not discard a valid pooled result.
    try {
      const [f, fn] = await Promise.all([getFigure("forest", r), getFigure("funnel", r)]);
      if (!mounted.current) return;
      setForest(f); setFunnel(fn);
    } catch (e) {
      if (mounted.current) setErr(`Analysis completed, but the plots could not be rendered: ${msg(e)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const measure = settings.measure ?? "OR";
  const logScale = measure === "OR" || measure === "RR" || measure === "HR";
  const fmtE = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? (logScale ? v.toFixed(2) : v.toFixed(3)) : "—");
  const fmtN = (v: unknown, digits: number) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—");
  const pooled = resp?.pooled;
  const het = resp?.heterogeneity;

  return (
    <div className="space-y-3">
      <Card title="Meta-analysis settings" right={
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{studies.length} studies</Pill>
          <button className="btn-primary" onClick={run} disabled={busy}>{busy ? "Running…" : "Run"}</button>
        </div>
      }>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#8b8d96]">Model</div>
            <Select value={settings.model} onChange={(e) => set({ model: e.target.value as MetaRequest["model"] })}>
              {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#8b8d96]">Measure</div>
            <Select value={settings.measure} onChange={(e) => set({ measure: e.target.value as MetaRequest["measure"] })}>
              {MEASURES.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#8b8d96]">Method</div>
            <Select value={settings.method} onChange={(e) => set({ method: e.target.value as MetaRequest["method"] })}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#8b8d96]">Pub. bias</div>
            <Select value={settings.pub_bias} onChange={(e) => set({ pub_bias: e.target.value as MetaRequest["pub_bias"] })}>
              {PUB.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
        </div>
        {err && <div className="mt-2 rounded-[3px] border border-[#f05252]/30 bg-[#f05252]/10 px-2.5 py-1.5 text-[12px] text-[#f05252]">{err}</div>}
      </Card>

      {!resp ? (
        <EmptyState>Configure settings and Run. Results, forest, and funnel plots appear here.</EmptyState>
      ) : (
        <>
          <Card title="Pooled result">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
              <Stat k="Pooled" v={fmtE(pooled?.effect)} accent />
              <Stat k="95% CI" v={`${fmtE(pooled?.ci_lower)} – ${fmtE(pooled?.ci_upper)}`} />
              <Stat k="p-value" v={fmtN(pooled?.p, 4)} />
              <Stat k="I²" v={het ? `${fmtN(het.i2, 1)}%` : "—"} />
              <Stat k="τ²" v={fmtN(het?.tau2, 4)} />
              <Stat k="Q (df)" v={het ? `${fmtN(het.q, 2)} (${het.df ?? "—"})` : "—"} />
            </div>
            {resp.publication_bias?.egger && (
              <div className="mt-3 text-[12px] text-[#8b8d96]">Egger intercept {fmtN(resp.publication_bias.egger.intercept, 3)} (p {fmtN(resp.publication_bias.egger.p_value, 3)}) — {resp.publication_bias.egger.significant ? "significant asymmetry" : "no significant asymmetry"}</div>
            )}
            {resp.subgroups && resp.subgroups.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#8b8d96]">Subgroups</div>
                <div className="flex flex-wrap gap-2">
                  {resp.subgroups.map((g, i) => (
                    <Pill key={`${g.name}-${i}`} tone="accent">{g.name}: {fmtE(g.effect)} ({g.k})</Pill>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Study weights">
            <WeightRings resp={resp} />
          </Card>

          <Card title="Forest plot">
            {forest ? <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: forest }} /> : <EmptyState>{busy ? "Rendering…" : "Run the analysis to render the forest plot."}</EmptyState>}
          </Card>
          <Card title="Funnel plot">
            {funnel ? <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: funnel }} /> : <EmptyState>{busy ? "Rendering…" : "Run the analysis to render the funnel plot."}</EmptyState>}
          </Card>
        </>
      )}
    </div>
  );
}

function msg(e: unknown): string {
  const t = e instanceof Error ? e.message : String(e);
  return t || "Unknown error";
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="card p-2.5">
      <div className={`text-[18px] font-semibold tabular-nums ${accent ? "text-[#e6e7ea]" : "text-[#e6e7ea]"}`}>{v}</div>
      <div className="text-[10.5px] text-[#8b8d96]">{k}</div>
    </div>
  );
}

/** Bklit RingChart — one ring per study, arc length = its meta-analysis weight.
 *  Hover a ring to see the study name + weight in the center. */
function WeightRings({ resp }: { resp: MetaResponse }) {
  const studies = resp.studies ?? [];
  if (studies.length === 0) {
    return <EmptyState>No per-study results.</EmptyState>;
  }
  // Weights may be fractions (sum≈1) or percentages (sum≈100) — normalise.
  const rawSum = studies.reduce((s, x) => s + (x.weight || 0), 0);
  const scale = rawSum > 0 && rawSum <= 1.5 ? 100 : 1;
  const data = studies.map((s) => ({
    label: s.study,
    value: Number(((s.weight || 0) * scale).toFixed(1)),
    maxValue: 100,
  }));
  return (
    <div className="flex flex-wrap items-center gap-5">
      <RingChart data={data} size={220} strokeWidth={9} ringGap={4} baseInnerRadius={40}>
        {data.map((_, i) => <Ring key={i} index={i} />)}
        <RingCenter defaultLabel="weight %" suffix="" />
      </RingChart>
      <div className="min-w-[180px] flex-1 space-y-1">
        {data.slice(0, 8).map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-[11.5px]">
            <span className="truncate text-[#8b8d96]">{d.label}</span>
            <span className="font-mono text-[#e6e7ea]">{d.value}%</span>
          </div>
        ))}
        {data.length > 8 && <div className="text-[10.5px] text-[#8b8d96]">+{data.length - 8} more (hover rings)</div>}
      </div>
    </div>
  );
}
