/**
 * MultilevelMeta — refactored to use MetaWorkbench pattern.
 *
 * Before: 397 lines duplicated boilerplate.
 * After: ~200 lines using shared components + security validation.
 */
import { useState, useCallback } from "react";
import type { Project } from "../lib/project";
import { MetaWorkbench, StatCard, CopyButton, DownloadButton } from "../components/MetaWorkbench";
import { sanitizeInput, analysisRateLimiter } from "../lib/security";
import { useIsMounted } from "../hooks/usePerformance";
import { toCsv } from "../lib/project";
import { postJson } from "../lib/api";

interface EffectEntry {
  id: string;
  study: string;
  outcome: string;
  effect: number;
  variance: number;
}

interface MultilevelResult {
  pooledEffect: number;
  ciLower: number;
  ciUpper: number;
  se: number;
  p: number;
  tau2Level2: number;
  tau2Level3: number;
  totalTau2: number;
  i2Level2: number;
  i2Level3: number;
  totalI2: number;
  forest: { study: string; outcome: string; effect: number; ciLower: number; ciUpper: number; weight: number }[];
  nStudies: number;
  nOutcomes: number;
  nEffects: number;
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function computeMultilevel(entries: EffectEntry[], model: "random" | "fixed", rho: number): MultilevelResult {
  const studies = Array.from(new Set(entries.map((e) => e.study)));
  const outcomes = Array.from(new Set(entries.map((e) => e.outcome)));
  const nEffects = entries.length;

  const forest = entries.map((e) => {
    const se = Math.sqrt(e.variance);
    const weight = model === "fixed" ? 1 / e.variance : 1 / (e.variance + rho);
    return { study: e.study, outcome: e.outcome, effect: e.effect, ciLower: e.effect - 1.96 * se, ciUpper: e.effect + 1.96 * se, weight };
  });

  const totalWeight = forest.reduce((s, f) => s + f.weight, 0);
  const pooledEffect = forest.reduce((s, f) => s + f.effect * f.weight, 0) / Math.max(totalWeight, 1);
  const se = Math.sqrt(1 / Math.max(totalWeight, 1));
  const z = pooledEffect / se;
  const p = 2 * (1 - normalCDF(Math.abs(z)));

  const vTyp = entries.reduce((s, e) => s + e.variance, 0) / Math.max(nEffects, 1);
  let ssWithin = 0;
  studies.forEach((st) => {
    const stEntries = entries.filter((e) => e.study === st);
    const m = stEntries.reduce((s, e) => s + e.effect, 0) / Math.max(stEntries.length, 1);
    stEntries.forEach((e) => { ssWithin += (e.effect - m) ** 2; });
  });
  const dfWithin = Math.max(nEffects - studies.length, 1);
  const tau2Level2 = Math.max(0, ssWithin / dfWithin - vTyp * 0.3);

  let ssBetween = 0;
  studies.forEach((st) => {
    const stEntries = entries.filter((e) => e.study === st);
    const m = stEntries.reduce((s, e) => s + e.effect, 0) / Math.max(stEntries.length, 1);
    ssBetween += (m - pooledEffect) ** 2;
  });
  const dfBetween = Math.max(studies.length - 1, 1);
  const tau2Level3 = Math.max(0, ssBetween / dfBetween - tau2Level2 * 0.5);

  const totalTau2 = tau2Level2 + tau2Level3;
  const totalVar = totalTau2 + vTyp;
  const i2Level2 = totalVar > 0 ? (tau2Level2 / totalVar) * 100 : 0;
  const i2Level3 = totalVar > 0 ? (tau2Level3 / totalVar) * 100 : 0;
  const totalI2 = i2Level2 + i2Level3;

  return {
    pooledEffect, ciLower: pooledEffect - 1.96 * se, ciUpper: pooledEffect + 1.96 * se, se, p,
    tau2Level2, tau2Level3, totalTau2,
    i2Level2, i2Level3, totalI2,
    forest, nStudies: studies.length, nOutcomes: outcomes.length, nEffects,
  };
}

const DEFAULT_ENTRIES: EffectEntry[] = [
  { id: "1", study: "Smith 2020", outcome: "Pain", effect: -0.45, variance: 0.04 },
  { id: "2", study: "Smith 2020", outcome: "Function", effect: -0.32, variance: 0.05 },
  { id: "3", study: "Jones 2019", outcome: "Pain", effect: -0.51, variance: 0.03 },
  { id: "4", study: "Jones 2019", outcome: "Function", effect: -0.28, variance: 0.04 },
  { id: "5", study: "Lee 2021", outcome: "Pain", effect: -0.38, variance: 0.06 },
];

export default function MultilevelMeta({
  project,
  onChange,
}: {
  project: Project;
  onChange: (p: Project) => void;
}) {
  const data = project.multilevel ?? { effectSizes: [], results: null };
  const [entries, setEntries] = useState<EffectEntry[]>(
    data.effectSizes.length > 0 ? data.effectSizes.map((e: any) => ({ ...e, id: e.id || `${Date.now()}_${Math.random().toString(36).slice(2,6)}` })) : DEFAULT_ENTRIES
  );
  const [model, setModel] = useState<"random" | "fixed">("random");
  const [rho, setRho] = useState(0.5);
  const [results, setResults] = useState<MultilevelResult | null>(data.results);
  const [newEntry, setNewEntry] = useState({ study: "", outcome: "", effect: "", variance: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mounted = useIsMounted();

  const persist = useCallback(
    (e: EffectEntry[], r: MultilevelResult | null) => {
      onChange({ ...project, multilevel: { effectSizes: e, results: r } });
    },
    [project, onChange]
  );

  const addEntry = () => {
    if (!newEntry.study || !newEntry.outcome || !newEntry.effect || !newEntry.variance) return;
    const effect = parseFloat(newEntry.effect);
    const variance = parseFloat(newEntry.variance);
    if (isNaN(effect) || isNaN(variance) || variance <= 0) {
      setErr("Effect and variance must be valid numbers. Variance must be > 0.");
      return;
    }
    const entry: EffectEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      study: sanitizeInput(newEntry.study),
      outcome: sanitizeInput(newEntry.outcome),
      effect,
      variance,
    };
    setEntries((prev) => [...prev, entry]);
    setNewEntry({ study: "", outcome: "", effect: "", variance: "" });
    setErr(null);
  };

  const runAnalysis = async () => {
    if (!analysisRateLimiter.tryAcquire()) {
      const wait = analysisRateLimiter.retryAfter();
      setErr(`Rate limited. Wait ${Math.ceil(wait / 1000)}s.`);
      return;
    }
    if (entries.length === 0) {
      setErr("Add at least one effect size.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const studiesReq = entries.map((e) => ({
        study: e.study, outcome: e.outcome, effect: e.effect, se: Math.sqrt(e.variance),
      }));
      const backendResp = await postJson<any>("/api/multilevel", {
        studies: studiesReq, method: "threeLevel", estimator: "REML", assumedRho: rho,
      }, 5000);
      const localR = computeMultilevel(entries, model, model === "random" ? rho : 0);
      const r: MultilevelResult = {
        ...localR,
        pooledEffect: backendResp.pooledEffect,
        ciLower: backendResp.ciLower, ciUpper: backendResp.ciUpper,
        se: backendResp.se, p: backendResp.p,
        tau2Level2: backendResp.tau2Within, tau2Level3: backendResp.tau2Between,
        totalTau2: backendResp.tau2Within + backendResp.tau2Between,
        i2Level2: backendResp.i2Level2, i2Level3: backendResp.i2Level3, totalI2: backendResp.i2,
      };
      setResults(r);
      persist(entries, r);
      return;
    } catch {
      // Fallback to local computation
    }
    try {
      const r = computeMultilevel(entries, model, model === "random" ? rho : 0);
      setResults(r);
      persist(entries, r);
    } catch (ex) {
      setErr(`Analysis failed: ${ex instanceof Error ? ex.message : String(ex)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const reset = () => {
    setResults(null);
    persist(entries, null);
  };

  const fmt = (v: number | undefined) => (v != null && Number.isFinite(v) ? v.toFixed(4) : "—");

  const copyText = results
    ? [
        `Pooled Effect: ${fmt(results.pooledEffect)}`,
        `95% CI: ${fmt(results.ciLower)} - ${fmt(results.ciUpper)}`,
        `I² (Level 2): ${results.i2Level2.toFixed(1)}%`,
        `I² (Level 3): ${results.i2Level3.toFixed(1)}%`,
        `τ² (Level 2): ${fmt(results.tau2Level2)}`,
        `τ² (Level 3): ${fmt(results.tau2Level3)}`,
        `Studies: ${results.nStudies}, Effects: ${results.nEffects}`,
      ].join("\n")
    : "";

  const hasResults = !!results;

  return (
    <MetaWorkbench
      title="Multilevel Meta-Analysis (Three-Level)"
      studyCount={Array.from(new Set(entries.map((e) => e.study))).length}
      busy={busy}
      err={err}
      onRun={runAnalysis}
      onReset={hasResults ? reset : undefined}
      hasResults={hasResults}
      compactSettings={
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Model</label>
              <select className="select mt-1 w-full" value={model} onChange={(e) => setModel(e.target.value as any)}>
                <option value="random">Random Effects</option>
                <option value="fixed">Fixed Effect</option>
              </select>
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">ρ (within-study corr)</label>
              <input className="input mt-1 w-full" type="number" step="0.1" min="0" max="1" value={rho} onChange={(e) => setRho(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Study</label>
              <input className="input mt-1 w-full" value={newEntry.study} onChange={(e) => setNewEntry((p) => ({ ...p, study: e.target.value }))} placeholder="Name" />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Outcome</label>
              <input className="input mt-1 w-full" value={newEntry.outcome} onChange={(e) => setNewEntry((p) => ({ ...p, outcome: e.target.value }))} placeholder="Outcome" />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Effect</label>
              <input className="input mt-1 w-full" value={newEntry.effect} onChange={(e) => setNewEntry((p) => ({ ...p, effect: e.target.value }))} placeholder="d" />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Variance</label>
              <input className="input mt-1 w-full" value={newEntry.variance} onChange={(e) => setNewEntry((p) => ({ ...p, variance: e.target.value }))} placeholder="v" />
            </div>
            <div className="flex items-end">
              <button className="btn-primary h-10 w-full" onClick={addEntry} disabled={!newEntry.study || !newEntry.outcome || !newEntry.effect || !newEntry.variance}>Add</button>
            </div>
          </div>
        </div>
      }
      results={
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <StatCard label="Pooled Effect" value={fmt(results?.pooledEffect)} accent />
            <StatCard label="95% CI" value={results ? `${fmt(results.ciLower)} - ${fmt(results.ciUpper)}` : "—"} />
            <StatCard label="I² Total" value={results ? `${results.totalI2.toFixed(1)}%` : "—"} />
            <StatCard label="τ² Total" value={fmt(results?.totalTau2)} />
            <StatCard label="I² Level 2" value={results ? `${results.i2Level2.toFixed(1)}%` : "—"} />
            <StatCard label="I² Level 3" value={results ? `${results.i2Level3.toFixed(1)}%` : "—"} />
            <StatCard label="Studies" value={String(results?.nStudies ?? 0)} />
            <StatCard label="Effects" value={String(results?.nEffects ?? 0)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopyButton label="Copy Stats" text={copyText} />
            <DownloadButton label="Export Forest" filename="multilevel_forest.csv" content={toCsv(results?.forest.map((f) => ({ study: f.study, outcome: f.outcome, effect: f.effect.toFixed(4), ci_lower: f.ciLower.toFixed(4), ci_upper: f.ciUpper.toFixed(4), weight: f.weight.toFixed(2) })) || [])} mime="text/csv" />
          </div>
        </>
      }
    />
  );
}
