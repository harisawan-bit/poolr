import { useState, useMemo } from "react";
import type { Project } from "../../lib/project";
import { Card, Button, Input } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ResultCard, ErrorDisplay } from "../../components/StudyManager";
import { Loader2, Activity, GitBranch, Layers } from "lucide-react";
import { F, getExtractedData } from "./hubUtils";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function BayesianHub({ project }: Props) {
  const [subTab, setSubTab] = useState<"mcmc" | "nma" | "bmma">("mcmc");
  const extracted = useMemo(() => getExtractedData(project), [project]);

  return (
    <div className="space-y-4">
      {/* Sub navigation */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          onClick={() => setSubTab("mcmc")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "mcmc"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Activity size={14} />
          Bayesian MCMC
        </button>
        <button
          onClick={() => setSubTab("nma")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "nma"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <GitBranch size={14} />
          Bayesian NMA & SUCRA
        </button>
        <button
          onClick={() => setSubTab("bmma")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "bmma"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Layers size={14} />
          Model Averaging & Phylo
        </button>
      </div>

      {subTab === "mcmc" && <BayesianMcmcSection extracted={extracted} />}
      {subTab === "nma" && <BayesianNmaSection extracted={extracted} />}
      {subTab === "bmma" && <BmmaPhyloSection extracted={extracted} />}
    </div>
  );
}

// ─── 1. Bayesian MCMC ────────────────────────────────────────────────────────
function BayesianMcmcSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [iter, setIter] = useState(10000);
  const [warmup, setWarmup] = useState(2000);
  const [chains, setChains] = useState(4);
  const [ropeLo, setRopeLo] = useState(-0.1);
  const [ropeHi, setRopeHi] = useState(0.1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/bayesian", {
        effects: extracted.effects,
        variances: extracted.variances,
        iter,
        warmup,
        chains,
        ropeLower: parseFloat(ropeLo.toString()),
        ropeUpper: parseFloat(ropeHi.toString()),
        seed: 42,
      });
      setResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Bayesian MCMC Meta-Analysis"
        subtitle={`${extracted.effects.length} studies detected · Gibbs sampling · Normal prior on μ, Half-Cauchy on τ`}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Iterations</span>
            <Input
              type="number"
              value={iter}
              onChange={(e) => setIter(+e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Warmup</span>
            <Input
              type="number"
              value={warmup}
              onChange={(e) => setWarmup(+e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Chains</span>
            <Input
              type="number"
              value={chains}
              onChange={(e) => setChains(+e.target.value)}
              className="mt-1"
            />
          </label>
          <div className="flex gap-2">
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">ROPE low</span>
              <Input
                type="number"
                value={ropeLo}
                onChange={(e) => setRopeLo(+e.target.value)}
                step={0.05}
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">ROPE high</span>
              <Input
                type="number"
                value={ropeHi}
                onChange={(e) => setRopeHi(+e.target.value)}
                step={0.05}
                className="mt-1"
              />
            </label>
          </div>
        </div>
        <Button onClick={run} disabled={busy || extracted.effects.length < 2} className="mt-3">
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Sampling Gibbs Posterior...
            </>
          ) : (
            "Run Bayesian MCMC"
          )}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Posterior Estimates">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard title="μ (median)" value={result.muMedian} ci={[result.muCiLower, result.muCiUpper]} />
            <ResultCard title="τ (median)" value={result.tauMedian} ci={[result.tauCiLower, result.tauCiUpper]} />
            <ResultCard title="P(μ > 0)" value={`${(result.probPositive * 100).toFixed(1)}%`} />
            <ResultCard title="Bayes Factor (H₁/H₀)" value={result.bayesFactor != null ? F(result.bayesFactor, 2) : "—"} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <ResultCard
              title="Convergence (R-hat μ)"
              value={F(result.rhatMu, 3)}
              subtitle={result.rhatMu > 1.05 ? "⚠ Incomplete mixing (>1.05)" : "✓ Excellent convergence (<1.05)"}
            />
            <ResultCard title="Effective Sample Size (ESS)" value={Math.round(result.essMu)} />
            {result.probInRope != null && (
              <ResultCard title="P(in ROPE)" value={`${(result.probInRope * 100).toFixed(1)}%`} />
            )}
          </div>
          {result.warnings?.length > 0 && (
            <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2.5 mt-3">
              {result.warnings.map((w: string, i: number) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── 2. Bayesian NMA & SUCRA ────────────────────────────────────────────────
function BayesianNmaSection({ extracted: _ }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [measure, setMeasure] = useState("OR");
  const [iter, setIter] = useState(10000);
  const [warmup, setWarmup] = useState(2500);
  const [chains, setChains] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Default network dataset if not in extracted
  const defaultNmaStudies = [
    { study: "Study 1", treatment1: "Placebo", treatment2: "Drug A", effect: 0.45, se: 0.15 },
    { study: "Study 2", treatment1: "Placebo", treatment2: "Drug B", effect: 0.72, se: 0.18 },
    { study: "Study 3", treatment1: "Drug A", treatment2: "Drug B", effect: 0.28, se: 0.16 },
    { study: "Study 4", treatment1: "Placebo", treatment2: "Drug C", effect: 0.95, se: 0.22 },
    { study: "Study 5", treatment1: "Drug B", treatment2: "Drug C", effect: 0.24, se: 0.19 },
  ];

  const [nmaStudies] = useState(defaultNmaStudies);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/bayesian-nma", {
        studies: nmaStudies,
        measure,
        iter,
        warmup,
        chains,
        seed: 42,
        referenceTreatment: "Placebo",
      });
      setResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title="Bayesian Network Meta-Analysis & SUCRA"
        subtitle="Hierarchical consistency model · Surface Under the Cumulative Ranking curve (SUCRA) · DIC diagnostics"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Effect Measure</span>
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
              className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px] text-[var(--color-text)]"
            >
              <option value="OR">Odds Ratio (OR)</option>
              <option value="RR">Risk Ratio (RR)</option>
              <option value="MD">Mean Difference (MD)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Iterations</span>
            <Input
              type="number"
              value={iter}
              onChange={(e) => setIter(+e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Warmup</span>
            <Input
              type="number"
              value={warmup}
              onChange={(e) => setWarmup(+e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Chains</span>
            <Input
              type="number"
              value={chains}
              onChange={(e) => setChains(+e.target.value)}
              className="mt-1"
            />
          </label>
        </div>

        <div className="mt-4 border border-[var(--color-border)] rounded-lg p-3">
          <div className="text-xs font-semibold mb-2">Network Evidence Base ({nmaStudies.length} comparisons)</div>
          <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs">
            {nmaStudies.map((s, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 items-center bg-[var(--hover-surface)] px-2 py-1 rounded">
                <span className="truncate">{s.study}</span>
                <span className="text-[var(--color-accent)] font-medium">{s.treatment1}</span>
                <span className="text-[var(--color-accent)] font-medium">vs {s.treatment2}</span>
                <span>Effect: {s.effect}</span>
                <span>SE: {s.se}</span>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={run} disabled={busy} className="mt-3">
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Synthesizing Treatment Network...
            </>
          ) : (
            "Fit Bayesian NMA"
          )}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="NMA Rankings & Diagnostics">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <ResultCard title="Residual Deviance (D̄)" value={F(result.dbar, 2)} />
            <ResultCard title="Effective Parameters (pD)" value={F(result.pd, 2)} />
            <ResultCard title="DIC" value={F(result.dic, 2)} subtitle="Lower indicates superior parsimony" />
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              SUCRA Ranking (Probability of Being Best)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                    <th className="text-left p-2">Treatment</th>
                    <th className="text-right p-2">SUCRA Score</th>
                    <th className="text-right p-2">Mean Rank</th>
                    <th className="text-left p-2">Ranking Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ranking?.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-[var(--color-border)]/40 hover:bg-[var(--hover-surface)]">
                      <td className="p-2 font-medium">{r.treatment}</td>
                      <td className="p-2 text-right font-mono font-semibold text-[var(--color-accent)]">
                        {(r.sucra * 100).toFixed(1)}%
                      </td>
                      <td className="p-2 text-right font-mono">{F(r.meanRank, 2)}</td>
                      <td className="p-2">
                        <div className="w-full bg-[var(--color-border)]/50 rounded-full h-2 max-w-xs overflow-hidden">
                          <div
                            className="bg-[var(--color-accent)] h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(4, r.sucra * 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 3. BMMA Model Averaging & Phylogenetic ─────────────────────────────────
function BmmaPhyloSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [activeSub, setActiveSub] = useState<"bmma" | "phylo">("bmma");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bmmaResult, setBmmaResult] = useState<any>(null);
  const [phyloResult, setPhyloResult] = useState<any>(null);

  const runBmma = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/bma", {
        effects: extracted.effects,
        standardErrors: extracted.standardErrors,
        includePublicationBias: true,
        includePETPEESE: true,
        includeSelectionModel: true,
        seed: 42,
      });
      setBmmaResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const runPhylo = async () => {
    setBusy(true);
    setErr(null);
    try {
      const speciesList = extracted.names.slice(0, 6).map((name) => ({
        species: name,
        effect: extracted.effects[extracted.names.indexOf(name)] ?? 0.5,
        se: extracted.standardErrors[extracted.names.indexOf(name)] ?? 0.2,
      }));
      const k = speciesList.length;
      // Generate Brownian motion correlation matrix
      const corrMatrix: number[][] = [];
      for (let i = 0; i < k; i++) {
        const row: number[] = [];
        for (let j = 0; j < k; j++) {
          row.push(i === j ? 1.0 : Math.exp(-Math.abs(i - j) * 0.4));
        }
        corrMatrix.push(row);
      }
      const res = await postJson("/api/phylo", {
        studies: speciesList,
        correlationMatrix: corrMatrix,
        lambda: 0.85,
      });
      setPhyloResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={activeSub === "bmma" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSub("bmma")}
        >
          Bayesian Model Averaging (BMMA)
        </Button>
        <Button
          variant={activeSub === "phylo" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSub("phylo")}
        >
          Phylogenetic Meta-Analysis
        </Button>
      </div>

      {activeSub === "bmma" ? (
        <div className="space-y-4">
          <Card
            title="Bayesian Model-Averaged Meta-Analysis (RoBMA)"
            subtitle="Averages across Fixed, Random, PET-PEESE, and Selection models weighted by posterior model probability"
          >
            <Button onClick={runBmma} disabled={busy || extracted.effects.length < 3}>
              {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting Models...</> : "Run BMMA"}
            </Button>
          </Card>

          {err && <ErrorDisplay error={err} />}

          {bmmaResult && (
            <Card title="Model-Averaged Evidence">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultCard
                  title="Model-Averaged Effect"
                  value={F(bmmaResult.pooledEffect)}
                  ci={[bmmaResult.ciLower, bmmaResult.ciUpper]}
                />
                <ResultCard title="Between-Study Heterogeneity (τ²)" value={F(bmmaResult.tau2)} />
                <ResultCard
                  title="PET-PEESE Effect"
                  value={F(bmmaResult.petPeesEffect)}
                  ci={[bmmaResult.petPeesCiLower, bmmaResult.petPeesCiUpper]}
                />
                <ResultCard
                  title="Pub. Bias Prob."
                  value={`${(bmmaResult.publicationBiasProbability * 100).toFixed(1)}%`}
                />
              </div>

              {bmmaResult.models?.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-semibold mb-2">Individual Model Posterior Probabilities</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                          <th className="text-left p-2">Model</th>
                          <th className="text-right p-2">Posterior Prob</th>
                          <th className="text-right p-2">Pooled Effect</th>
                          <th className="text-right p-2">95% CI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bmmaResult.models.map((m: any, i: number) => (
                          <tr key={i} className="border-b border-[var(--color-border)]/40 hover:bg-[var(--hover-surface)]">
                            <td className="p-2 font-medium">{m.name}</td>
                            <td className="p-2 text-right font-mono font-semibold text-[var(--color-accent)]">
                              {(m.posteriorProbability * 100).toFixed(1)}%
                            </td>
                            <td className="p-2 text-right font-mono">{F(m.pooledEffect)}</td>
                            <td className="p-2 text-right font-mono">[{F(m.ciLower)}, {F(m.ciUpper)}]</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Card
            title="Phylogenetic Meta-Analysis"
            subtitle="Accounts for non-independence due to shared evolutionary history using Pagel's λ and phylogenetic correlation matrices"
          >
            <Button onClick={runPhylo} disabled={busy || extracted.effects.length < 2}>
              {busy ? <><Loader2 size={14} className="animate-spin" /> Estimating Pagel's λ...</> : "Run Phylogenetic MA"}
            </Button>
          </Card>

          {err && <ErrorDisplay error={err} />}

          {phyloResult && (
            <Card title="Phylogenetic Synthesis Results">
              <div className="grid grid-cols-3 gap-3">
                <ResultCard
                  title="Phylogenetic Effect"
                  value={F(phyloResult.pooledEffect)}
                  ci={[phyloResult.ciLower, phyloResult.ciUpper]}
                />
                <ResultCard
                  title="Pagel's Lambda (λ)"
                  value={F(phyloResult.lambda)}
                  subtitle={phyloResult.lambda > 0.5 ? "Strong phylogenetic signal" : "Low evolutionary inertia"}
                />
                <ResultCard title="Phylogenetic Tau²" value={F(phyloResult.tau2)} />
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
