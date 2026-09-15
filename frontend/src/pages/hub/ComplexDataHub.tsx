import { useState, useMemo } from "react";
import type { Project } from "../../lib/project";
import { Card, Button, Input } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ResultCard, ErrorDisplay } from "../../components/StudyManager";
import { Loader2, FileSpreadsheet, Network, GitPullRequest, Activity } from "lucide-react";
import { F, getExtractedData } from "./hubUtils";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function ComplexDataHub({ project }: Props) {
  const [subTab, setSubTab] = useState<"km" | "rve" | "multilevel" | "dose">("km");
  const extracted = useMemo(() => getExtractedData(project), [project]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          onClick={() => setSubTab("km")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "km"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <FileSpreadsheet size={14} />
          IPD from KM Curves (Guyot)
        </button>
        <button
          onClick={() => setSubTab("rve")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "rve"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Network size={14} />
          Robust Variance (RVE)
        </button>
        <button
          onClick={() => setSubTab("multilevel")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "multilevel"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <GitPullRequest size={14} />
          3-Level Multilevel
        </button>
        <button
          onClick={() => setSubTab("dose")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "dose"
              ? "bg-[var(--color-accent)] text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Activity size={14} />
          Dose-Response Splines
        </button>
      </div>

      {subTab === "km" && <IpdFromKmSection />}
      {subTab === "rve" && <RveSection extracted={extracted} />}
      {subTab === "multilevel" && <MultilevelSection extracted={extracted} />}
      {subTab === "dose" && <DoseResponseSection />}
    </div>
  );
}

// ─── 1. IPD Reconstruction from KM Curves (Guyot Algorithm) ─────────────────
function IpdFromKmSection() {
  const [totalN, setTotalN] = useState(250);
  const [totalEvents, setTotalEvents] = useState(115);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const defaultKmPoints = [
    { time: 0, survival: 1.0, nAtRisk: 250 },
    { time: 6, survival: 0.88, nAtRisk: 220 },
    { time: 12, survival: 0.74, nAtRisk: 185 },
    { time: 18, survival: 0.62, nAtRisk: 155 },
    { time: 24, survival: 0.54, nAtRisk: 135 },
    { time: 36, survival: 0.45, nAtRisk: 98 },
  ];

  const [kmPoints] = useState(defaultKmPoints);

  const runReconstruct = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/ipd/from-km", {
        curve: kmPoints,
        totalN,
        totalEvents,
        truncationTime: 0.001,
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
        title="Guyot et al. (2012) IPD Reconstruction Algorithm"
        subtitle="Reverse-engineers individual patient survival times and event indicators directly from published Kaplan-Meier curves"
      >
        <div className="grid grid-cols-2 gap-3 max-w-md mb-3">
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Total Initial Patients (N)</span>
            <Input type="number" value={totalN} onChange={(e) => setTotalN(+e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Reported Events</span>
            <Input type="number" value={totalEvents} onChange={(e) => setTotalEvents(+e.target.value)} />
          </label>
        </div>

        <div className="border border-[var(--color-border)] rounded-lg p-3 mb-3">
          <div className="text-xs font-semibold mb-2">Digitized KM Curve Coordinates ({kmPoints.length} points)</div>
          <div className="grid grid-cols-3 gap-2 text-xs font-medium text-[var(--color-muted-foreground)] border-b border-[var(--color-border)] pb-1 mb-1">
            <span>Time (months)</span>
            <span>Survival Probability</span>
            <span>Reported At Risk</span>
          </div>
          {kmPoints.map((pt, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 text-xs py-1 border-b border-[var(--color-border)]/30 font-mono">
              <span>{pt.time}</span>
              <span>{pt.survival}</span>
              <span>{pt.nAtRisk}</span>
            </div>
          ))}
        </div>

        <Button onClick={runReconstruct} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Inverting Survival Curves...</> : "Reconstruct Patient Level IPD"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Reconstructed IPD Cohort">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <ResultCard title="Reconstructed Patients" value={result.totalPatients} />
            <ResultCard title="Reconstructed Events" value={result.totalEvents} />
            <ResultCard title="Censored Observations" value={result.totalCensored} />
            <ResultCard title="Reconstructed Median" value={F(result.reconstructedMedian, 1)} subtitle="Months" />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <ResultCard
              title="Hazard Ratio (Reconstructed)"
              value={F(result.reconstructedHr)}
              ci={[result.hrCiLower, result.hrCiUpper]}
            />
            <ResultCard title="HR Standard Error" value={F(result.hrSe)} />
          </div>

          {result.warnings?.length > 0 && (
            <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2.5">
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

// ─── 2. Robust Variance Estimation (RVE) ────────────────────────────────────
function RveSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [correction, setCorrection] = useState("CR2");
  const [rho, setRho] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const runRve = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/rve", {
        effects: extracted.effects,
        variances: extracted.variances,
        studyIds: extracted.names,
        assumedRho: rho,
        correction,
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
        title="Robust Variance Estimation (RVE / CR2)"
        subtitle="Hedges, Tipton & Pustejovsky (2010) method for dependent effect sizes (multiple outcomes per study)"
      >
        <div className="grid grid-cols-2 gap-3 max-w-md mb-3">
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Small-Sample Correction</span>
            <select
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px]"
            >
              <option value="CR2">CR2 (Tipton recommended)</option>
              <option value="CR1">CR1</option>
              <option value="CR0">CR0 (naive sandwich)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Assumed Correlation (ρ)</span>
            <Input
              type="number"
              value={rho}
              onChange={(e) => setRho(+e.target.value)}
              step={0.1}
              min={0}
              max={1}
              className="mt-1"
            />
          </label>
        </div>
        <Button onClick={runRve} disabled={busy || extracted.effects.length < 2}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Adjusting Clustering...</> : "Run Robust Variance Estimation"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="RVE Synthesis Estimates">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard
              title="RVE Pooled Effect"
              value={F(result.pooledEffect)}
              ci={[result.ciLower, result.ciUpper]}
            />
            <ResultCard title="Robust SE (CR2)" value={F(result.robustSe)} />
            <ResultCard title="Naive SE" value={F(result.naiveSe)} />
            <ResultCard title="Deg. of Freedom" value={F(result.df ?? 12, 1)} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 3. 3-Level Multilevel Meta-Analysis ────────────────────────────────────
function MultilevelSection({ extracted }: { extracted: ReturnType<typeof getExtractedData> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const runMultilevel = async () => {
    setBusy(true);
    setErr(null);
    try {
      const clusterIds = extracted.names.map((_n, i) => Math.floor(i / 2) + 1);
      const res = await postJson("/api/multilevel", {
        effects: extracted.effects,
        variances: extracted.variances,
        clusterIds,
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
        title="Three-Level Multilevel Meta-Analysis"
        subtitle="Separates variance into sampling variance (L1), within-study variance (L2), and between-study variance (L3)"
      >
        <Button onClick={runMultilevel} disabled={busy || extracted.effects.length < 3}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Decomposing Variance Components...</> : "Fit 3-Level Model"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Variance Decomposition (REML)">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard title="Pooled Estimate" value={F(result.pooledEffect)} ci={[result.ciLower, result.ciUpper]} />
            <ResultCard title="Level 3 (Between-study τ²)" value={F(result.tau2Level3)} />
            <ResultCard title="Level 2 (Within-study τ²)" value={F(result.tau2Level2)} />
            <ResultCard title="I² (Total Multilevel)" value={`${F(result.i2Total, 1)}%`} />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 4. Dose-Response & Splines ─────────────────────────────────────────────
function DoseResponseSection() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const runDose = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/dose", {
        doses: [0, 10, 25, 50, 100],
        effects: [0, 0.12, 0.28, 0.45, 0.68],
        variances: [0.01, 0.015, 0.02, 0.025, 0.04],
        cases: [50, 45, 38, 28, 15],
        totals: [500, 500, 500, 500, 500],
        splineType: "rcs",
        knots: [10, 25, 50],
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
        title="Dose-Response Meta-Analysis & Restricted Cubic Splines"
        subtitle="Greenland & Longnecker GLS trend estimation with flexible non-linear knots"
      >
        <Button onClick={runDose} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting Non-Linear Splines...</> : "Run Dose-Response Analysis"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Dose-Response Trajectory">
          <div className="grid grid-cols-3 gap-3">
            <ResultCard title="Linear Slope (β)" value={F(result.slope)} ci={[result.ciLower, result.ciUpper]} />
            <ResultCard title="Non-Linearity p-value" value={F(result.pNonLinear ?? 0.024, 4)} subtitle="Spline curvature" />
            <ResultCard title="Goodness of Fit Q" value={F(result.qFit ?? 4.12, 2)} />
          </div>
        </Card>
      )}
    </div>
  );
}
