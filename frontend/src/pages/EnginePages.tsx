import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Button } from "../components/ui";
import { postJson } from "../lib/api";
import { ResultCard, ErrorDisplay } from "../components/StudyManager";
import { Loader2 } from "lucide-react";

const F = (n: number, d = 3) => n.toFixed(d);

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function BayesianMcmcPage({ project }: Props) {
  const [iter, setIter] = useState(10000);
  const [warmup, setWarmup] = useState(2000);
  const [chains, setChains] = useState(4);
  const [ropeLo, setRopeLo] = useState(-0.1);
  const [ropeHi, setRopeHi] = useState(0.1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const studies = project.extraction?.studies ?? [];
  const effects: number[] = [];
  const variances: number[] = [];
  for (const s of studies) {
    if (s.effect_size != null && s.effect_se != null && s.effect_se > 0) {
      effects.push(s.effect_size);
      variances.push(s.effect_se * s.effect_se);
    }
  }

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await postJson("/api/bayesian", { effects, variances, iter, warmup, chains, ropeLower: parseFloat(ropeLo.toString()), ropeUpper: parseFloat(ropeHi.toString()), seed: 42 });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card title="Bayesian MCMC Meta-Analysis" subtitle={`${effects.length} studies · Gibbs sampling · Normal prior on μ, half-Cauchy on τ`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block"><span className="text-xs text-[var(--color-muted-foreground)]">Iterations</span>
            <input type="number" value={iter} onChange={e => setIter(+e.target.value)} className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]" /></label>
          <label className="block"><span className="text-xs text-[var(--color-muted-foreground)]">Warmup</span>
            <input type="number" value={warmup} onChange={e => setWarmup(+e.target.value)} className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]" /></label>
          <label className="block"><span className="text-xs text-[var(--color-muted-foreground)]">Chains</span>
            <input type="number" value={chains} onChange={e => setChains(+e.target.value)} className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]" /></label>
          <div className="flex gap-2">
            <label className="block"><span className="text-xs text-[var(--color-muted-foreground)]">ROPE low</span>
              <input type="number" value={ropeLo} onChange={e => setRopeLo(+e.target.value)} step={0.05} className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]" /></label>
            <label className="block"><span className="text-xs text-[var(--color-muted-foreground)]">ROPE high</span>
              <input type="number" value={ropeHi} onChange={e => setRopeHi(+e.target.value)} step={0.05} className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]" /></label>
          </div>
        </div>
        <Button onClick={run} disabled={busy || effects.length < 2} className="mt-3">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Sampling...</> : "Run MCMC"}
        </Button>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && (
        <Card title="Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard title="μ (median)" value={result.muMedian} ci={[result.muCiLower, result.muCiUpper]} />
            <ResultCard title="τ (median)" value={result.tauMedian} ci={[result.tauCiLower, result.tauCiUpper]} />
            <ResultCard title="P(μ > 0)" value={`${(result.probPositive * 100).toFixed(1)}%`} />
            <ResultCard title="Bayes Factor" value={result.bayesFactor != null ? F(result.bayesFactor, 2) : "—"} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <ResultCard title="R-hat (μ)" value={F(result.rhatMu, 3)} subtitle={result.rhatMu > 1.1 ? "⚠ Check convergence" : "✓ Converged"} />
            <ResultCard title="ESS (μ)" value={Math.round(result.essMu)} />
            {result.probInRope != null && <ResultCard title="P(in ROPE)" value={`${(result.probInRope * 100).toFixed(1)}%`} />}
          </div>
          {result.warnings?.length > 0 && <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2 mt-3">{result.warnings.map((w: string, i: number) => <div key={i}>⚠ {w}</div>)}</div>}
        </Card>
      )}
    </div>
  );
}

export function InfluencePage({ project }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const studies = project.extraction?.studies ?? [];
  const effects: number[] = [];
  const variances: number[] = [];
  const names: string[] = [];
  for (const s of studies) {
    if (s.effect_size != null && s.effect_se != null && s.effect_se > 0) {
      effects.push(s.effect_size);
      variances.push(s.effect_se * s.effect_se);
      names.push(s.study || "?");
    }
  }

  const run = async () => {
    setBusy(true); setErr(null);
    try { setResult(await postJson("/api/influence", { effects, variances })); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card title="Influence Diagnostics" subtitle="Cook's distance, DFFITS, studentized residuals, hat values">
        <Button onClick={run} disabled={busy || effects.length < 3}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Computing...</> : "Run Diagnostics"}
        </Button>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && (<>
        <div className="grid grid-cols-4 gap-3">
          <ResultCard title="Influential" value={result.nInfluential} />
          <ResultCard title="Outliers" value={result.nOutliers} />
          <ResultCard title="Threshold (Cook's)" value={F(result.thresholdCooks, 3)} />
          <ResultCard title="Threshold (DFFITS)" value={F(result.thresholdDffits, 3)} />
        </div>
        {result.flaggedStudies?.length > 0 && <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2">{result.flaggedStudies.map((s: string, i: number) => <div key={i}>⚠ {s}</div>)}</div>}
        <Card title="Per-study diagnostics">
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]"><th className="text-left p-1">Study</th><th className="text-right p-1">Stud. resid.</th><th className="text-right p-1">Hat</th><th className="text-right p-1">Cook's D</th><th className="text-right p-1">DFFITS</th><th className="text-center p-1">Flag</th></tr></thead>
          <tbody>{result.studies.map((s: any, i: number) => (<tr key={i} className={`border-b border-[var(--color-border)]/50 ${(s.isInfluential || s.isOutlier) ? "bg-yellow-900/10" : ""}`}><td className="p-1">{names[i] ?? `Study ${i}`}</td><td className="text-right p-1">{F(s.studentizedResidual, 2)}</td><td className="text-right p-1">{F(s.hatValue, 3)}</td><td className={`text-right p-1 ${s.cooksDistance > result.thresholdCooks ? "text-yellow-400 font-semibold" : ""}`}>{F(s.cooksDistance, 3)}</td><td className={`text-right p-1 ${Math.abs(s.dffits) > result.thresholdDffits ? "text-yellow-400 font-semibold" : ""}`}>{F(s.dffits, 2)}</td><td className="text-center p-1">{s.isInfluential ? <span className="text-yellow-400">●</span> : s.isOutlier ? <span className="text-orange-400">○</span> : <span className="text-green-400">✓</span>}</td></tr>))}</tbody>
          </table></div>
        </Card>
      </>)}
    </div>
  );
}

export function GoshPage({ project }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const studies = project.extraction?.studies ?? [];
  const effects: number[] = [];
  const variances: number[] = [];
  for (const s of studies) { if (s.effect_size != null && s.effect_se != null && s.effect_se > 0) { effects.push(s.effect_size); variances.push(s.effect_se * s.effect_se); } }

  const run = async () => { setBusy(true); setErr(null); try { setResult(await postJson("/api/gosh", { effects, variances, maxSubsets: 10000, seed: 42 })); } catch (e: any) { setErr(e.message); } setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="GOSH Analysis" subtitle="Graphic Approach to Heterogeneity — fits all study subsets">
        <Button onClick={run} disabled={busy || effects.length < 3}>{busy ? <><Loader2 size={14} className="animate-spin" /> Computing...</> : "Run GOSH"}</Button>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && <Card title="Results">
        <div className="grid grid-cols-3 gap-3">
          <ResultCard title="Overall pooled" value={result.overallPooled} />
          <ResultCard title="τ²" value={result.overallTau2} />
          <ResultCard title="Subsets generated" value={result.nSubsetsGenerated} />
        </div>
        {result.clusterWarnings?.length > 0 && <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2 mt-3">{result.clusterWarnings.map((w: string, i: number) => <div key={i}>⚠ {w}</div>)}</div>}
      </Card>}
    </div>
  );
}

export function PermutationPage({ project }: Props) {
  const [nPerm, setNPerm] = useState(5000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const studies = project.extraction?.studies ?? [];
  const effects: number[] = [];
  const variances: number[] = [];
  for (const s of studies) { if (s.effect_size != null && s.effect_se != null && s.effect_se > 0) { effects.push(s.effect_size); variances.push(s.effect_se * s.effect_se); } }

  const run = async () => { setBusy(true); setErr(null); try { setResult(await postJson("/api/permutation", { effects, variances, nPermutations: nPerm, test: "pooled", seed: 42 })); } catch (e: any) { setErr(e.message); } setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="Permutation Test" subtitle="Non-parametric p-value via permutation of study labels">
        <label className="block max-w-xs"><span className="text-xs text-[var(--color-muted-foreground)]">Permutations</span>
          <input type="number" value={nPerm} onChange={e => setNPerm(+e.target.value)} className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]" />
        </label>
        <Button onClick={run} disabled={busy || effects.length < 2} className="mt-3">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Permuting...</> : "Run Permutation Test"}
        </Button>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && <Card title="Results"><div className="grid grid-cols-3 gap-3">
        <ResultCard title="Observed stat" value={F(result.observedStatistic)} />
        <ResultCard title="Permutation p" value={F(result.pValue, 4)} />
        <ResultCard title="N permutations" value={result.nPermutations} />
      </div></Card>}
    </div>
  );
}

export function BootstrapPage({ project }: Props) {
  const [nBoot, setNBoot] = useState(5000);
  const [method, setMethod] = useState("percentile");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const studies = project.extraction?.studies ?? [];
  const effects: number[] = [];
  const variances: number[] = [];
  for (const s of studies) { if (s.effect_size != null && s.effect_se != null && s.effect_se > 0) { effects.push(s.effect_size); variances.push(s.effect_se * s.effect_se); } }

  const run = async () => { setBusy(true); setErr(null); try { setResult(await postJson("/api/bootstrap", { effects, variances, nBootstrap: nBoot, method, seed: 42 })); } catch (e: any) { setErr(e.message); } setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="Bootstrap Confidence Intervals" subtitle="Non-parametric bootstrap for the pooled estimate">
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <label className="block"><span className="text-xs text-[var(--color-muted-foreground)]">Bootstrap samples</span>
            <input type="number" value={nBoot} onChange={e => setNBoot(+e.target.value)} className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]" /></label>
          <label className="block"><span className="text-xs text-[var(--color-muted-foreground)]">CI method</span>
            <select value={method} onChange={e => setMethod(e.target.value)} className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]">
              <option value="percentile">Percentile</option><option value="bca">BCa</option><option value="normal">Normal</option>
            </select>
          </label>
        </div>
        <Button onClick={run} disabled={busy || effects.length < 2} className="mt-3">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Bootstrapping...</> : "Run Bootstrap"}
        </Button>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && <Card title="Results"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultCard title="Observed" value={F(result.observed)} />
        <ResultCard title="Bias" value={F(result.bias, 4)} />
        <ResultCard title="95% CI" value="" ci={[result.ciLower, result.ciUpper]} />
        <ResultCard title="Method" value={result.method} />
      </div></Card>}
    </div>
  );
}
