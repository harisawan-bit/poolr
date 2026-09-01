import { useEffect, useRef, useState } from "react";
import type { Project, ExtendedMetaRequest, ExtendedMetaResponse, Study, MetaResponse } from "../lib/project";
import { Card, Select, Pill, EmptyState } from "../components/ui";
import ShimmerText from "../components/kokonut/ShimmerText";
import ActivityState from "../components/kokonut/ActivityState";
import { runMetaExtended, getFigure } from "../lib/project";
import { RingChart } from "../components/charts/ring-chart";
import { Ring } from "../components/charts/ring";
import { RingCenter } from "../components/charts/ring-center";
import { EffectSizeConverter } from "../components/EffectSizeConverter";

const MEASURES: ExtendedMetaRequest["measure"][] = [
  "OR", "RR", "RD", "MD", "SMD", "HR",
  "MH_OR", "PETO", "GLASS",                    // v0.5.1 poolers
  "LOGIT_PROP", "ARS_PROP", "IRR", "IRD",      // v0.5.1 outcome types
  "Z_CORR", "GEN_IV",
];
const METHODS: ExtendedMetaRequest["method"][] = ["DL", "REML", "PM", "HS", "ML", "EB"];
const MODELS: ExtendedMetaRequest["model"][] = ["random", "fixed"];
const PUB: ExtendedMetaRequest["bias_depth"][] = ["none", "egger", "all", "full"];

const DEFAULTS: ExtendedMetaRequest = {
  model: "random", measure: "OR", method: "DL", subgroup: "none",
  pub_bias: "none", knapp_hartung: false, sensitivity: true, bias_depth: "egger", data: [],
};

export default function Meta({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const settings = { ...DEFAULTS, ...(project.meta?.settings ?? {}) } as ExtendedMetaRequest;
  const studies = project.extraction?.studies ?? [];
  // Results live on the project (single source of truth) so switching pages or
  // reloading a saved project keeps the pooled estimate on screen.
  const resp = (project.meta?.results ?? null) as ExtendedMetaResponse | null;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forest, setForest] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<string | null>(null);
  const [diag, setDiag] = useState<Record<string, string>>({});
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const set = (patch: Partial<ExtendedMetaRequest>) => {
    const next = { ...settings, ...patch };
    onChange({ ...project, meta: { ...project.meta, settings: next } });
  };

  const run = async () => {
    if (!studies.length) { setErr("Add at least one study in Extraction first."); return; }
    setBusy(true); setErr(null); setForest(null); setFunnel(null); setDiag({});
    let r: ExtendedMetaResponse;
    try {
      // pass every field through — v0.5.1 outcome types need the new columns
      const data: Study[] = studies.map((s) => ({ ...s }));
      r = await runMetaExtended({ ...settings, data });
      if (!mounted.current) return;
      onChange({ ...project, meta: { ...project.meta, settings, results: r } });
    } catch (e) {
      if (mounted.current) { setErr(msg(e)); setBusy(false); }
      return;
    }
    // Figures are a separate step: a plot failure must not discard a valid pooled result.
    try {
      const figs: Record<string, string> = {};
      const jobs: Promise<void>[] = [];
      const addFig = async (kind: string, body: unknown) => {
        try { figs[kind] = await getFigure(kind, body as never); } catch { /* plot failure is non-fatal */ }
      };
      jobs.push(addFig("forest", r));
      jobs.push(addFig("funnel", r));
      if ((r.studies?.length ?? 0) >= 3) {
        jobs.push(addFig("funnel_contour", r));
      }
      await Promise.all(jobs);
      if (!mounted.current) return;
      setForest(figs["forest"] ?? null);
      setFunnel(figs["funnel"] ?? null);
      setDiag(figs["funnel_contour"] ? { funnel_contour: figs["funnel_contour"] } : {});
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
          <button className="btn-primary min-w-[120px]" onClick={run} disabled={busy}>
            {busy ? <span className="flex h-6 items-center"><ShimmerText className="!p-0 !text-sm" text="Pooling…" /></span> : "Run"}
          </button>
        </div>
      }>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Model</div>
            <Select value={settings.model} onChange={(e) => set({ model: e.target.value as ExtendedMetaRequest["model"] })}>
              {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Measure</div>
            <Select value={settings.measure} onChange={(e) => set({ measure: e.target.value as ExtendedMetaRequest["measure"] })}>
              {MEASURES.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Method</div>
            <Select value={settings.method} onChange={(e) => set({ method: e.target.value as ExtendedMetaRequest["method"] })}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Pub. bias</div>
            <Select value={settings.bias_depth ?? "egger"} onChange={(e) => set({ bias_depth: e.target.value as ExtendedMetaRequest["bias_depth"] })}>
              {PUB.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
        </div>
        <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[#e6e7ea]"
            checked={!!settings.knapp_hartung}
            onChange={(e) => set({ knapp_hartung: e.target.checked })}
          />
          Knapp–Hartung adjustment <span className="text-[10.5px]">(recommended for random-effects; t-based CIs)</span>
        </label>
        {err && <div className="mt-2 rounded-[3px] border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">{err}</div>}
      </Card>

      {!resp ? (
        busy ? (
          <Card title="Working">
            {/* v0.5.3 — live computation state so the wait is never a dead screen */}
            <ActivityState />
          </Card>
        ) : (
          <EmptyState>Configure settings and Run. Results, forest, and funnel plots appear here.</EmptyState>
        )
      ) : (
        <>
          <Card title="Pooled result">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
              <Stat k="Pooled" v={fmtE(pooled?.effect)} accent />
              <Stat k="95% CI" v={`${fmtE(pooled?.ci_lower)} – ${fmtE(pooled?.ci_upper)}`} />
              <Stat k="p-value" v={fmtN(pooled?.p, 4)} />
              <Stat k="I²" v={het ? `${fmtN(het.i2, 1)}%` : "—"} />
              {typeof het?.i2_lower === "number" && typeof het?.i2_upper === "number" && (
                <Stat k="I² 95% CI" v={`${fmtN(het.i2_lower, 0)} – ${fmtN(het.i2_upper, 0)}%`} />
              )}
              <Stat k="τ²" v={fmtN(het?.tau2, 4)} />
              <Stat k="Q (df)" v={het ? `${fmtN(het.q, 2)} (${het.df ?? "—"}), p ${fmtN(het?.q_p, 3)}` : "—"} />
              {typeof het?.h2 === "number" && <Stat k="H²" v={fmtN(het.h2, 2)} />}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)]">Effect Size Conversion</span>
              <EffectSizeConverter />
            </div>
            {resp.publication_bias?.egger && (
              <div className="mt-3 text-[12px] text-[var(--color-text-muted)]">Egger intercept {fmtN(resp.publication_bias.egger.intercept, 3)} (p {fmtN(resp.publication_bias.egger.p_value, 3)}) — {resp.publication_bias.egger.significant ? "significant asymmetry" : "no significant asymmetry"}</div>
            )}
            {/* v0.5.1 subgroup block: per-group heterogeneity + Q-between interaction test */}
            {(resp as { subgroups?: { groups?: { name: string; effect: number; ci_lower: number; ci_upper: number; k: number; i2_within?: number }[]; between?: { q: number; df: number; p: number } | null } | null }).subgroups?.groups?.length ? (
              (() => {
                const sg = (resp as { subgroups?: { groups?: { name: string; effect: number; ci_lower: number; ci_upper: number; k: number; i2_within?: number }[]; between?: { q: number; df: number; p: number } | null } }).subgroups!;
                return (
                  <div className="mt-3">
                    <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Subgroups</div>
                    <div className="flex flex-wrap gap-2">
                      {sg.groups!.map((g, i) => (
                        <Pill key={`${g.name}-${i}`} tone="accent">
                          {g.name}: {fmtE(g.effect)} [{fmtE(g.ci_lower)}, {fmtE(g.ci_upper)}] (k={g.k}, I²w {g.i2_within != null ? fmtN(g.i2_within, 0) : "—"}%)
                        </Pill>
                      ))}
                    </div>
                    {sg.between && (
                      <div className="mt-1.5 text-[12px] text-[var(--color-text-muted)]">
                        Q-between = {fmtN(sg.between.q, 2)} (df {sg.between.df}), p = {fmtN(sg.between.p, 4)}
                        {sg.between.p < 0.05 ? " — subgroup difference significant" : " — no significant subgroup difference"}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : null}
            {/* v0.5.1 sensitivity pack */}
            {resp.sensitivity?.leave_one_out?.length ? (
              <div className="mt-3">
                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Sensitivity (leave-one-out)</div>
                <div className="max-h-40 overflow-y-auto rounded-[3px] border border-[var(--color-border)]">
                  <table className="w-full text-left text-[11.5px]">
                    <thead className="text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
                      <tr><th className="px-2 py-1">Excluded</th><th className="px-2 py-1">Pooled</th><th className="px-2 py-1">95% CI</th><th className="px-2 py-1">I²</th></tr>
                    </thead>
                    <tbody>
                      {resp.sensitivity.leave_one_out.map((l, i) => (
                        <tr key={i} className={`border-t border-[var(--color-border)] ${l.excluded === resp.sensitivity?.most_influential ? "text-[var(--color-unsure)]" : ""}`}>
                          <td className="px-2 py-1">{l.excluded}</td>
                          <td className="px-2 py-1 font-mono">{fmtE(l.effect)}</td>
                          <td className="px-2 py-1 font-mono">{fmtE(l.ci_lower)}, {fmtE(l.ci_upper)}</td>
                          <td className="px-2 py-1">{fmtN(l.i2, 0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {resp.sensitivity.most_influential && (
                  <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    Most influential: {resp.sensitivity.most_influential} (removing it moves the pooled estimate by {fmtN(resp.sensitivity.influence_max_change_pct, 1)}%)
                  </div>
                )}
              </div>
            ) : null}
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
          {diag["funnel_contour"] && (
            <Card title="Contour-enhanced funnel">
              <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: diag["funnel_contour"] }} />
              <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">Shaded regions show statistical significance of imputed studies — points in white regions were significant even before publication bias.</div>
            </Card>
          )}
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
      <div className={`text-[18px] font-semibold tabular-nums ${accent ? "text-[var(--color-text)]" : "text-[var(--color-text)]"}`}>{v}</div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{k}</div>
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
            <span className="truncate text-[var(--color-text-muted)]">{d.label}</span>
            <span className="font-mono text-[var(--color-text)]">{d.value}%</span>
          </div>
        ))}
        {data.length > 8 && <div className="text-[10.5px] text-[var(--color-text-muted)]">+{data.length - 8} more (hover rings)</div>}
      </div>
    </div>
  );
}
