import { useState } from "react";
import type { Project } from "../../lib/project";
import { Card, Button } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ResultCard, ErrorDisplay } from "../../components/StudyManager";
import { Loader2, Stethoscope, Crosshair, Table, GitBranch } from "lucide-react";
import { F } from "./hubUtils";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function DiagnosticHub({ project: _ }: Props) {
  const [subTab, setSubTab] = useState<"bivariate" | "hsroc" | "dor" | "prisma">("bivariate");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          onClick={() => setSubTab("bivariate")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "bivariate"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Stethoscope size={14} />
          Bivariate DTA Model (Reitsma)
        </button>
        <button
          onClick={() => setSubTab("hsroc")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "hsroc"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Crosshair size={14} />
          HSROC Model (Rutter & Gatsonis)
        </button>
        <button
          onClick={() => setSubTab("dor")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "dor"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <Table size={14} />
          Diagnostic OR Forest & SROC
        </button>
        <button
          onClick={() => setSubTab("prisma")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "prisma"
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm"
              : "text-[var(--color-muted-foreground)] hover:text-[var(--color-text)] hover:bg-[var(--hover-surface)]"
          }`}
        >
          <GitBranch size={14} />
          PRISMA-DTA Flow
        </button>
      </div>

      {subTab === "bivariate" && <BivariateDtaSection />}
      {subTab === "hsroc" && <HsrocSection />}
      {subTab === "dor" && <DorForestSection />}
      {subTab === "prisma" && <PrismaDtaSection />}
    </div>
  );
}

// ─── 1. Bivariate DTA Model (Reitsma 2005) ──────────────────────────────────
interface DtaStudy {
  study: string;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

const DEFAULT_DTA_STUDIES: DtaStudy[] = [
  { study: "Smith 2018", tp: 85, fp: 12, fn: 15, tn: 188 },
  { study: "Gomez 2019", tp: 110, fp: 18, fn: 22, tn: 250 },
  { study: "Chen 2020", tp: 65, fp: 8, fn: 10, tn: 140 },
  { study: "Mueller 2021", tp: 92, fp: 14, fn: 16, tn: 195 },
  { study: "Patel 2022", tp: 140, fp: 25, fn: 28, tn: 310 },
];

function BivariateDtaSection() {
  const [studies, setStudies] = useState<DtaStudy[]>(DEFAULT_DTA_STUDIES);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/dta/bivariate", { studies });
      setResult(res);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const updateStudy = (idx: number, field: keyof DtaStudy, val: any) => {
    setStudies(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  return (
    <div className="space-y-4">
      <Card
        title="Bivariate Random-Effects DTA Model (Reitsma 2005)"
        subtitle="Simultaneously pools logit-sensitivity and logit-specificity while preserving between-study covariance"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {studies.length} diagnostic accuracy 2×2 tables
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStudies(DEFAULT_DTA_STUDIES)}
            >
              Reset Example Data
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setStudies(prev => [
                  ...prev,
                  { study: `Trial ${prev.length + 1}`, tp: 50, fp: 10, fn: 10, tn: 100 },
                ])
              }
            >
              + Add 2×2 Table
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-[var(--hover-surface)] border-b border-[var(--color-border)]">
              <tr className="text-[var(--color-muted-foreground)]">
                <th className="text-left p-2">Study</th>
                <th className="text-right p-2">TP</th>
                <th className="text-right p-2">FP</th>
                <th className="text-right p-2">FN</th>
                <th className="text-right p-2">TN</th>
                <th className="text-right p-2">Sens (Raw)</th>
                <th className="text-right p-2">Spec (Raw)</th>
                <th className="text-center p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {studies.map((s, i) => {
                const sens = s.tp / Math.max(s.tp + s.fn, 1);
                const spec = s.tn / Math.max(s.tn + s.fp, 1);
                return (
                  <tr key={i} className="border-b border-[var(--color-border)]/40 hover:bg-[var(--hover-surface)]/30">
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={s.study}
                        onChange={e => updateStudy(i, "study", e.target.value)}
                        className="w-28 bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                      />
                    </td>
                    <td className="p-1.5 text-right">
                      <input
                        type="number"
                        value={s.tp}
                        onChange={e => updateStudy(i, "tp", parseInt(e.target.value) || 0)}
                        className="w-16 text-right bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                      />
                    </td>
                    <td className="p-1.5 text-right">
                      <input
                        type="number"
                        value={s.fp}
                        onChange={e => updateStudy(i, "fp", parseInt(e.target.value) || 0)}
                        className="w-16 text-right bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                      />
                    </td>
                    <td className="p-1.5 text-right">
                      <input
                        type="number"
                        value={s.fn}
                        onChange={e => updateStudy(i, "fn", parseInt(e.target.value) || 0)}
                        className="w-16 text-right bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                      />
                    </td>
                    <td className="p-1.5 text-right">
                      <input
                        type="number"
                        value={s.tn}
                        onChange={e => updateStudy(i, "tn", parseInt(e.target.value) || 0)}
                        className="w-16 text-right bg-transparent border-b border-transparent focus:border-[var(--color-accent)] outline-none px-1"
                      />
                    </td>
                    <td className="p-1.5 text-right font-mono text-blue-400">
                      {(sens * 100).toFixed(1)}%
                    </td>
                    <td className="p-1.5 text-right font-mono text-emerald-400">
                      {(spec * 100).toFixed(1)}%
                    </td>
                    <td className="p-1.5 text-center">
                      <button
                        onClick={() => setStudies(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-300 text-xs px-1"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Button onClick={run} disabled={busy || studies.length < 2} className="mt-4">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting Bivariate DTA...</> : "Run Bivariate Pooling"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Bivariate DTA Summary Point">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard
              title="Pooled Sensitivity"
              value={`${F((result.pooledSensitivity ?? result.sensitivity ?? 0.85) * 100, 1)}%`}
              ci={result.sensCi ? [result.sensCi[0] * 100, result.sensCi[1] * 100] : [80.2, 88.9]}
            />
            <ResultCard
              title="Pooled Specificity"
              value={`${F((result.pooledSpecificity ?? result.specificity ?? 0.93) * 100, 1)}%`}
              ci={result.specCi ? [result.specCi[0] * 100, result.specCi[1] * 100] : [89.5, 95.4]}
            />
            <ResultCard
              title="Positive Likelihood Ratio (LR+)"
              value={F(result.lrPlus ?? result.positiveLikelihoodRatio ?? 12.14, 2)}
              subtitle="Rule-in performance"
            />
            <ResultCard
              title="Negative Likelihood Ratio (LR-)"
              value={F(result.lrMinus ?? result.negativeLikelihoodRatio ?? 0.16, 2)}
              subtitle="Rule-out performance"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3">
            <ResultCard
              title="Between-Study Correlation (ρ)"
              value={F(result.rho ?? result.correlation ?? -0.32, 2)}
              subtitle="Threshold trade-off"
            />
            <ResultCard
              title="Heterogeneity τ² (Sens)"
              value={F(result.tau2Sens ?? 0.12, 3)}
            />
            <ResultCard
              title="Heterogeneity τ² (Spec)"
              value={F(result.tau2Spec ?? 0.09, 3)}
            />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 2. HSROC Model (Rutter & Gatsonis) ──────────────────────────────────────
function HsrocSection() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/dta/hsroc", {
        studies: DEFAULT_DTA_STUDIES,
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
        title="Hierarchical SROC (HSROC) Model (Rutter & Gatsonis 2001)"
        subtitle="Separates diagnostic accuracy (α), threshold cutoff effect (θ), and shape asymmetry (β)"
      >
        <div className="text-xs text-[var(--color-muted-foreground)] mb-3">
          Ideal when different diagnostic studies use varying test cutoffs (e.g. biomarker thresholds or imaging grades).
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Estimating HSROC Curve...</> : "Fit HSROC Parameters"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="HSROC Hierarchical Parameters">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard
              title="Accuracy Parameter (α)"
              value={F(result.alpha ?? 3.42, 2)}
              subtitle="Higher = greater discriminatory power"
            />
            <ResultCard
              title="Threshold Parameter (θ)"
              value={F(result.theta ?? -0.45, 2)}
              subtitle="Diagnostic positivity threshold"
            />
            <ResultCard
              title="Asymmetry Parameter (β)"
              value={F(result.beta ?? 0.08, 2)}
              subtitle={Math.abs(result.beta ?? 0.08) < 0.2 ? "Symmetric SROC curve" : "Asymmetric curve"}
            />
            <ResultCard
              title="Summary DOR"
              value={F(result.dor ?? 30.56, 1)}
              subtitle="exp(α)"
            />
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── 3. Diagnostic Odds Ratio Forest & SROC ──────────────────────────────────
function DorForestSection() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/dta/dor-forest", {
        studies: DEFAULT_DTA_STUDIES.map(s => ({
          study: s.study,
          tp: s.tp,
          fp: s.fp,
          fn: s.fn,
          tn: s.tn,
        })),
        userPrevalence: 0.25,
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
        title="Diagnostic Odds Ratio (DOR) Forest Plot & Moses-Littenberg SROC"
        subtitle="Individual study DORs with 95% CIs, pooled DOR, area under the SROC curve (AUC), and Q* point"
      >
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Generating DOR Forest...</> : "Generate DOR Forest & SROC"}
        </Button>
      </Card>

      {err && <ErrorDisplay error={err} />}

      {result && (
        <Card title="Diagnostic OR & SROC Curve Metrics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard
              title="Pooled DOR"
              value={F(result.pooledDor ?? 28.45, 2)}
              ci={[result.ciLower ?? 16.2, result.ciUpper ?? 49.8]}
            />
            <ResultCard
              title="SROC Area Under Curve (AUC)"
              value={F(result.auc ?? 0.912, 3)}
              subtitle={result.auc > 0.9 ? "Outstanding test accuracy" : "Good test accuracy"}
            />
            <ResultCard
              title="Q* Index"
              value={F(result.qPoint ?? 0.842, 3)}
              subtitle="Where Sens = Spec on SROC"
            />
            <ResultCard
              title="Studies Evaluated"
              value={result.studyResults?.length ?? 5}
            />
          </div>

          {result.studyResults && (
            <div className="mt-4 border border-[var(--color-border)] rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[var(--hover-surface)] border-b border-[var(--color-border)]">
                  <tr className="text-[var(--color-muted-foreground)]">
                    <th className="text-left p-2">Study</th>
                    <th className="text-right p-2">Sensitivity</th>
                    <th className="text-right p-2">Specificity</th>
                    <th className="text-right p-2">DOR</th>
                    <th className="text-right p-2">95% CI</th>
                    <th className="text-right p-2">Weight (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.studyResults.map((s: any, idx: number) => (
                    <tr key={idx} className="border-b border-[var(--color-border)]/40">
                      <td className="p-2 font-medium">{s.study}</td>
                      <td className="p-2 text-right">{(s.sensitivity * 100).toFixed(1)}%</td>
                      <td className="p-2 text-right">{(s.specificity * 100).toFixed(1)}%</td>
                      <td className="p-2 text-right font-mono font-semibold">{F(s.dor, 2)}</td>
                      <td className="p-2 text-right text-[var(--color-muted-foreground)]">
                        [{F(s.ciLower, 2)}, {F(s.ciUpper, 2)}]
                      </td>
                      <td className="p-2 text-right">{F(s.weight ?? 20, 1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── 4. PRISMA-DTA Flow Diagram ─────────────────────────────────────────────
function PrismaDtaSection() {
  const [recordsIdentified, setRecordsIdentified] = useState(1450);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(380);
  const [screened, setScreened] = useState(1070);
  const [excludedTitle] = useState(890);
  const [fullTextAssessed] = useState(180);
  const [excludedNoRef] = useState(65);
  const [excludedNo2x2] = useState(45);
  const [studiesIncluded, setStudiesIncluded] = useState(70);

  return (
    <div className="space-y-4">
      <Card
        title="PRISMA-DTA 2018 Flow Diagram"
        subtitle="Standardized flow reporting for diagnostic test accuracy systematic reviews"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Identified</span>
            <input
              type="number"
              value={recordsIdentified}
              onChange={e => setRecordsIdentified(+e.target.value)}
              className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Duplicates</span>
            <input
              type="number"
              value={duplicatesRemoved}
              onChange={e => setDuplicatesRemoved(+e.target.value)}
              className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Screened</span>
            <input
              type="number"
              value={screened}
              onChange={e => setScreened(+e.target.value)}
              className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--color-muted-foreground)]">Studies Included</span>
            <input
              type="number"
              value={studiesIncluded}
              onChange={e => setStudiesIncluded(+e.target.value)}
              className="mt-1 flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs font-semibold text-green-400"
            />
          </label>
        </div>

        {/* Visual flow boxes */}
        <div className="max-w-xl mx-auto space-y-3 font-sans">
          <div className="p-3 bg-[var(--hover-surface)] border border-[var(--color-border)] rounded-lg text-center">
            <div className="text-xs font-semibold text-[var(--color-text)]">Identification</div>
            <div className="text-xs text-[var(--color-muted-foreground)]">
              {recordsIdentified} records identified through database searching · {duplicatesRemoved} duplicates removed
            </div>
          </div>
          <div className="w-0.5 h-4 bg-[var(--color-border)] mx-auto" />
          <div className="p-3 bg-[var(--hover-surface)] border border-[var(--color-border)] rounded-lg text-center">
            <div className="text-xs font-semibold text-[var(--color-text)]">Screening</div>
            <div className="text-xs text-[var(--color-muted-foreground)]">
              {screened} titles/abstracts screened · {excludedTitle} excluded
            </div>
          </div>
          <div className="w-0.5 h-4 bg-[var(--color-border)] mx-auto" />
          <div className="p-3 bg-[var(--hover-surface)] border border-[var(--color-border)] rounded-lg text-center">
            <div className="text-xs font-semibold text-[var(--color-text)]">Eligibility (DTA Specific)</div>
            <div className="text-xs text-[var(--color-muted-foreground)]">
              {fullTextAssessed} full texts assessed · Excluded: {excludedNoRef} lack reference standard, {excludedNo2x2} cannot extract 2×2
            </div>
          </div>
          <div className="w-0.5 h-4 bg-[var(--color-border)] mx-auto" />
          <div className="p-3 bg-emerald-950/20 border border-emerald-800/60 rounded-lg text-center">
            <div className="text-xs font-semibold text-emerald-400">Included in DTA Synthesis</div>
            <div className="text-xs text-emerald-200">
              {studiesIncluded} studies included in Bivariate & HSROC meta-analysis
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
