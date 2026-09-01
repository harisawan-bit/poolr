import { useEffect, useRef, useState } from "react";
import type { Project, ExtendedMetaRequest, ExtendedMetaResponse } from "../lib/project";
import { Card, Select, Pill, EmptyState, Button } from "../components/ui";
import ShimmerText from "../components/kokonut/ShimmerText";
import ActivityState from "../components/kokonut/ActivityState";
import { runMetaAnalysis, generateForestPlotData, generateFunnelPlotData } from "../lib/meta-engine";
import { interpretResults } from "../lib/ai";
import { RingChart } from "../components/charts/ring-chart";
import { Ring } from "../components/charts/ring";
import { RingCenter } from "../components/charts/ring-center";
import { Sparkles, Loader2 } from "lucide-react";

const MEASURES: string[] = ["OR", "RR", "RD", "MD", "SMD", "HR", "MH_OR", "PETO", "GLASS", "LOGIT_PROP", "ARS_PROP", "IRR", "IRD", "Z_CORR", "GEN_IV"];
const METHODS: string[] = ["DL", "REML", "PM", "HS", "ML", "EB"];
const MODELS: string[] = ["random", "fixed"];
const PUB: string[] = ["none", "egger", "all", "full"];

const DEFAULTS: ExtendedMetaRequest = {
  model: "random", measure: "OR", method: "DL", subgroup: "none",
  pub_bias: "none", knapp_hartung: false, sensitivity: true, bias_depth: "egger", data: [],
};

export default function Meta({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const settings = { ...DEFAULTS, ...(project.meta?.settings ?? {}) } as ExtendedMetaRequest;
  const studies = project.extraction?.studies ?? [];
  const resp = (project.meta?.results ?? null) as ExtendedMetaResponse | null;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forest, setForest] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<string | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const set = (patch: Partial<ExtendedMetaRequest>) => {
    onChange({ ...project, meta: { ...project.meta, settings: { ...settings, ...patch } } });
  };

  const run = async () => {
    if (!studies.length) { setErr("Add at least one study in Extraction first."); return; }
    setBusy(true); setErr(null); setForest(null); setFunnel(null); setInterpretation(null);

    const measure = settings.measure || "OR";
    const invalid = studies.filter(s => {
      if (["OR", "RR", "RD"].includes(measure)) return !s.int_events || !s.int_n || !s.ctrl_events || !s.ctrl_n;
      if (["MD", "SMD"].includes(measure)) return (!s.int_mean && s.int_mean !== 0) || !s.int_sd || (!s.ctrl_mean && s.ctrl_mean !== 0) || !s.ctrl_sd || !s.int_n || !s.ctrl_n;
      return false;
    });

    if (invalid.length) {
      const invalidNames = invalid.map(s => s.study || "Untitled").join(", ");
      setErr(`${invalid.length} studies have missing/invalid data: ${invalidNames}`);
      setBusy(false);
      return;
    }

    try {
      const inputStudies = studies.map(s => ({
        study: s.study || "Unknown",
        int_events: s.int_events || 0, int_n: s.int_n || 0,
        ctrl_events: s.ctrl_events || 0, ctrl_n: s.ctrl_n || 0,
        int_mean: s.int_mean ?? undefined, int_sd: s.int_sd ?? undefined,
        ctrl_mean: s.ctrl_mean ?? undefined, ctrl_sd: s.ctrl_sd ?? undefined,
        subgroup: s.subgroup || "",
      }));

      const result = runMetaAnalysis(
        { measure: settings.measure as any, model: settings.model as any, method: "DL" },
        inputStudies as any
      );

      const r: any = {
        model: result.pooled.ci_method || "random",
        measure: settings.measure || "OR",
        method: settings.method || "DL",
        k: result.studies.length,
        studies: result.studies.map(s => ({
          study: s.study, effect: s.effect, ci_lower: s.ci_lower,
          ci_upper: s.ci_upper, weight: s.weight / 100, subgroup: s.subgroup,
        })),
        pooled: result.pooled,
        heterogeneity: result.heterogeneity,
        subgroups_extended: result.subgroups ? {
          groups: result.subgroups.groups.map((g: any) => ({
            name: g.name, measure: settings.measure || "OR", effect: g.effect,
            ci_lower: g.ci_lower, ci_upper: g.ci_upper, k: g.k, i2_within: g.i2_within,
            q_within: 0, df_within: g.k - 1, tau2_within: 0,
          })),
          between: result.subgroups.between,
        } : undefined,
        sensitivity: result.sensitivity ? {
          leave_one_out: result.sensitivity.leave_one_out.map((l: any) => ({
            excluded: l.excluded, k: 0, effect: l.effect, ci_lower: l.ci_lower,
            ci_upper: l.ci_upper, p: 0, i2: l.i2,
          })),
          cumulative: [], fixed_vs_random: null,
          influence_max_change_pct: result.sensitivity.influence_max_change_pct,
          most_influential: result.sensitivity.most_influential,
        } : undefined,
        publication_bias: result.publication_bias,
        knapp_hartung: settings.knapp_hartung,
      };

      onChange({ ...project, meta: { ...project.meta, settings, results: r as ExtendedMetaResponse } });

      try {
        setForest(generateForestSVG(generateForestPlotData(result)));
        setFunnel(generateFunnelSVG(generateFunnelPlotData(result)));
      } catch (figErr) {
        console.error("Plot generation failed:", figErr);
      }
    } catch (e) {
      if (mounted.current) setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const handleInterpret = async () => {
    if (!resp?.pooled) return;
    setInterpreting(true);
    try {
      const text = await interpretResults({
        pooled: { effect: resp.pooled.effect, ci_lower: resp.pooled.ci_lower, ci_upper: resp.pooled.ci_upper, p: resp.pooled.p },
        heterogeneity: { i2: resp.heterogeneity?.i2 ?? 0, tau2: resp.heterogeneity?.tau2 ?? 0, q_p: resp.heterogeneity?.q_p ?? 1 },
        measure: settings.measure ?? "OR",
      });
      setInterpretation(text);
    } catch {
      setInterpretation("Could not generate interpretation. Check your AI provider settings.");
    } finally {
      setInterpreting(false);
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
          <SelectField label="Model" value={settings.model} onChange={v => set({ model: v as any })} options={MODELS} />
          <SelectField label="Measure" value={settings.measure} onChange={v => set({ measure: v as any })} options={MEASURES} />
          <SelectField label="Method" value={settings.method} onChange={v => set({ method: v as any })} options={METHODS} />
          <SelectField label="Pub. bias" value={settings.bias_depth ?? "egger"} onChange={v => set({ bias_depth: v as any })} options={PUB} />
        </div>
        <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
          <input type="checkbox" className="h-3.5 w-3.5 accent-[#e6e7ea]" checked={!!settings.knapp_hartung} onChange={e => set({ knapp_hartung: e.target.checked })} />
          Knapp–Hartung adjustment <span className="text-[10.5px]">(recommended for random-effects; t-based CIs)</span>
        </label>
        {err && <div className="mt-2 rounded-[3px] border border-[var(--color-exclude)]/30 bg-[var(--color-exclude)]/10 px-2.5 py-1.5 text-[12px] text-[var(--color-exclude)]">{err}</div>}
      </Card>

      {!resp ? (
        busy ? (
          <Card title="Working"><ActivityState /></Card>
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
            {pooled?.ci_method && (
              <div className="mt-3 text-[12px] text-[var(--color-text-muted)]">
                CI method: {pooled.ci_method}{resp.knapp_hartung ? " — wider, uncertainty-aware intervals" : ""}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleInterpret} disabled={interpreting}>
                {interpreting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {interpreting ? "Interpreting…" : "Interpret Results"}
              </Button>
            </div>
            {interpretation && (
              <div className="mt-3 rounded-[3px] border border-[var(--color-border)] bg-white/[0.04] p-3 text-[12px] text-[var(--color-text)]">
                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">AI Interpretation</div>
                {interpretation}
              </div>
            )}
            {resp.publication_bias?.egger && (
              <div className="mt-3 text-[12px] text-[var(--color-text-muted)]">
                Egger intercept {fmtN(resp.publication_bias.egger.intercept, 3)} (p {fmtN(resp.publication_bias.egger.p_value, 3)}) — {resp.publication_bias.egger.significant ? "significant asymmetry" : "no significant asymmetry"}
              </div>
            )}
            <SubgroupsBlock resp={resp} fmtE={fmtE} fmtN={fmtN} />
            <SensitivityBlock resp={resp} fmtE={fmtE} fmtN={fmtN} />
          </Card>

          <Card title="Study weights"><WeightRings resp={resp} /></Card>
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

function SelectField({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
      <Select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </Select>
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="card p-2.5">
      <div className={`text-[18px] font-semibold tabular-nums ${accent ? "text-[var(--color-text)]" : "text-[var(--color-text)]"}`}>{v}</div>
      <div className="text-[10.5px] text-[var(--color-text-muted)]">{k}</div>
    </div>
  );
}

function SubgroupsBlock({ resp, fmtE, fmtN }: { resp: any; fmtE: (v: unknown) => string; fmtN: (v: unknown, d: number) => string }) {
  const sg = resp.subgroups?.groups;
  if (!sg?.length) return null;
  return (
    <div className="mt-3">
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Subgroups</div>
      <div className="flex flex-wrap gap-2">
        {sg.map((g: any, i: number) => (
          <Pill key={`${g.name}-${i}`} tone="accent">
            {g.name}: {fmtE(g.effect)} [{fmtE(g.ci_lower)}, {fmtE(g.ci_upper)}] (k={g.k}, I²w {g.i2_within != null ? fmtN(g.i2_within, 0) : "—"}%)
          </Pill>
        ))}
      </div>
      {resp.subgroups.between && (
        <div className="mt-1.5 text-[12px] text-[var(--color-text-muted)]">
          Q-between = {fmtN(resp.subgroups.between.q, 2)} (df {resp.subgroups.between.df}), p = {fmtN(resp.subgroups.between.p, 4)}
          {resp.subgroups.between.p < 0.05 ? " — subgroup difference significant" : " — no significant subgroup difference"}
        </div>
      )}
    </div>
  );
}

function SensitivityBlock({ resp, fmtE, fmtN }: { resp: any; fmtE: (v: unknown) => string; fmtN: (v: unknown, d: number) => string }) {
  if (!resp.sensitivity?.leave_one_out?.length) return null;
  return (
    <div className="mt-3">
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Sensitivity (leave-one-out)</div>
      <div className="max-h-40 overflow-y-auto rounded-[3px] border border-[var(--color-border)]">
        <table className="w-full text-left text-[11.5px]">
          <thead className="text-[10.5px] uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr><th className="px-2 py-1">Excluded</th><th className="px-2 py-1">Pooled</th><th className="px-2 py-1">95% CI</th><th className="px-2 py-1">I²</th></tr>
          </thead>
          <tbody>
            {resp.sensitivity.leave_one_out.map((l: any, i: number) => (
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
  );
}

function WeightRings({ resp }: { resp: any }) {
  const studies = resp.studies ?? [];
  if (!studies.length) return <EmptyState>No per-study results.</EmptyState>;
  const rawSum = studies.reduce((s: number, x: any) => s + (x.weight || 0), 0);
  const scale = rawSum > 0 && rawSum <= 1.5 ? 100 : 1;
  const data = studies.map((s: any) => ({ label: s.study, value: Number(((s.weight || 0) * scale).toFixed(1)), maxValue: 100 }));
  return (
    <div className="flex flex-wrap items-center gap-5">
      <RingChart data={data} size={220} strokeWidth={9} ringGap={4} baseInnerRadius={40}>
        {data.map((_: any, i: number) => <Ring key={i} index={i} />)}
        <RingCenter defaultLabel="weight %" suffix="" />
      </RingChart>
      <div className="min-w-[180px] flex-1 space-y-1">
        {data.slice(0, 8).map((d: any, i: number) => (
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

function generateForestSVG(data: { studies: { study: string; effect: number; ci_lower: number; ci_upper: number; weight: number }[]; pooled: { effect: number; ci_lower: number; ci_upper: number } }): string {
  const width = 400, rowHeight = 22, headerHeight = 30, footerHeight = 40;
  const height = headerHeight + data.studies.length * rowHeight + footerHeight + 20;
  const plotLeft = 100, plotRight = 300, plotWidth = plotRight - plotLeft;
  const allCIs = [...data.studies.flatMap(s => [s.ci_lower, s.ci_upper]), data.pooled.ci_lower, data.pooled.ci_upper];
  const minVal = Math.min(...allCIs), maxVal = Math.max(...allCIs), range = maxVal - minVal || 1;
  const scale = (v: number) => plotLeft + ((v - minVal) / range) * plotWidth;

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans); font-size: 10px;">`;
  svg += `<style>.study-row:hover rect { fill: var(--hover-surface); }</style>`;
  svg += `<text x="10" y="20" fill="var(--color-text-muted)" font-size="9">Study</text>`;
  svg += `<text x="${plotLeft}" y="20" fill="var(--color-text-muted)" font-size="9" text-anchor="middle">Effect Size</text>`;
  svg += `<line x1="${plotLeft}" y1="${headerHeight}" x2="${plotRight}" y2="${headerHeight}" stroke="var(--color-border)" stroke-width="1"/>`;
  svg += `<line x1="${scale(0)}" y1="${headerHeight}" x2="${scale(0)}" y2="${height - footerHeight}" stroke="var(--color-border-strong)" stroke-width="1" stroke-dasharray="3,3"/>`;

  data.studies.forEach((s, i) => {
    const y = headerHeight + i * rowHeight + 10;
    svg += `<g class="study-row">`;
    svg += `<rect x="0" y="${y - 8}" width="${width}" height="20" fill="transparent" rx="3"/>`;
    svg += `<title>${s.study}\nEffect: ${s.effect.toFixed(3)}\n95% CI: [${s.ci_lower.toFixed(3)}, ${s.ci_upper.toFixed(3)}]\nWeight: ${s.weight.toFixed(1)}%</title>`;
    svg += `<text x="10" y="${y + 3}" fill="var(--color-text-muted)">${s.study.length > 15 ? s.study.slice(0, 14) + "…" : s.study}</text>`;
    svg += `<line x1="${scale(s.ci_lower)}" y1="${y}" x2="${scale(s.ci_upper)}" y2="${y}" stroke="var(--color-text)" stroke-width="1.5"/>`;
    svg += `<circle cx="${scale(s.effect)}" cy="${y}" r="3" fill="var(--color-accent)"/>`;
    svg += `</g>`;
  });

  const pooledY = headerHeight + data.studies.length * rowHeight + 20;
  svg += `<g class="study-row">`;
  svg += `<rect x="0" y="${pooledY - 8}" width="${width}" height="20" fill="transparent" rx="3"/>`;
  svg += `<title>Pooled Effect\nEffect: ${data.pooled.effect.toFixed(3)}\n95% CI: [${data.pooled.ci_lower.toFixed(3)}, ${data.pooled.ci_upper.toFixed(3)}]</title>`;
  svg += `<text x="10" y="${pooledY + 3}" fill="var(--color-text)" font-weight="bold">Pooled</text>`;
  svg += `<line x1="${scale(data.pooled.ci_lower)}" y1="${pooledY}" x2="${scale(data.pooled.ci_upper)}" y2="${pooledY}" stroke="var(--color-accent)" stroke-width="2"/>`;
  svg += `<polygon points="${scale(data.pooled.effect)},${pooledY - 4} ${scale(data.pooled.effect) - 4},${pooledY + 4} ${scale(data.pooled.effect) + 4},${pooledY + 4}" fill="var(--color-accent)"/>`;
  svg += `</g>`;
  svg += `</svg>`;
  return svg;
}

function generateFunnelSVG(data: { points: { effect: number; se: number; study: string }[] }): string {
  const width = 350, height = 300, plotLeft = 40, plotRight = 310, plotTop = 20, plotBottom = 280;
  const plotWidth = plotRight - plotLeft, plotHeight = plotBottom - plotTop;
  const maxSE = Math.max(...data.points.map(p => p.se));
  const minEffect = Math.min(...data.points.map(p => p.effect));
  const maxEffect = Math.max(...data.points.map(p => p.effect));
  const effectRange = maxEffect - minEffect || 1;
  const effectMid = (minEffect + maxEffect) / 2;
  const scaleX = (effect: number) => plotLeft + ((effect - minEffect) / effectRange) * plotWidth;
  const scaleY = (se: number) => plotBottom - (se / maxSE) * plotHeight;

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans); font-size: 9px;">`;
  svg += `<style>.funnel-point:hover circle { r: 5; stroke: var(--color-accent); stroke-width: 2; }</style>`;

  for (let se = 0; se <= maxSE; se += maxSE / 5) {
    const y = scaleY(se);
    const halfWidth = 1.96 * se;
    svg += `<line x1="${scaleX(effectMid - halfWidth)}" y1="${y}" x2="${scaleX(effectMid + halfWidth)}" y2="${y}" stroke="var(--color-border)" stroke-width="0.5" stroke-dasharray="2,2"/>`;
  }
  svg += `<line x1="${scaleX(effectMid)}" y1="${plotTop}" x2="${scaleX(effectMid)}" y2="${plotBottom}" stroke="var(--color-border-strong)" stroke-width="1"/>`;

  data.points.forEach(p => {
    svg += `<g class="funnel-point">`;
    svg += `<title>${p.study}\nEffect: ${p.effect.toFixed(3)}\nSE: ${p.se.toFixed(3)}</title>`;
    svg += `<circle cx="${scaleX(p.effect)}" cy="${scaleY(p.se)}" r="3" fill="var(--color-accent)" opacity="0.7"/>`;
    svg += `</g>`;
  });

  svg += `<text x="${plotLeft}" y="${plotBottom + 15}" fill="var(--color-text-muted)">Effect Size</text>`;
  svg += `<text x="10" y="${plotTop + 10}" fill="var(--color-text-muted)" transform="rotate(-90, 10, ${plotTop + 10})">Standard Error</text>`;
  svg += `</svg>`;
  return svg;
}
