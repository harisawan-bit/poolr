import { useState, useMemo } from "react";
import type { Project } from "../lib/project";
import { Card as BaseCard, Input, Select, Button, EmptyState } from "../components/ui";
import { postJson } from "../lib/api";
import {
  Activity, TrendingUp, Grid3X3,
  BarChart3, GitBranch, Zap
} from "lucide-react";

// ─── Local UI helpers (simple value/onChange API) ────────────────────────

function Card({ title, subtitle, children, className }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <BaseCard title={title ?? ""} className={className}>
      {subtitle && <p className="text-xs text-[var(--color-muted-foreground)] -mt-2 mb-3">{subtitle}</p>}
      {children}
    </BaseCard>
  );
}

function NumInput({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--color-muted-foreground)]">{label}</span>
      <Input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)} className="mt-1" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--color-muted-foreground)]">{label}</span>
      <Select value={value} onChange={e => onChange(e.target.value)} className="mt-1">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </label>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────

interface BayesianResult {
  muMean: number; muMedian: number; muCiLower: number; muCiUpper: number;
  tauMean: number; tauMedian: number; tauCiLower: number; tauCiUpper: number;
  rhatMu: number; rhatTau: number; essMu: number; essTau: number;
  probPositive: number; probInRope?: number; bayesFactor?: number;
  warnings: string[];
}

interface GoshResult {
  subsets: { studyIndices: number[]; pooledEffect: number; tau2: number; i2: number }[];
  overallPooled: number; overallTau2: number; overallI2: number;
  clusterWarnings: string[]; nSubsetsGenerated: number;
}

interface InfluenceStudy {
  index: number; cooksDistance: number; dffits: number; studentizedResidual: number;
  hatValue: number; isOutlier: boolean; isInfluential: boolean;
}
interface InfluenceResult {
  studies: InfluenceStudy[]; nInfluential: number; nOutliers: number;
  flaggedStudies: string[]; thresholdCooks: number; thresholdDffits: number;
}

interface PermutationResult { pValue: number; observedStatistic: number; nPermutations: number; }
interface BootstrapResult { observed: number; bias: number; se: number; ciLower: number; ciUpper: number; method: string; }
interface TesResult { observedSignificant: number; expectedSignificant: number; ratio: number; pValue: number; powerMedian: number; excessSignificance: boolean; interpretation: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────

const F = (n: number, d = 3) => n.toFixed(d);

function getStudyEffects(project: Project): { effects: number[]; variances: number[]; names: string[] } {
  const studies = project.extraction?.studies ?? [];
  const effects: number[] = [];
  const variances: number[] = [];
  const names: string[] = [];

  for (const s of studies) {
    if (s.effect_size != null && s.effect_se != null && s.effect_se > 0) {
      effects.push(s.effect_size);
      variances.push(s.effect_se * s.effect_se);
      names.push(s.study || "?");
    } else if (s.hr != null && s.hr_lower != null && s.hr_upper != null && s.hr > 0) {
      const logHr = Math.log(s.hr);
      const se = (Math.log(s.hr_upper) - Math.log(s.hr_lower)) / (2 * 1.96);
      if (se > 0) { effects.push(logHr); variances.push(se * se); names.push(s.study || "?"); }
    } else if (s.int_events != null && s.int_n != null && s.ctrl_events != null && s.ctrl_n != null) {
      const a = s.int_events, n1 = s.int_n, c = s.ctrl_events, n2 = s.ctrl_n;
      const b = n1 - a, d = n2 - c;
      if (a > 0 && b > 0 && c > 0 && d > 0) {
        effects.push(Math.log((a * d) / (b * c)));
        variances.push(1 / a + 1 / b + 1 / c + 1 / d);
        names.push(s.study || "?");
      }
    }
  }
  return { effects, variances, names };
}

// ─── Tab Config ───────────────────────────────────────────────────────────

const TABS = [
  { key: "bayesian", label: "Bayesian MCMC", Icon: Activity },
  { key: "gosh", label: "GOSH", Icon: Grid3X3 },
  { key: "influence", label: "Influence", Icon: Zap },
  { key: "permutation", label: "Permutation", Icon: GitBranch },
  { key: "bootstrap", label: "Bootstrap", Icon: BarChart3 },
  { key: "tes", label: "Excess Significance", Icon: TrendingUp },
] as const;
type TabKey = typeof TABS[number]["key"];

// ─── Component ────────────────────────────────────────────────────────────

export default function AdvancedBayesian({ project }: { project: Project; onChange: (p: Project) => void }) {
  const [tab, setTab] = useState<TabKey>("bayesian");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<any>({});

  const { effects, variances, names } = useMemo(() => getStudyEffects(project), [project]);
  const hasData = effects.length >= 2;

  // Bayesian state
  const [bayesIter, setBayesIter] = useState(10000);
  const [bayesWarmup, setBayesWarmup] = useState(2000);
  const [bayesChains, setBayesChains] = useState(4);
  const [ropeLo, setRopeLo] = useState("-0.1");
  const [ropeHi, setRopeHi] = useState("0.1");

  // Permutation state
  const [permN, setPermN] = useState(5000);
  const [permTest, setPermTest] = useState("pooled");

  // Bootstrap state
  const [bootN, setBootN] = useState(5000);
  const [bootMethod, setBootMethod] = useState("percentile");

  // TES state
  const [tesAlpha, setTesAlpha] = useState(0.05);

  const runBayes = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await postJson<BayesianResult>("/api/bayesian", {
        effects, variances, iter: bayesIter, warmup: bayesWarmup, chains: bayesChains,
        ropeLower: parseFloat(ropeLo), ropeUpper: parseFloat(ropeHi), seed: 42
      });
      setResults((r: any) => ({ ...r, bayesian: res }));
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const runGosh = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await postJson<GoshResult>("/api/gosh", { effects, variances, maxSubsets: 10000, seed: 42 });
      setResults((r: any) => ({ ...r, gosh: res }));
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const runInfluence = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await postJson<InfluenceResult>("/api/influence", { effects, variances });
      setResults((r: any) => ({ ...r, influence: res }));
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const runPermutation = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await postJson<PermutationResult>("/api/permutation", { effects, variances, nPermutations: permN, test: permTest, seed: 42 });
      setResults((r: any) => ({ ...r, permutation: res }));
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const runBootstrap = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await postJson<BootstrapResult>("/api/bootstrap", { effects, variances, nBootstrap: bootN, method: bootMethod, seed: 42 });
      setResults((r: any) => ({ ...r, bootstrap: res }));
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const runTes = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await postJson<TesResult>("/api/tes", { effects, variances, alpha: tesAlpha, nSimulations: 5000, seed: 42 });
      setResults((r: any) => ({ ...r, tes: res }));
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const bayes = results.bayesian as BayesianResult | undefined;
  const gosh = results.gosh as GoshResult | undefined;
  const influence = results.influence as InfluenceResult | undefined;
  const perm = results.permutation as PermutationResult | undefined;
  const boot = results.bootstrap as BootstrapResult | undefined;
  const tes = results.tes as TesResult | undefined;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs rounded-t transition-colors flex items-center gap-1.5
              ${tab === t.key ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}>
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {!hasData && (
        <EmptyState title="No study data">
          Add studies with effect sizes (or HR/binary data) in Extraction first.
        </EmptyState>
      )}

      {err && <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded p-2">{err}</div>}

      {/* ─── Bayesian ──────────────────────────────────────────────── */}
      {tab === "bayesian" && hasData && (
        <div className="space-y-4">
          <Card title="Bayesian MCMC Meta-Analysis" subtitle={`${effects.length} studies · Gibbs sampling · Normal prior on μ, half-Cauchy on τ`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NumInput label="Iterations" value={bayesIter} onChange={setBayesIter} min={1000} step={1000} />
              <NumInput label="Warmup" value={bayesWarmup} onChange={setBayesWarmup} min={500} step={500} />
              <NumInput label="Chains" value={bayesChains} onChange={setBayesChains} min={1} max={8} />
              <div className="col-span-2 md:col-span-1 flex gap-2">
                <NumInput label="ROPE lower" value={parseFloat(ropeLo)} onChange={v => setRopeLo(v.toFixed(2))} step={0.05} />
                <NumInput label="ROPE upper" value={parseFloat(ropeHi)} onChange={v => setRopeHi(v.toFixed(2))} step={0.05} />
              </div>
            </div>
            <Button onClick={runBayes} disabled={busy} className="mt-3">
              {busy ? "Sampling..." : "Run MCMC"}
            </Button>
          </Card>

          {bayes && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">μ (median)</div><div className="text-lg font-semibold">{F(bayes.muMedian)}</div><div className="text-xs text-[var(--color-muted-foreground)]">[{F(bayes.muCiLower)}, {F(bayes.muCiUpper)}]</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">τ (median)</div><div className="text-lg font-semibold">{F(bayes.tauMedian)}</div><div className="text-xs text-[var(--color-muted-foreground)]">[{F(bayes.tauCiLower)}, {F(bayes.tauCiUpper)}]</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">P(μ {'>'} 0)</div><div className="text-lg font-semibold">{(bayes.probPositive * 100).toFixed(1)}%</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">Bayes Factor</div><div className="text-lg font-semibold">{bayes.bayesFactor != null ? F(bayes.bayesFactor, 2) : "—"}</div></Card>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">R-hat (μ)</div><div className={`text-lg font-semibold ${bayes.rhatMu > 1.1 ? "text-yellow-400" : "text-green-400"}`}>{F(bayes.rhatMu, 3)}</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">ESS (μ)</div><div className="text-lg font-semibold">{Math.round(bayes.essMu)}</div></Card>
                {bayes.probInRope != null && <Card><div className="text-xs text-[var(--color-muted-foreground)]">P(in ROPE)</div><div className="text-lg font-semibold">{(bayes.probInRope * 100).toFixed(1)}%</div></Card>}
              </div>
              {bayes.warnings.length > 0 && (
                <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2">
                  {bayes.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── GOSH ─────────────────────────────────────────────────── */}
      {tab === "gosh" && hasData && (
        <div className="space-y-4">
          <Card title="GOSH Analysis" subtitle="Graphic Approach to Heterogeneity — fits all study subsets">
            <p className="text-xs text-[var(--color-muted-foreground)] mb-2">Detects heterogeneity clusters by fitting the model to every combination of studies. For {'<'} 12 studies, enumerates all subsets; otherwise samples randomly.</p>
            <Button onClick={runGosh} disabled={busy}>{busy ? "Computing..." : "Run GOSH"}</Button>
          </Card>

          {gosh && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">Overall pooled</div><div className="text-lg font-semibold">{F(gosh.overallPooled)}</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">τ²</div><div className="text-lg font-semibold">{F(gosh.overallTau2)}</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">Subsets generated</div><div className="text-lg font-semibold">{gosh.nSubsetsGenerated}</div></Card>
              </div>
              {gosh.clusterWarnings.length > 0 && (
                <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2">
                  {gosh.clusterWarnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}
              {/* Subset distribution */}
              <Card title="Subset pooled estimates">
                <div className="text-xs text-[var(--color-muted-foreground)] mb-2">Distribution of pooled effects across {gosh.subsets.length} subsets:</div>
                {(() => {
                  const effects2 = gosh.subsets.map(s => s.pooledEffect);
                  const mn = Math.min(...effects2), mx = Math.max(...effects2);
                  const bins = 30;
                  const hist = new Array(bins).fill(0);
                  for (const e of effects2) {
                    const idx = Math.min(bins - 1, Math.floor((e - mn) / Math.max(mx - mn, 1e-9) * bins));
                    hist[idx]++;
                  }
                  const maxCount = Math.max(...hist);
                  return (
                    <>
                      <div className="flex items-end gap-px h-20 overflow-hidden">
                        {hist.map((c, i) => (
                          <div key={i} className="flex-1 bg-[var(--color-accent)]/60 rounded-t" style={{ height: `${(c / Math.max(maxCount, 1)) * 100}%` }} />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-[var(--color-muted-foreground)] mt-1">
                        <span>{F(mn)}</span><span>{F((mn + mx) / 2)}</span><span>{F(mx)}</span>
                      </div>
                    </>
                  );
                })()}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ─── Influence ────────────────────────────────────────────── */}
      {tab === "influence" && hasData && (
        <div className="space-y-4">
          <Card title="Influence Diagnostics" subtitle="Cook's distance, DFFITS, studentized residuals, hat values">
            <Button onClick={runInfluence} disabled={busy}>{busy ? "Computing..." : "Run Diagnostics"}</Button>
          </Card>

          {influence && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">Influential</div><div className={`text-lg font-semibold ${influence.nInfluential > 0 ? "text-yellow-400" : "text-green-400"}`}>{influence.nInfluential}</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">Outliers</div><div className={`text-lg font-semibold ${influence.nOutliers > 0 ? "text-yellow-400" : "text-green-400"}`}>{influence.nOutliers}</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">Threshold (Cook's)</div><div className="text-lg font-semibold">{F(influence.thresholdCooks, 3)}</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">Threshold (DFFITS)</div><div className="text-lg font-semibold">{F(influence.thresholdDffits, 3)}</div></Card>
              </div>

              {influence.flaggedStudies.length > 0 && (
                <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2">
                  {influence.flaggedStudies.map((s, i) => <div key={i}>⚠ {s}</div>)}
                </div>
              )}

              <Card title="Per-study diagnostics">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]">
                      <th className="text-left p-1">Study</th><th className="text-right p-1">Stud. resid.</th>
                      <th className="text-right p-1">Hat</th><th className="text-right p-1">Cook's D</th>
                      <th className="text-right p-1">DFFITS</th><th className="text-center p-1">Flag</th>
                    </tr></thead>
                    <tbody>
                      {influence.studies.map(s => (
                        <tr key={s.index} className={`border-b border-[var(--color-border)]/50 ${(s.isInfluential || s.isOutlier) ? "bg-yellow-900/10" : ""}`}>
                          <td className="p-1">{names[s.index] ?? `Study ${s.index}`}</td>
                          <td className="text-right p-1">{F(s.studentizedResidual, 2)}</td>
                          <td className="text-right p-1">{F(s.hatValue, 3)}</td>
                          <td className={`text-right p-1 ${s.cooksDistance > influence.thresholdCooks ? "text-yellow-400 font-semibold" : ""}`}>{F(s.cooksDistance, 3)}</td>
                          <td className={`text-right p-1 ${Math.abs(s.dffits) > influence.thresholdDffits ? "text-yellow-400 font-semibold" : ""}`}>{F(s.dffits, 2)}</td>
                          <td className="text-center p-1">
                            {s.isInfluential && <span className="text-yellow-400" title="Influential">●</span>}
                            {s.isOutlier && !s.isInfluential && <span className="text-orange-400" title="Outlier">○</span>}
                            {!s.isInfluential && !s.isOutlier && <span className="text-green-400">✓</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ─── Permutation ─────────────────────────────────────────── */}
      {tab === "permutation" && hasData && (
        <div className="space-y-4">
          <Card title="Permutation Test" subtitle="Non-parametric p-value via permutation of study labels">
            <div className="grid grid-cols-2 gap-3">
              <NumInput label="Permutations" value={permN} onChange={setPermN} min={100} step={500} />
              <SelectField label="Test statistic" value={permTest} onChange={setPermTest} options={[
                { value: "pooled", label: "Pooled effect" },
                { value: "q", label: "Cochran's Q" },
                { value: "tau2", label: "τ²" },
              ]} />
            </div>
            <Button onClick={runPermutation} disabled={busy} className="mt-3">{busy ? "Permuting..." : "Run Permutation Test"}</Button>
          </Card>

          {perm && (
            <div className="grid grid-cols-3 gap-3">
              <Card><div className="text-xs text-[var(--color-muted-foreground)]">Observed stat</div><div className="text-lg font-semibold">{F(perm.observedStatistic)}</div></Card>
              <Card><div className="text-xs text-[var(--color-muted-foreground)]">Permutation p</div><div className={`text-lg font-semibold ${perm.pValue < 0.05 ? "text-green-400" : ""}`}>{F(perm.pValue, 4)}</div></Card>
              <Card><div className="text-xs text-[var(--color-muted-foreground)]">N permutations</div><div className="text-lg font-semibold">{perm.nPermutations}</div></Card>
            </div>
          )}
        </div>
      )}

      {/* ─── Bootstrap ───────────────────────────────────────────── */}
      {tab === "bootstrap" && hasData && (
        <div className="space-y-4">
          <Card title="Bootstrap Confidence Intervals" subtitle="Non-parametric bootstrap for the pooled estimate">
            <div className="grid grid-cols-2 gap-3">
              <NumInput label="Bootstrap samples" value={bootN} onChange={setBootN} min={500} step={500} />
              <SelectField label="CI method" value={bootMethod} onChange={setBootMethod} options={[
                { value: "percentile", label: "Percentile" },
                { value: "bca", label: "BCa (bias-corrected)" },
                { value: "normal", label: "Normal approximation" },
              ]} />
            </div>
            <Button onClick={runBootstrap} disabled={busy} className="mt-3">{busy ? "Bootstrapping..." : "Run Bootstrap"}</Button>
          </Card>

          {boot && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><div className="text-xs text-[var(--color-muted-foreground)]">Observed</div><div className="text-lg font-semibold">{F(boot.observed)}</div></Card>
              <Card><div className="text-xs text-[var(--color-muted-foreground)]">Bias</div><div className="text-lg font-semibold">{F(boot.bias, 4)}</div></Card>
              <Card><div className="text-xs text-[var(--color-muted-foreground)]">95% CI</div><div className="text-sm font-semibold">[{F(boot.ciLower)}, {F(boot.ciUpper)}]</div></Card>
              <Card><div className="text-xs text-[var(--color-muted-foreground)]">Method</div><div className="text-sm font-semibold capitalize">{boot.method}</div></Card>
            </div>
          )}
        </div>
      )}

      {/* ─── TES ─────────────────────────────────────────────────── */}
      {tab === "tes" && hasData && (
        <div className="space-y-4">
          <Card title="Test of Excess Significance" subtitle="Ioannidis & Trikalinos (2007) — detects selective reporting">
            <NumInput label="Alpha level" value={tesAlpha} onChange={setTesAlpha} min={0.01} max={0.1} step={0.01} />
            <Button onClick={runTes} disabled={busy} className="mt-3">{busy ? "Simulating..." : "Run TES"}</Button>
          </Card>

          {tes && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">Observed sig.</div><div className="text-lg font-semibold">{tes.observedSignificant}</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">Expected sig.</div><div className="text-lg font-semibold">{F(tes.expectedSignificant, 1)}</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">Obs/Exp ratio</div><div className={`text-lg font-semibold ${tes.ratio > 1.5 ? "text-yellow-400" : ""}`}>{F(tes.ratio, 2)}</div></Card>
                <Card><div className="text-xs text-[var(--color-muted-foreground)]">P-value</div><div className={`text-lg font-semibold ${tes.pValue < 0.05 ? "text-yellow-400" : ""}`}>{F(tes.pValue, 4)}</div></Card>
              </div>
              <div className={`text-xs rounded p-2 ${tes.excessSignificance ? "text-yellow-400 bg-yellow-900/20 border border-yellow-800" : "text-green-400 bg-green-900/20 border border-green-800"}`}>
                {tes.interpretation}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Re-export for use in App.tsx
export { AdvancedBayesian };
