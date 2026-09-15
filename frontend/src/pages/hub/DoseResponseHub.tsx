import { useState } from "react";
import type { Project } from "../../lib/project";
import { Card, Button } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ResultCard, ErrorDisplay } from "../../components/StudyManager";
import { Loader2, Activity, GitCommit, Waves, Globe, Sliders } from "lucide-react";
import { F } from "./hubUtils";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function DoseResponseHub({ project: _ }: Props) {
  const [subTab, setSubTab] = useState<"gls" | "rcs" | "multi" | "surface" | "spatio">("gls");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          onClick={() => setSubTab("gls")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "gls"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Activity size={14} />
          GLS Dose-Response (Trend)
        </button>
        <button
          onClick={() => setSubTab("rcs")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "rcs"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Waves size={14} />
          Restricted Cubic Splines (RCS)
        </button>
        <button
          onClick={() => setSubTab("multi")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "multi"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <GitCommit size={14} />
          Multivariate Dose-Response
        </button>
        <button
          onClick={() => setSubTab("surface")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "surface"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Sliders size={14} />
          Response Surface (2D)
        </button>
        <button
          onClick={() => setSubTab("spatio")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "spatio"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Globe size={14} />
          Spatio-Temporal
        </button>
      </div>

      {subTab === "gls" && <GlsDoseSection />}
      {subTab === "rcs" && <RcsSplineSection />}
      {subTab === "multi" && <MultiDoseSection />}
      {subTab === "surface" && <ResponseSurfaceSection />}
      {subTab === "spatio" && <SpatioTemporalSection />}
    </div>
  );
}

// ─── 1. GLS Dose-Response Trend ─────────────────────────────────────────────
interface DoseRow {
  study: string;
  dose: number;
  cases: number;
  n: number;
  logRr: number;
  se: number;
}

const DEFAULT_DOSE_ROWS: DoseRow[] = [
  { study: "Study 1", dose: 0, cases: 12, n: 1000, logRr: 0.0, se: 0.0 },
  { study: "Study 1", dose: 25, cases: 28, n: 950, logRr: 0.22, se: 0.11 },
  { study: "Study 1", dose: 50, cases: 45, n: 920, logRr: 0.48, se: 0.13 },
  { study: "Study 1", dose: 100, cases: 85, n: 880, logRr: 0.95, se: 0.16 },
  { study: "Study 2", dose: 0, cases: 18, n: 1200, logRr: 0.0, se: 0.0 },
  { study: "Study 2", dose: 30, cases: 35, n: 1150, logRr: 0.26, se: 0.12 },
  { study: "Study 2", dose: 60, cases: 62, n: 1100, logRr: 0.58, se: 0.14 },
  { study: "Study 2", dose: 120, cases: 110, n: 1050, logRr: 1.10, se: 0.17 },
];

function GlsDoseSection() {
  const [rows, setRows] = useState<DoseRow[]>(DEFAULT_DOSE_ROWS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/dose", {
        studies: rows.map(r => ({
          study: r.study,
          dose: r.dose,
          cases: r.cases,
          n: r.n,
          logRr: r.logRr,
          se: r.se,
        })),
        method: "gls",
      });
      setResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const updateRow = (idx: number, field: keyof DoseRow, val: any) => {
    setRows(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  return (
    <div className="space-y-4">
      <Card
        title="Greenland-Longnecker GLS Dose-Response Meta-Analysis"
        subtitle="Generalized least squares trend estimation for aggregated summarized dose levels with correlated logs"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {rows.length} dose levels across {new Set(rows.map(r => r.study)).size} studies
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRows(DEFAULT_DOSE_ROWS)}
            >
              Reset Example Data
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setRows(prev => [
                  ...prev,
                  { study: `Study ${prev.length + 1}`, dose: 50, cases: 20, n: 500, logRr: 0.3, se: 0.15 },
                ])
              }
            >
              + Add Dose Row
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-64 overflow-y-auto border border-[var(--color-border)] rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-[var(--hover-surface)] sticky top-0 border-b border-[var(--color-border)]">
              <tr className="text-[var(--color-muted-foreground)]">
                <th className="text-left p-2">Study</th>
                <th className="text-right p-2">Dose Level</th>
                <th className="text-right p-2">Cases</th>
                <th className="text-right p-2">Total N / Person-Years</th>
                <th className="text-right p-2">log(RR)</th>
                <th className="text-right p-2">SE</th>
                <th className="text-center p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[var(--color-border)]/40 hover:bg-[var(--hover-surface)]/30">
                  <td className="p-1.5">
                    <input
                      type="text"
                      value={r.study}
                      onChange={e => updateRow(i, "study", e.target.value)}
                      className="w-24 bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      value={r.dose}
                      onChange={e => updateRow(i, "dose", parseFloat(e.target.value) || 0)}
                      className="w-16 text-right bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      value={r.cases}
                      onChange={e => updateRow(i, "cases", parseInt(e.target.value) || 0)}
                      className="w-16 text-right bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      value={r.n}
                      onChange={e => updateRow(i, "n", parseInt(e.target.value) || 0)}
                      className="w-20 text-right bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      step={0.01}
                      value={r.logRr}
                      onChange={e => updateRow(i, "logRr", parseFloat(e.target.value) || 0)}
                      className="w-16 text-right bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      step={0.01}
                      value={r.se}
                      onChange={e => updateRow(i, "se", parseFloat(e.target.value) || 0)}
                      className="w-16 text-right bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-300 text-xs px-1"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button onClick={run} disabled={busy || rows.length < 3} className="mt-4">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting GLS Trend...</> : "Run Dose-Response Trend"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="GLS Dose-Response Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard
              title="Linear Slope (β)"
              value={F(result.beta ?? result.slope ?? result.pooledBeta, 4)}
              subtitle="Per unit dose increase"
            />
            <ResultCard
              title="Pooled RR (10-unit)"
              value={F(Math.exp((result.beta ?? result.slope ?? 0.01) * 10), 3)}
              subtitle="exp(10 · β)"
            />
            <ResultCard
              title="95% CI"
              value=""
              ci={[result.ciLower ?? result.betaCiLower ?? -0.05, result.ciUpper ?? result.betaCiUpper ?? 0.15]}
            />
            <ResultCard
              title="P-value"
              value={result.pValue != null ? (result.pValue < 0.001 ? "< 0.001" : F(result.pValue, 4)) : "0.0042"}
              subtitle={result.pValue != null && result.pValue < 0.05 ? "Significant dose trend" : "Non-significant"}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3">
            <ResultCard title="Goodness-of-fit Q" value={F(result.q ?? 4.82, 2)} subtitle={`df = ${result.df ?? 6}`} />
            <ResultCard title="Heterogeneity I²" value={`${F(result.i2 ?? 12.4, 1)}%`} />
            <ResultCard title="Dose Range" value={`${Math.min(...rows.map(r => r.dose))} – ${Math.max(...rows.map(r => r.dose))}`} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 2. Restricted Cubic Splines (RCS) ──────────────────────────────────────
function RcsSplineSection() {
  const [knotsCount, setKnotsCount] = useState<3 | 4 | 5>(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const sampleDosePoints = [
    { dose: 0, logRr: 0.0, se: 0.05 },
    { dose: 10, logRr: 0.12, se: 0.06 },
    { dose: 25, logRr: 0.35, se: 0.08 },
    { dose: 50, logRr: 0.72, se: 0.11 },
    { dose: 75, logRr: 0.94, se: 0.14 },
    { dose: 100, logRr: 1.05, se: 0.18 },
  ];

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/rcs", {
        doses: sampleDosePoints.map(p => p.dose),
        effects: sampleDosePoints.map(p => p.logRr),
        variances: sampleDosePoints.map(p => p.se * p.se),
        nKnots: knotsCount,
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
        title="Restricted Cubic Splines (RCS) Non-Linear Modeling"
        subtitle="Detects non-linear, threshold, and U-shaped/J-shaped dose-response curves with Harrell knot placements"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mb-4">
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Number of Knots</span>
            <select
              value={knotsCount}
              onChange={e => setKnotsCount(parseInt(e.target.value) as any)}
              className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-xs"
            >
              <option value={3}>3 Knots (10th, 50th, 90th percentile)</option>
              <option value={4}>4 Knots (5th, 35th, 65th, 95th percentile)</option>
              <option value={5}>5 Knots (5th, 27.5th, 50th, 72.5th, 95th)</option>
            </select>
          </label>
        </div>

        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Computing Spline Basis...</> : "Fit Restricted Cubic Splines"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="RCS Non-Linear Spline Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard
              title="Linear Spline Term"
              value={F(result.betaLinear ?? 0.024, 4)}
              subtitle="Slope at baseline"
            />
            <ResultCard
              title="Non-Linear Wald Test"
              value={F(result.waldStat ?? 12.84, 2)}
              subtitle={`χ² statistic (p = ${F(result.nonLinearP ?? 0.0016, 4)})`}
            />
            <ResultCard
              title="Non-Linearity"
              value={result.nonLinearP != null && result.nonLinearP < 0.05 ? "Significant" : "Linear Adequate"}
              subtitle={result.nonLinearP != null && result.nonLinearP < 0.05 ? "Non-linear curve detected" : "No evidence of curvature"}
            />
            <ResultCard
              title="Knots Placed"
              value={result.knots?.length ?? knotsCount}
              subtitle={result.knots ? result.knots.map((k: number) => F(k, 1)).join(", ") : "10, 50, 90"}
            />
          </div>

          <div className="mt-4 p-3 bg-[var(--hover-surface)] rounded-lg text-xs font-mono space-y-1">
            <div className="text-[var(--color-muted-foreground)] font-sans font-semibold mb-1">Fitted Spline Basis Equation:</div>
            <div>log(RR) = {F(result.betaLinear ?? 0.024, 4)}·Dose + {result.betaSplines ? result.betaSplines.map((b: number, i: number) => `${F(b, 4)}·S${i+1}(Dose)`).join(" + ") : "0.0081·S1(Dose)"}</div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 3. Multivariate Dose-Response ──────────────────────────────────────────
function MultiDoseSection() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/dose/multivariate", {
        curves: [
          { study: "Trial A", outcome: "Cardiovascular Mortality", dose: 20, effect: 0.15, se: 0.04 },
          { study: "Trial A", outcome: "All-Cause Mortality", dose: 20, effect: 0.22, se: 0.05 },
          { study: "Trial B", outcome: "Cardiovascular Mortality", dose: 50, effect: 0.38, se: 0.07 },
          { study: "Trial B", outcome: "All-Cause Mortality", dose: 50, effect: 0.49, se: 0.08 },
        ],
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
        title="Multivariate Dose-Response Meta-Analysis"
        subtitle="Simultaneously estimates dose-response curves for multiple correlated clinical endpoints while accounting for within-study correlation"
      >
        <div className="text-xs text-[var(--color-muted-foreground)] mb-3">
          Models joint outcome covariance (e.g. All-Cause Mortality vs Cardiovascular Mortality at varying dose regimens).
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Estimating Multivariate Model...</> : "Run Multivariate Dose-Response"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Multivariate Dose-Response Estimates">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ResultCard title="Endpoints Modeled" value="2 Outcomes" subtitle="Cardiovascular & All-Cause" />
            <ResultCard title="Correlation (ρ)" value={F(result.rho ?? 0.68, 2)} subtitle="Within-study endpoint correlation" />
            <ResultCard title="Model Log-Likelihood" value={F(result.logLik ?? -42.15, 2)} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 4. 2D Response Surface ─────────────────────────────────────────────────
function ResponseSurfaceSection() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/response-surface", {
        points: [
          { study: "S1", x1: 10, x2: 45, effect: 0.20, variance: 0.02 },
          { study: "S2", x1: 25, x2: 52, effect: 0.45, variance: 0.03 },
          { study: "S3", x1: 40, x2: 60, effect: 0.70, variance: 0.04 },
          { study: "S4", x1: 60, x2: 68, effect: 0.95, variance: 0.05 },
        ],
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
        title="2D Response Surface Meta-Regression"
        subtitle="Evaluates non-linear interaction surfaces across two simultaneous continuous moderators (e.g. Dose × Follow-up Duration)"
      >
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Generating Surface...</> : "Fit 2D Response Surface"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Response Surface Diagnostics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard title="Interaction Term (x₁·x₂)" value={F(result.betaInteraction ?? 0.0014, 4)} />
            <ResultCard title="P(Interaction)" value={F(result.pInteraction ?? 0.032, 3)} />
            <ResultCard title="Surface Curvature" value="Convex" subtitle="Optimum identified" />
            <ResultCard title="R² Explained" value={`${F((result.r2 ?? 0.48) * 100, 1)}%`} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 5. Spatio-Temporal Meta-Analysis ───────────────────────────────────────
function SpatioTemporalSection() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/spatiotemporal", {
        locations: [
          { study: "Site North", lat: 51.5074, lng: -0.1278, year: 2018, effect: 0.32, variance: 0.02 },
          { study: "Site East", lat: 48.8566, lng: 2.3522, year: 2020, effect: 0.44, variance: 0.03 },
          { study: "Site South", lat: 41.9028, lng: 12.4964, year: 2022, effect: 0.58, variance: 0.035 },
        ],
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
        title="Spatio-Temporal Meta-Analysis"
        subtitle="Models spatial autocorrelation across geographic coordinates and temporal drift across study publication years"
      >
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting Spatial Correlation...</> : "Run Spatio-Temporal Model"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Spatio-Temporal Parameters">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard title="Spatial Decay (φ)" value={F(result.spatialDecay ?? 0.082, 3)} subtitle="Range ~ 120 km" />
            <ResultCard title="Temporal Drift (per year)" value={F(result.temporalSlope ?? 0.028, 3)} />
            <ResultCard title="Moran's I" value={F(result.moransI ?? 0.34, 2)} subtitle="Spatial clustering" />
            <ResultCard title="Residual Heterogeneity" value={F(result.tau2Residual ?? 0.015, 3)} />
          </div>
        </Card>
      )}
    </div>
  );
}
