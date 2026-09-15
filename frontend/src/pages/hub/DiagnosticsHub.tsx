import { useState, useMemo } from "react";
import type { Project } from "../../lib/project";
import { Card, Button, Input } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ResultCard, ErrorDisplay } from "../../components/StudyManager";
import { Loader2, Grid3X3, Zap, GitBranch, TrendingUp } from "lucide-react";
import { F, getExtractedData } from "./hubUtils";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function DiagnosticsHub({ project }: Props) {
  const [subTab, setSubTab] = useState<"gosh" | "influence" | "robust" | "tes">("gosh");
  const extracted = useMemo(() => getExtractedData(project), [project]);

  return (
    <div className="space-y-4">
      {/* Sub navigation */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          onClick={() => setSubTab("gosh")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "gosh"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Grid3X3 size={14} />
          GOSH Heterogeneity
        </button>
        <button
          onClick={() => setSubTab("influence")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "influence"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Zap size={14} />
          Influence & Outliers
        </button>
        <button
          onClick={() => setSubTab("robust")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "robust"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <GitBranch size={14} />
          Permutation & Bootstrap
        </button>
        <button
          onClick={() => setSubTab("tes")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "tes"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <TrendingUp size={14} />
          Excess Sig. & Location-Scale
        </button>
      </div>

      {subTab === "gosh" && <GoshSection extracted={extracted} />}
      {subTab === "influence" && <InfluenceSection extracted={extracted} />}
      {subTab === "robust" && <RobustSection extracted={extracted} />}
      {subTab === "tes" && <TesLocationScaleSection extracted={extracted} />}
    </div>
  );
}

// ─── 1. GOSH Section ────────────────────────────────────────────────────────
function GoshSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/gosh", {
        effects: extracted.effects,
        variances: extracted.variances,
        maxSubsets: 10000,
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
        title="GOSH (Graphical Display of Study Heterogeneity)"
        subtitle="Fits all 2ᵏ study subsets to identify multi-cluster heterogeneity patterns"
      >
        <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
          Detects whether heterogeneity is driven by discrete clusters of studies or isolated outliers by evaluating effect estimates and τ² across all possible study subsets.
        </p>
        <Button onClick={run} disabled={busy || extracted.effects.length < 3}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Evaluating Subsets...</> : "Run GOSH Analysis"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="GOSH Heterogeneity Profile">
          <div className="grid grid-cols-3 gap-3">
            <ResultCard title="Overall Pooled" value={F(result.overallPooled)} />
            <ResultCard title="Overall Tau²" value={F(result.overallTau2)} />
            <ResultCard title="Subsets Evaluated" value={result.nSubsetsGenerated ?? 0} />
          </div>

          {result.clusterWarnings?.length > 0 && (
            <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2.5 mt-3">
              {result.clusterWarnings.map((w: string, i: number) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── 2. Influence & Outliers Section ────────────────────────────────────────
function InfluenceSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/influence", {
        effects: extracted.effects,
        variances: extracted.variances,
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
        title="Influence & Sensitivity Diagnostics"
        subtitle="Cook's distance, DFFITS, studentized residuals, hat values, and covariance ratios"
      >
        <Button onClick={run} disabled={busy || extracted.effects.length < 3}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Computing Diagnostics...</> : "Run Influence Diagnostics"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard title="Influential Studies" value={result.nInfluential} />
            <ResultCard title="Outliers" value={result.nOutliers} />
            <ResultCard title="Cook's Threshold" value={F(result.thresholdCooks, 3)} />
            <ResultCard title="DFFITS Threshold" value={F(result.thresholdDffits, 3)} />
          </div>

          {result.flaggedStudies?.length > 0 && (
            <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2.5">
              {result.flaggedStudies.map((s: string, i: number) => (
                <div key={i}>⚠ Flagged: {s} exerts substantial leverage on pooled estimate</div>
              ))}
            </div>
          )}

          <Card title="Study-by-Study Diagnostic Table">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                    <th className="text-left p-2">Study</th>
                    <th className="text-right p-2">Studentized Resid.</th>
                    <th className="text-right p-2">Hat Value</th>
                    <th className="text-right p-2">Cook's D</th>
                    <th className="text-right p-2">DFFITS</th>
                    <th className="text-center p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.studies?.map((s: any, i: number) => {
                    const isFlagged = s.isInfluential || s.isOutlier;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-[var(--color-border)]/40 hover:bg-[var(--hover-surface)] ${
                          isFlagged ? "bg-yellow-500/10" : ""
                        }`}
                      >
                        <td className="p-2 font-medium">{extracted.names[i] ?? `Study ${i + 1}`}</td>
                        <td className="p-2 text-right font-mono">{F(s.studentizedResidual, 2)}</td>
                        <td className="p-2 text-right font-mono">{F(s.hatValue, 3)}</td>
                        <td
                          className={`p-2 text-right font-mono ${
                            s.cooksDistance > result.thresholdCooks ? "text-yellow-400 font-bold" : ""
                          }`}
                        >
                          {F(s.cooksDistance, 3)}
                        </td>
                        <td
                          className={`p-2 text-right font-mono ${
                            Math.abs(s.dffits) > result.thresholdDffits ? "text-yellow-400 font-bold" : ""
                          }`}
                        >
                          {F(s.dffits, 2)}
                        </td>
                        <td className="p-2 text-center">
                          {s.isInfluential ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-semibold">
                              Influential
                            </span>
                          ) : s.isOutlier ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400 font-semibold">
                              Outlier
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 font-semibold">
                              ✓ Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── 3. Permutation & Bootstrap Section ─────────────────────────────────────
function RobustSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [subType, setSubType] = useState<"perm" | "boot">("perm");
  const [nPerm, setNPerm] = useState(5000);
  const [nBoot, setNBoot] = useState(5000);
  const [bootMethod, setBootMethod] = useState("percentile");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [permResult, setPermResult] = useState<any>(null);
  const [bootResult, setBootResult] = useState<any>(null);

  const runPerm = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/permutation", {
        effects: extracted.effects,
        variances: extracted.variances,
        nPermutations: nPerm,
        test: "pooled",
        seed: 42,
      });
      setPermResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const runBoot = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/bootstrap", {
        effects: extracted.effects,
        variances: extracted.variances,
        nBootstrap: nBoot,
        method: bootMethod,
        seed: 42,
      });
      setBootResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={subType === "perm" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSubType("perm")}
        >
          Permutation Test
        </Button>
        <Button
          variant={subType === "boot" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSubType("boot")}
        >
          Bootstrap Confidence Intervals
        </Button>
      </div>

      {subType === "perm" ? (
        <Card
          title="Permutation Test"
          subtitle="Non-parametric exact or Monte Carlo permutation test for small meta-analyses"
        >
          <div className="max-w-xs mb-3">
            <span className="text-xs text-[var(--color-muted-foreground)]">Number of Permutations</span>
            <Input
              type="number"
              value={nPerm}
              onChange={(e) => setNPerm(+e.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={runPerm} disabled={busy || extracted.effects.length < 2}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Permuting...</> : "Run Permutation Test"}
          </Button>
        </Card>
      ) : (
        <Card
          title="Bootstrap Confidence Intervals"
          subtitle="Non-parametric bootstrap for robust, distribution-free confidence intervals"
        >
          <div className="grid grid-cols-2 gap-3 max-w-md mb-3">
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Resamples</span>
              <Input
                type="number"
                value={nBoot}
                onChange={(e) => setNBoot(+e.target.value)}
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Method</span>
              <select
                value={bootMethod}
                onChange={(e) => setBootMethod(e.target.value)}
                className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]"
              >
                <option value="percentile">Percentile</option>
                <option value="bca">BCa (Bias-corrected & accelerated)</option>
                <option value="normal">Normal approximation</option>
              </select>
            </label>
          </div>
          <Button onClick={runBoot} disabled={busy || extracted.effects.length < 2}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Bootstrapping...</> : "Run Bootstrap"}
          </Button>
        </Card>
      )}

      {err && <ErrorDisplay error={err} />}

      {subType === "perm" && permResult && (
        <Card title="Permutation Results">
          <div className="grid grid-cols-3 gap-3">
            <ResultCard title="Observed Statistic" value={F(permResult.observedStatistic)} />
            <ResultCard title="Permutation p-value" value={F(permResult.pValue, 4)} />
            <ResultCard title="Permutations Run" value={permResult.nPermutations} />
          </div>
        </Card>
      )}

      {subType === "boot" && bootResult && (
        <Card title="Bootstrap Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard title="Observed Effect" value={F(bootResult.observed)} />
            <ResultCard title="Estimated Bias" value={F(bootResult.bias, 4)} />
            <ResultCard title="Bootstrap 95% CI" value="" ci={[bootResult.ciLower, bootResult.ciUpper]} />
            <ResultCard title="Method" value={bootResult.method} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 4. Excess Significance & Location-Scale ────────────────────────────────
function TesLocationScaleSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [section, setSection] = useState<"tes" | "locscale">("tes");
  const [alpha, setAlpha] = useState(0.05);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tesResult, setTesResult] = useState<any>(null);
  const [locScaleResult, setLocScaleResult] = useState<any>(null);

  const runTes = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/tes", {
        effects: extracted.effects,
        variances: extracted.variances,
        alpha,
        nSimulations: 5000,
        seed: 42,
      });
      setTesResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const runLocScale = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/locationscale", {
        effects: extracted.effects,
        variances: extracted.variances,
        moderatorsLocation: extracted.sampleSizes.map((n) => [n]),
        moderatorsScale: extracted.sampleSizes.map((n) => [n]),
      });
      setLocScaleResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={section === "tes" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSection("tes")}
        >
          Test of Excess Significance (TES)
        </Button>
        <Button
          variant={section === "locscale" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSection("locscale")}
        >
          Location-Scale Meta-Regression
        </Button>
      </div>

      {section === "tes" ? (
        <Card
          title="Test of Excess Significance (TES)"
          subtitle="Ioannidis & Trikalinos binomial test comparing observed vs. expected statistically significant studies"
        >
          <div className="max-w-xs mb-3">
            <span className="text-xs text-[var(--color-muted-foreground)]">Significance Threshold (Alpha)</span>
            <Input
              type="number"
              value={alpha}
              onChange={(e) => setAlpha(+e.target.value)}
              step={0.01}
              className="mt-1"
            />
          </div>
          <Button onClick={runTes} disabled={busy || extracted.effects.length < 3}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Evaluating...</> : "Run TES"}
          </Button>
        </Card>
      ) : (
        <Card
          title="Location-Scale Meta-Regression"
          subtitle="Simultaneously models effect magnitude (location) and residual between-study heterogeneity (scale)"
        >
          <Button onClick={runLocScale} disabled={busy || extracted.effects.length < 3}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting Location-Scale Model...</> : "Fit Location-Scale"}
          </Button>
        </Card>
      )}

      {err && <ErrorDisplay error={err} />}

      {section === "tes" && tesResult && (
        <Card title="TES Diagnostic Findings">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard title="Observed Significant" value={tesResult.observedSignificant} />
            <ResultCard title="Expected Significant" value={F(tesResult.expectedSignificant, 1)} />
            <ResultCard title="O / E Ratio" value={F(tesResult.ratio, 2)} />
            <ResultCard title="Binomial p-value" value={F(tesResult.pValue, 4)} />
          </div>
          <div
            className={`text-xs rounded-lg p-3 mt-3 font-medium border ${
              tesResult.excessSignificance
                ? "text-yellow-400 bg-yellow-900/20 border-yellow-800"
                : "text-green-400 bg-green-900/20 border-green-800"
            }`}
          >
            {tesResult.interpretation}
          </div>
        </Card>
      )}

      {section === "locscale" && locScaleResult && (
        <Card title="Location-Scale Model Estimates">
          <div className="grid grid-cols-3 gap-3">
            <ResultCard title="Location Intercept" value={F(locScaleResult.locationIntercept)} />
            <ResultCard title="Scale Intercept (log τ²)" value={F(locScaleResult.scaleIntercept)} />
            <ResultCard title="Residual Tau²" value={F(locScaleResult.tau2)} />
          </div>
        </Card>
      )}
    </div>
  );
}
