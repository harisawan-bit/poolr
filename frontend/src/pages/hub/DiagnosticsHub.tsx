import { useState, useMemo } from "react";
import type { Project } from "../../lib/project";
import { Card, Button, Input } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ResultCard, ErrorDisplay } from "../../components/StudyManager";
import {
  Loader2,
  Grid3X3,
  Zap,
  GitBranch,
  TrendingUp,
  Split,
  Percent,
  Calculator,
  Compass,
} from "lucide-react";
import { F, getExtractedData } from "./hubUtils";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function DiagnosticsHub({ project }: Props) {
  const [subTab, setSubTab] = useState<
    "gosh" | "influence" | "robust" | "tes" | "mi" | "prediction" | "proportion" | "pvalue" | "cluster"
  >("gosh");
  const extracted = useMemo(() => getExtractedData(project), [project]);

  return (
    <div className="space-y-4">
      {/* Sub navigation */}
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-2 overflow-x-auto">
        <button
          onClick={() => setSubTab("gosh")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "gosh"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Grid3X3 size={14} />
          GOSH Heterogeneity
        </button>
        <button
          onClick={() => setSubTab("influence")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "influence"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Zap size={14} />
          Influence & Outliers
        </button>
        <button
          onClick={() => setSubTab("robust")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "robust"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <GitBranch size={14} />
          Permutation & Bootstrap
        </button>
        <button
          onClick={() => setSubTab("tes")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "tes"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <TrendingUp size={14} />
          Excess Sig. & Location-Scale
        </button>
        <button
          onClick={() => setSubTab("mi")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "mi"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Split size={14} />
          Multiple Imputation (MI)
        </button>
        <button
          onClick={() => setSubTab("prediction")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "prediction"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Compass size={14} />
          Prediction & Model Averaging
        </button>
        <button
          onClick={() => setSubTab("proportion")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "proportion"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Percent size={14} />
          Proportion Meta-Analysis
        </button>
        <button
          onClick={() => setSubTab("pvalue")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "pvalue"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Calculator size={14} />
          P-Value Combination
        </button>
        <button
          onClick={() => setSubTab("cluster")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            subTab === "cluster"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Grid3X3 size={14} />
          Cluster Detection & CR-Egger
        </button>
      </div>

      {subTab === "gosh" && <GoshSection extracted={extracted} />}
      {subTab === "influence" && <InfluenceSection extracted={extracted} />}
      {subTab === "robust" && <RobustSection extracted={extracted} />}
      {subTab === "tes" && <TesLocationScaleSection extracted={extracted} />}
      {subTab === "mi" && <MultipleImputationSection extracted={extracted} />}
      {subTab === "prediction" && <PredictionAveragingSection extracted={extracted} />}
      {subTab === "proportion" && <ProportionSection />}
      {subTab === "pvalue" && <PValueCombineSection extracted={extracted} />}
      {subTab === "cluster" && <ClusterSection extracted={extracted} />}
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

// ─── 5. Multiple Imputation Section ─────────────────────────────────────────
function MultipleImputationSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [m, setM] = useState(20);
  const [method, setMethod] = useState<"pmm" | "norm">("pmm");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Incomplete data table preview
  const [missingMask, setMissingMask] = useState<boolean[]>(() =>
    extracted.effects.map((_, i) => i === extracted.effects.length - 1 && extracted.effects.length > 3)
  );

  const toggleMissing = (idx: number) => {
    setMissingMask((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  };

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const effectsWithMissing = extracted.effects.map((e, i) => (missingMask[i] ? null : e));
      const variancesWithMissing = extracted.variances.map((v, i) => (missingMask[i] ? null : v));

      const res = await postJson("/api/mi", {
        effects: effectsWithMissing,
        variances: variancesWithMissing,
        m,
        seed: 42,
        method,
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
        title="Multiple Imputation for Missing Outcome Data"
        subtitle="Handles missing effect sizes or variances using Rubin's rules and Predictive Mean Matching (PMM)"
      >
        <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
          Select studies below to simulate or flag missing data. Rubin's combination rules pool between- and within-imputation variance to compute unbiased effect estimates and fractions of missing information (FMI).
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md mb-3">
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Imputations (m)</span>
            <Input type="number" value={m} onChange={(e) => setM(+e.target.value)} min={5} max={100} />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Algorithm</span>
            <select
              value={method}
              onChange={(e: any) => setMethod(e.target.value)}
              className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]"
            >
              <option value="pmm">Predictive Mean Matching (PMM)</option>
              <option value="norm">Normal Linear Imputation</option>
            </select>
          </label>
        </div>

        {/* Study missingness toggle table */}
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--color-card)] border-b border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                <th className="text-left p-2">Study</th>
                <th className="text-right p-2">Effect (y)</th>
                <th className="text-right p-2">Variance (v)</th>
                <th className="text-center p-2">Data Status</th>
                <th className="text-center p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {extracted.names.map((name, i) => (
                <tr key={i} className="border-b border-[var(--color-border)]/40 hover:bg-[var(--hover-surface)]">
                  <td className="p-2 font-medium">{name}</td>
                  <td className="p-2 text-right font-mono">{missingMask[i] ? "— (Missing)" : F(extracted.effects[i])}</td>
                  <td className="p-2 text-right font-mono">{missingMask[i] ? "— (Missing)" : F(extracted.variances[i], 4)}</td>
                  <td className="p-2 text-center">
                    {missingMask[i] ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-semibold">Missing</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 font-semibold">Complete</span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => toggleMissing(i)}
                      className="text-[10px] text-[var(--color-accent)] hover:underline"
                    >
                      {missingMask[i] ? "Restore" : "Mark Missing"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button onClick={run} disabled={busy || extracted.effects.length < 2}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Imputing {m} datasets...</> : "Run Multiple Imputation"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Rubin's Combined Imputation Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <ResultCard title="Pooled Effect (Q̄)" value={F(result.pooledEffect)} />
            <ResultCard title="95% CI" value="" ci={[result.ciLower, result.ciUpper]} />
            <ResultCard title="p-value" value={F(result.p, 4)} />
            <ResultCard title="Missing Info Fraction (λ)" value={`${(result.lambda * 100).toFixed(1)}%`} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ResultCard title="Within Variance (Ū)" value={F(result.withinVariance, 4)} />
            <ResultCard title="Between Variance (B)" value={F(result.betweenVariance, 4)} />
            <ResultCard title="Adjusted df (ν)" value={F(result.df, 1)} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 6. Prediction Intervals & Model Averaging ──────────────────────────────
function PredictionAveragingSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [subTab, setSubTab] = useState<"pi" | "bma">("pi");
  const [pooledEffect, setPooledEffect] = useState(0.45);
  const [se, setSe] = useState(0.12);
  const [tau2, setTau2] = useState(0.08);
  const [k, setK] = useState(extracted.effects.length || 8);
  const [logScale, setLogScale] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [piResult, setPiResult] = useState<any>(null);
  const [maResult, setMaResult] = useState<any>(null);

  const runPrediction = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/prediction", {
        pooledEffect,
        se,
        tau2,
        k,
        logScale,
      });
      setPiResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const runModelAverage = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/modelaverage", {
        effects: extracted.effects,
        variances: extracted.variances,
      });
      setMaResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={subTab === "pi" ? "default" : "ghost"} size="sm" onClick={() => setSubTab("pi")}>
          Prediction Interval (Graham & Higgins)
        </Button>
        <Button variant={subTab === "bma" ? "default" : "ghost"} size="sm" onClick={() => setSubTab("bma")}>
          Multimodel Averaging (AICc Weights)
        </Button>
      </div>

      {subTab === "pi" ? (
        <Card
          title="95% Prediction Interval"
          subtitle="Forecasts the true effect in an individual future clinical setting (accounting for between-study variance τ²)"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mb-3">
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Pooled Effect (θ̂)</span>
              <Input type="number" step={0.01} value={pooledEffect} onChange={(e) => setPooledEffect(+e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Standard Error (SE)</span>
              <Input type="number" step={0.01} value={se} onChange={(e) => setSe(+e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Between-Study Tau²</span>
              <Input type="number" step={0.01} value={tau2} onChange={(e) => setTau2(+e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Studies (k)</span>
              <Input type="number" value={k} onChange={(e) => setK(+e.target.value)} min={2} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs mb-3 text-[var(--color-text)]">
            <input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} />
            Exponential back-transformation (Log Odds/Risk Ratio scale)
          </label>
          <Button onClick={runPrediction} disabled={busy || k < 2}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Calculating...</> : "Calculate Prediction Interval"}
          </Button>
        </Card>
      ) : (
        <Card
          title="Frequentist Multi-Model Averaging"
          subtitle="Computes AICc-weighted pooled effect across DL, REML, ML, PM, and Fixed-Effect estimators"
        >
          <Button onClick={runModelAverage} disabled={busy || extracted.effects.length < 2}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting Models...</> : "Run Multi-Model Averaging"}
          </Button>
        </Card>
      )}

      {err && <ErrorDisplay error={err} />}

      {subTab === "pi" && piResult && (
        <Card title="Prediction Interval Estimates">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard title="95% Prediction Interval" value="" ci={[piResult.piLower, piResult.piUpper]} />
            <ResultCard title="Critical t-value" value={F(piResult.piT, 3)} />
            <ResultCard title="Degrees of Freedom" value={piResult.piDf} />
            <ResultCard title="Width (PI Upper - Lower)" value={F(piResult.piUpper - piResult.piLower, 3)} />
          </div>
        </Card>
      )}

      {subTab === "bma" && maResult && (
        <Card title="Averaged Model Estimates & Weight Allocation">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <ResultCard title="Averaged Pooled Effect" value={F(maResult.pooledEffect)} />
            <ResultCard title="Combined SE" value={F(maResult.se, 4)} />
            <ResultCard title="Model-Averaged 95% CI" value="" ci={[maResult.ciLower, maResult.ciUpper]} />
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                <th className="text-left p-2">Estimator</th>
                <th className="text-right p-2">Tau²</th>
                <th className="text-right p-2">AICc</th>
                <th className="text-right p-2">Akaike Weight</th>
                <th className="text-right p-2">Effect</th>
              </tr>
            </thead>
            <tbody>
              {maResult.modelWeights?.map((mw: any, i: number) => (
                <tr key={i} className="border-b border-[var(--color-border)]/40 hover:bg-[var(--hover-surface)]">
                  <td className="p-2 font-medium">{mw.method.toUpperCase()}</td>
                  <td className="p-2 text-right font-mono">{F(mw.tau2, 4)}</td>
                  <td className="p-2 text-right font-mono">{F(mw.aicc, 2)}</td>
                  <td className="p-2 text-right font-mono font-semibold text-[var(--color-accent)]">
                    {(mw.weight * 100).toFixed(1)}%
                  </td>
                  <td className="p-2 text-right font-mono">{F(mw.pooledEffect)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─── 7. Proportion Meta-Analysis Section ─────────────────────────────────────
function ProportionSection() {
  const [studies, setStudies] = useState([
    { study: "Study 1 (Johnson 2019)", events: 14, n: 120 },
    { study: "Study 2 (Kumar 2020)", events: 28, n: 150 },
    { study: "Study 3 (Chen 2021)", events: 8, n: 95 },
    { study: "Study 4 (Santos 2022)", events: 45, n: 210 },
    { study: "Study 5 (O'Connor 2023)", events: 19, n: 130 },
  ]);
  const [method, setMethod] = useState("glmm");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const updateStudy = (idx: number, field: string, val: any) => {
    setStudies((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const addStudy = () => {
    setStudies((prev) => [...prev, { study: `Study ${prev.length + 1}`, events: 10, n: 100 }]);
  };

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/proportion", {
        studies,
        method,
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
        title="Single-Arm Proportion Meta-Analysis"
        subtitle="Pooled event rates via Generalized Linear Mixed Models (GLMM logit-normal) and Freeman-Tukey double-arcsine"
      >
        <div className="max-w-xs mb-3">
          <span className="text-xs text-[var(--color-muted-foreground)]">Pooling Method</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]"
          >
            <option value="glmm">GLMM (Logit-Normal Random Effects)</option>
            <option value="doubleArcsine">Freeman-Tukey Double-Arcsine</option>
            <option value="arcsine">Standard Arcsine Transform</option>
          </select>
        </div>

        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--color-card)] border-b border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                <th className="text-left p-2">Study Label</th>
                <th className="text-right p-2">Events (r)</th>
                <th className="text-right p-2">Sample Size (N)</th>
                <th className="text-right p-2">Raw Proportion</th>
              </tr>
            </thead>
            <tbody>
              {studies.map((s, idx) => (
                <tr key={idx} className="border-b border-[var(--color-border)]/40 hover:bg-[var(--hover-surface)]">
                  <td className="p-2">
                    <input
                      type="text"
                      value={s.study}
                      onChange={(e) => updateStudy(idx, "study", e.target.value)}
                      className="w-full bg-transparent text-xs"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      value={s.events}
                      onChange={(e) => updateStudy(idx, "events", +e.target.value)}
                      className="w-20 text-right bg-transparent text-xs font-mono"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      value={s.n}
                      onChange={(e) => updateStudy(idx, "n", +e.target.value)}
                      className="w-20 text-right bg-transparent text-xs font-mono"
                    />
                  </td>
                  <td className="p-2 text-right font-mono font-medium">
                    {s.n > 0 ? `${((s.events / s.n) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2">
          <Button onClick={run} disabled={busy || studies.length < 2}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Pooling Proportions...</> : "Pool Proportions"}
          </Button>
          <Button variant="secondary" onClick={addStudy}>
            + Add Study
          </Button>
        </div>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Pooled Proportion & Heterogeneity">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <ResultCard title="Pooled Proportion" value={`${(result.pooledProportion * 100).toFixed(2)}%`} />
            <ResultCard
              title="95% CI (%)"
              value=""
              ci={[result.ciLower * 100, result.ciUpper * 100]}
            />
            <ResultCard title="Heterogeneity I²" value={`${F(result.i2, 1)}%`} />
            <ResultCard title="Tau² (Between-Study)" value={F(result.tau2, 4)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ResultCard title="Total Events" value={result.totalEvents} />
            <ResultCard title="Total Sample Size" value={result.totalN} />
            <ResultCard title="Method" value={result.method} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 8. P-Value Combination Section ─────────────────────────────────────────
function PValueCombineSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  // Pre-fill p-values from extracted effects/SEs or default
  const [pValuesText, setPValuesText] = useState("0.003, 0.012, 0.045, 0.082, 0.001, 0.150");
  const [method, setMethod] = useState("fisher");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleUseExtracted = () => {
    // Generate approximate p-values from z-scores
    const ps = extracted.effects.map((eff, i) => {
      const se = Math.sqrt(Math.max(extracted.variances[i], 1e-8));
      const z = Math.abs(eff / se);
      // 2 * (1 - normalCdf(z))
      const p = Math.max(0.0001, Math.min(0.9999, 2 * Math.exp(-0.5 * z * z) / (2.5066 * (z + 0.65))));
      return p.toFixed(4);
    });
    if (ps.length > 0) setPValuesText(ps.join(", "));
  };

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const pValues = pValuesText
        .split(",")
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n) && n > 0 && n <= 1);

      if (pValues.length < 2) throw new Error("Please provide at least 2 valid p-values between 0 and 1.");

      const res = await postJson("/api/powerhouse/pvalue-combine", {
        pValues,
        method,
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
        title="P-Value Combination Suite"
        subtitle="Combines independent significance levels using Fisher, Stouffer Z, Tippett minimum p, or Edgington sum tests"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-[var(--color-muted-foreground)]">P-values (comma separated)</span>
              {extracted.effects.length > 1 && (
                <button
                  type="button"
                  onClick={handleUseExtracted}
                  className="text-[10px] text-[var(--color-accent)] hover:underline"
                >
                  Pull from extracted studies ({extracted.effects.length})
                </button>
              )}
            </div>
            <Input value={pValuesText} onChange={(e) => setPValuesText(e.target.value)} />
          </div>

          <div>
            <span className="text-xs text-[var(--color-muted-foreground)]">Combination Method</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]"
            >
              <option value="fisher">Fisher (-2 Σ ln p ~ χ²₂ₖ)</option>
              <option value="stouffer">Stouffer Z-score (Σ z / √k ~ N(0,1))</option>
              <option value="tippett">Tippett (min p ~ Beta(1, k))</option>
              <option value="edgington">Edgington Additive Sum Test</option>
            </select>
          </div>
        </div>

        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Combining p-values...</> : "Combine P-Values"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Combined Significance Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <ResultCard title="Combined P-Value" value={result.combinedP < 0.0001 ? "< 0.0001" : F(result.combinedP, 4)} />
            <ResultCard title="Test Statistic" value={F(result.combinedStatistic, 3)} />
            <ResultCard title="Distribution" value={result.distribution || "χ²"} />
            <ResultCard title="Degrees of Freedom" value={result.df} />
          </div>

          <div
            className={`text-xs rounded-lg p-3 font-medium border ${
              result.combinedP < 0.05
                ? "text-green-400 bg-green-900/20 border-green-800"
                : "text-yellow-400 bg-yellow-900/20 border-yellow-800"
            }`}
          >
            {result.interpretation || (result.combinedP < 0.05 ? "Statistically significant pooled evidence." : "Failed to achieve significance threshold.")}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 9. Funnel Cluster Detection & Cluster-Robust Egger ─────────────────────
function ClusterSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [tab, setTab] = useState<"detect" | "cr_egger">("detect");
  const [epsMult, setEpsMult] = useState(1.5);
  const [minPts, setMinPts] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [clusterResult, setClusterResult] = useState<any>(null);
  const [eggerResult, setEggerResult] = useState<any>(null);

  // Cluster assignment for cluster-robust egger
  const [clusters, setClusters] = useState<string[]>(() =>
    extracted.names.map((_, i) => `Center ${Math.floor(i / 2) + 1}`)
  );

  const updateCluster = (idx: number, val: string) => {
    setClusters((prev) => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const runClusterDetect = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/cluster/detect", {
        effects: extracted.effects,
        variances: extracted.variances,
        names: extracted.names,
        epsilonMultiplier: epsMult,
        minPoints: minPts,
      });
      setClusterResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const runCrEgger = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/clusterrobust/egger", {
        effects: extracted.effects,
        variances: extracted.variances,
        clusters,
      });
      setEggerResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={tab === "detect" ? "default" : "ghost"} size="sm" onClick={() => setTab("detect")}>
          DBSCAN Funnel Cluster Detection
        </Button>
        <Button variant={tab === "cr_egger" ? "default" : "ghost"} size="sm" onClick={() => setTab("cr_egger")}>
          Cluster-Robust Egger Test (CRVE)
        </Button>
      </div>

      {tab === "detect" ? (
        <Card
          title="Funnel Plot Cluster Detection (DBSCAN)"
          subtitle="Identifies discrete clusters in effect-precision space to uncover hidden study subgroups or publication mechanisms"
        >
          <div className="grid grid-cols-2 gap-3 max-w-xs mb-3">
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Epsilon Multiplier</span>
              <Input type="number" step={0.1} value={epsMult} onChange={(e) => setEpsMult(+e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-muted-foreground)]">Min Points</span>
              <Input type="number" value={minPts} onChange={(e) => setMinPts(+e.target.value)} min={2} />
            </label>
          </div>
          <Button onClick={runClusterDetect} disabled={busy || extracted.effects.length < 3}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Detecting Clusters...</> : "Run Cluster Detection"}
          </Button>
        </Card>
      ) : (
        <Card
          title="Cluster-Robust Egger Test for Publication Bias"
          subtitle="Adjusts Egger's regression for dependent effect sizes (multiple cohorts or outcomes per study center) using CRVE"
        >
          <p className="text-xs text-[var(--color-muted-foreground)] mb-3">
            Standard Egger tests assume independent studies and severely inflate false positive bias rates when multiple effects originate from the same cluster.
          </p>

          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden max-h-56 overflow-y-auto mb-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-card)] border-b border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                  <th className="text-left p-2">Study</th>
                  <th className="text-right p-2">Effect</th>
                  <th className="text-left p-2">Cluster / Center ID</th>
                </tr>
              </thead>
              <tbody>
                {extracted.names.map((name, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]/40 hover:bg-[var(--hover-surface)]">
                    <td className="p-2 font-medium">{name}</td>
                    <td className="p-2 text-right font-mono">{F(extracted.effects[i])}</td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={clusters[i] || `Center ${Math.floor(i / 2) + 1}`}
                        onChange={(e) => updateCluster(i, e.target.value)}
                        className="w-36 rounded border border-[var(--color-border)] bg-[var(--input-bg)] px-2 py-0.5 text-xs font-mono"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button onClick={runCrEgger} disabled={busy || extracted.effects.length < 5}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Running CRVE Egger...</> : "Run Cluster-Robust Egger"}
          </Button>
        </Card>
      )}

      {err && <ErrorDisplay error={err} />}

      {tab === "detect" && clusterResult && (
        <Card title="Funnel Cluster Results">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <ResultCard title="Clusters Detected" value={clusterResult.nClusters} />
            <ResultCard title="Noise Points" value={clusterResult.nNoise} />
            <ResultCard title="Has Distinct Clusters" value={clusterResult.hasDistinctClusters ? "Yes" : "No"} />
          </div>

          <div className="text-xs bg-[var(--color-card)] p-3 rounded-lg border border-[var(--color-border)] mb-3">
            {clusterResult.interpretation}
          </div>

          {clusterResult.clusters?.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--color-text)]">Cluster Profiles:</span>
              {clusterResult.clusters.map((c: any) => (
                <div key={c.clusterId} className="p-2 rounded bg-[var(--hover-surface)] border border-[var(--color-border)] text-xs flex justify-between items-center">
                  <span className="font-semibold">Cluster {c.clusterId} ({c.size} studies)</span>
                  <span className="font-mono">Pooled Effect: {F(c.pooledEffect)} [95% CI: {F(c.ciLower)} to {F(c.ciUpper)}], I²: {F(c.i2, 1)}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "cr_egger" && eggerResult && (
        <Card title="Cluster-Robust Egger Estimates vs Naive OLS">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <ResultCard title="Robust Intercept" value={F(eggerResult.robustIntercept, 3)} />
            <ResultCard title="Robust SE" value={F(eggerResult.robustInterceptSe, 3)} />
            <ResultCard title="Robust p-value" value={F(eggerResult.robustInterceptP, 4)} />
            <ResultCard title="Significant Bias" value={eggerResult.significant ? "Yes (p < .05)" : "No"} />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <ResultCard title="Naive Intercept" value={F(eggerResult.standardIntercept, 3)} />
            <ResultCard title="Naive SE" value={F(eggerResult.standardInterceptSe, 3)} />
            <ResultCard title="Naive p-value" value={F(eggerResult.standardInterceptP, 4)} />
          </div>

          <div
            className={`text-xs rounded-lg p-3 font-medium border ${
              eggerResult.significant
                ? "text-yellow-400 bg-yellow-900/20 border-yellow-800"
                : "text-green-400 bg-green-900/20 border-green-800"
            }`}
          >
            {eggerResult.interpretation}
          </div>
        </Card>
      )}
    </div>
  );
}
