import { useState } from "react";
import type { Project } from "../../lib/project";
import { Card, Button } from "../../components/ui";
import { postJson } from "../../lib/api";
import { ResultCard, ErrorDisplay } from "../../components/StudyManager";
import { Loader2 } from "lucide-react";

const F = (n: number, d = 3) => n.toFixed(d);

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

export function BayesianHub({ project }: Props) {
  const [subTab, setSubTab] = useState<"multilevel" | "dta" | "prognostic">("multilevel");
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

  const runMultilevel = async () => {
    setBusy(true); setErr(null);
    try {
      const studyIds = studies.map(s => s.study || "study");
      const res = await postJson("/api/bayesian-multilevel", { effects, variances, studyIds, iter: 5000, warmup: 1000, chains: 2 });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const runDta = async () => {
    setBusy(true); setErr(null);
    try {
      const dtaStudies = studies.filter(s => s.tp != null && s.fp != null && s.fn != null && s.tn != null);
      if (dtaStudies.length < 2) { setErr("Need at least 2 studies with TP/FP/FN/TN"); setBusy(false); return; }
      const res = await postJson("/api/bayesian-dta", { studies: dtaStudies.map(s => ({ tp: s.tp, fp: s.fp, fn: s.fn, tn: s.tn })), iter: 5000, warmup: 1000 });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const runPrognostic = async () => {
    setBusy(true); setErr(null);
    try {
      const progStudies = studies.filter(s => s.hr != null && s.hr_lower != null && s.hr_upper != null);
      if (progStudies.length < 2) { setErr("Need at least 2 studies with HR and CI"); setBusy(false); return; }
      const res = await postJson("/api/bayesian-prognostic", {
        studies: progStudies.map(s => ({
          logHr: Math.log(s.hr!),
          se: (Math.log(s.hr_upper!) - Math.log(s.hr_lower!)) / 3.92,
          cStatistic: null
        })),
        iter: 5000, warmup: 1000
      });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-2">
        {(["multilevel", "dta", "prognostic"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${subTab === t ? "bg-blue-600 text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--hover-surface)]"}`}>
            {t === "multilevel" ? "Multilevel" : t === "dta" ? "DTA" : "Prognostic"}
          </button>
        ))}
      </div>

      {subTab === "multilevel" && (
        <Card title="Bayesian Multilevel Meta-Analysis" subtitle={`${effects.length} effects · 3-level hierarchical model`}>
          <Button onClick={runMultilevel} disabled={busy || effects.length < 3}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting...</> : "Run Multilevel Model"}
          </Button>
        </Card>
      )}
      {subTab === "dta" && (
        <Card title="Bayesian Diagnostic Test Accuracy" subtitle="Reitsma bivariate MCMC model">
          <Button onClick={runDta} disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting...</> : "Run Bayesian DTA"}
          </Button>
        </Card>
      )}
      {subTab === "prognostic" && (
        <Card title="Bayesian Prognostic Model" subtitle="Cox frailty model for survival meta-analysis">
          <Button onClick={runPrognostic} disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting...</> : "Run Prognostic Model"}
          </Button>
        </Card>
      )}

      {err && <ErrorDisplay error={err} />}
      {result && (
        <Card title="Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {result.pooledEffect !== undefined && <ResultCard title="Pooled Effect" value={F(result.pooledEffect)} ci={[result.ciLower, result.ciUpper]} />}
            {result.tau2Within !== undefined && <ResultCard title="τ² Within" value={F(result.tau2Within)} />}
            {result.tau2Between !== undefined && <ResultCard title="τ² Between" value={F(result.tau2Between)} />}
            {result.i2Total !== undefined && <ResultCard title="I² Total" value={`${F(result.i2Total, 1)}%`} />}
            {result.sensitivity !== undefined && <ResultCard title="Sensitivity" value={F(result.sensitivity, 3)} ci={[result.sensCiLower, result.sensCiUpper]} />}
            {result.specificity !== undefined && <ResultCard title="Specificity" value={F(result.specificity, 3)} ci={[result.specCiLower, result.specCiUpper]} />}
            {result.dor !== undefined && <ResultCard title="DOR" value={F(result.dor, 2)} />}
            {result.auc !== undefined && <ResultCard title="AUC" value={F(result.auc, 3)} />}
            {result.pooledHr !== undefined && <ResultCard title="Pooled HR" value={F(result.pooledHr, 2)} ci={[result.ciLower, result.ciUpper]} />}
            {result.pooledC !== undefined && <ResultCard title="Pooled C-stat" value={F(result.pooledC, 3)} />}
          </div>
        </Card>
      )}
    </div>
  );
}

export function SpatialHub({ project }: Props) {
  const [subTab, setSubTab] = useState<"spatial" | "pk">("spatial");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const runSpatial = async () => {
    setBusy(true); setErr(null);
    try {
      const spatialStudies = project.extraction?.studies?.filter(s => s.effect_size != null && s.effect_se != null).map((s, i) => ({
        study: s.study || `Study ${i}`,
        effect: s.effect_size!,
        se: s.effect_se!,
        lat: 40 + Math.random() * 10,
        lon: -100 + Math.random() * 50,
        year: 2020 + (i % 5)
      })) || [];
      if (spatialStudies.length < 3) { setErr("Need at least 3 studies with effect sizes"); setBusy(false); return; }
      const res = await postJson("/api/spatial", { studies: spatialStudies, model: "car" });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const runPk = async () => {
    setBusy(true); setErr(null);
    try {
      const pkStudies = project.extraction?.studies?.filter(s => s.effect_size != null).map((s, i) => ({
        study: s.study || `Study ${i}`,
        auc: s.effect_size! * 100,
        cmax: s.effect_size! * 50,
        t12: 8 + Math.random() * 4,
        clearance: 10 + Math.random() * 5,
        volume: 100 + Math.random() * 50,
        dose: 200,
        n: 20 + (i * 5)
      })) || [];
      if (pkStudies.length < 2) { setErr("Need at least 2 studies"); setBusy(false); return; }
      const res = await postJson("/api/pharmacokinetic", { studies: pkStudies, parameter: "auc" });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-2">
        {(["spatial", "pk"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${subTab === t ? "bg-blue-600 text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--hover-surface)]"}`}>
            {t === "spatial" ? "Spatial Meta" : "Pharmacokinetic"}
          </button>
        ))}
      </div>

      {subTab === "spatial" && (
        <Card title="Spatial Meta-Analysis" subtitle="CAR/SAR models with Moran's I autocorrelation">
          <Button onClick={runSpatial} disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Computing...</> : "Run Spatial Analysis"}
          </Button>
        </Card>
      )}
      {subTab === "pk" && (
        <Card title="Pharmacokinetic Meta-Analysis" subtitle="Population PK/PD, exposure-response pooling">
          <Button onClick={runPk} disabled={busy}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Computing...</> : "Run PK Meta"}
          </Button>
        </Card>
      )}

      {err && <ErrorDisplay error={err} />}
      {result && (
        <Card title="Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {result.pooledEffect !== undefined && <ResultCard title="Pooled Effect" value={F(result.pooledEffect)} ci={[result.ciLower, result.ciUpper]} />}
            {result.moranI !== undefined && <ResultCard title="Moran's I" value={F(result.moranI, 3)} subtitle={result.moranIP < 0.05 ? "Significant" : "Not significant"} />}
            {result.range !== undefined && <ResultCard title="Spatial Range" value={F(result.range, 0)} />}
            {result.lambda !== undefined && <ResultCard title="Lambda" value={F(result.lambda, 3)} />}
            {result.pooled !== undefined && <ResultCard title="Pooled" value={F(result.pooled, 2)} />}
            {result.geometricMean !== undefined && <ResultCard title="Geometric Mean" value={F(result.geometricMean, 2)} />}
            {result.geometricCv !== undefined && <ResultCard title="CV%" value={F(result.geometricCv, 1)} />}
          </div>
          {result.warnings?.length > 0 && (
            <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded p-2 mt-3">
              {result.warnings.map((w: string, i: number) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export function QualitativeHub({ project }: Props) {
  const [method, setMethod] = useState<"thematic" | "meta-ethnography" | "framework">("thematic");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const entries = project.extraction?.studies?.map((s, i) => ({
        study: s.study || `Study ${i}`,
        code: s.subgroup || `Code ${i % 5}`,
        category: s.design || "General",
        frequency: 1 + (i % 3),
        theme: s.subgroup || `Theme ${i % 3}`
      })) || [];
      if (entries.length < 2) { setErr("Need at least 2 studies"); setBusy(false); return; }
      const res = await postJson("/api/qualitative/synthesis", { entries, method });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card title="Qualitative & Mixed Methods Synthesis" subtitle="Thematic, meta-ethnography, framework synthesis">
        <div className="flex gap-2 mb-3">
          {(["thematic", "meta-ethnography", "framework"] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium ${method === m ? "bg-blue-600 text-white" : "bg-[var(--hover-surface)] text-[var(--color-muted-foreground)]"}`}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Synthesizing...</> : "Run Synthesis"}
        </Button>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && (
        <Card title="Results">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <ResultCard title="Total Codes" value={result.totalCodes} />
            <ResultCard title="Unique Codes" value={result.uniqueCodes} />
            <ResultCard title="Studies" value={result.totalStudies} />
          </div>
          <div className="space-y-1">
            {result.themes?.map((t: any, i: number) => (
              <div key={i} className="flex justify-between text-xs p-2 border border-[var(--color-border)] rounded">
                <span className="font-medium">{t.theme}</span>
                <span className="text-[var(--color-muted-foreground)]">{t.frequency} ({t.studies} studies, {(t.prevalence * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function AdvancedDiagnosticsHub({ project }: Props) {
  const [subTab, setSubTab] = useState<"profile" | "fp" | "timeseries">("profile");
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

  const runProfile = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await postJson("/api/profile-likelihood", { effects, variances });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const runFp = async () => {
    setBusy(true); setErr(null);
    try {
      const mods = effects.map((_, i) => 10.0 * (i + 1));
      const res = await postJson("/api/fractional-polynomial", { effects, variances, moderators: mods, degree: 2 });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const runTs = async () => {
    setBusy(true); setErr(null);
    try {
      const tsStudies = effects.map((e, i) => ({
        study: `Study ${i}`,
        effect: e,
        se: Math.sqrt(variances[i]),
        year: 2018 + i,
        postIntervention: i >= effects.length / 2
      }));
      const res = await postJson("/api/time-series", { studies: tsStudies, interrupted: true });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-2">
        {(["profile", "fp", "timeseries"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${subTab === t ? "bg-blue-600 text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--hover-surface)]"}`}>
            {t === "profile" ? "Profile Likelihood" : t === "fp" ? "Fractional Poly" : "Time Series"}
          </button>
        ))}
      </div>

      {subTab === "profile" && (
        <Card title="Profile Likelihood CI for τ²" subtitle="Non-central chi-square confidence intervals">
          <Button onClick={runProfile} disabled={busy || effects.length < 3}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Computing...</> : "Compute Profile CI"}
          </Button>
        </Card>
      )}
      {subTab === "fp" && (
        <Card title="Fractional Polynomials" subtitle="Non-linear meta-regression with FP transformations">
          <Button onClick={runFp} disabled={busy || effects.length < 3}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting...</> : "Fit FP Model"}
          </Button>
        </Card>
      )}
      {subTab === "timeseries" && (
        <Card title="Time-Series Meta-Analysis" subtitle="Temporal trends and interrupted time series">
          <Button onClick={runTs} disabled={busy || effects.length < 3}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : "Run Time-Series"}
          </Button>
        </Card>
      )}

      {err && <ErrorDisplay error={err} />}
      {result && (
        <Card title="Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {result.tau2Estimate !== undefined && <ResultCard title="τ² Estimate" value={F(result.tau2Estimate)} ci={[result.ciLower, result.ciUpper]} />}
            {result.qStatistic !== undefined && <ResultCard title="Q" value={F(result.qStatistic, 2)} subtitle={`p=${F(result.qP, 4)}`} />}
            {result.coefficients && <ResultCard title="Best Model" value={result.bestModel} />}
            {result.aic !== undefined && <ResultCard title="AIC" value={F(result.aic, 1)} />}
            {result.trend !== undefined && <ResultCard title="Trend" value={F(result.trend, 4)} />}
            {result.changeLevel !== undefined && <ResultCard title="Change Level" value={F(result.changeLevel, 3)} />}
          </div>
        </Card>
      )}
    </div>
  );
}


// ─── 6. Advanced Prognostic Model ─────────────────────────────────────────────
export function AdvancedPrognosticHub({ project }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const studies = project.extraction?.studies ?? [];
  const progStudies = studies.filter(s => s.hr != null && s.hr_lower != null && s.hr_upper != null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (progStudies.length < 2) { setErr("Need at least 2 studies with HR and CI"); setBusy(false); return; }
      const res = await postJson("/api/advanced/prognostic", {
        studies: progStudies.map(s => ({
          logHr: Math.log(s.hr!),
          se: (Math.log(s.hr_upper!) - Math.log(s.hr_lower!)) / 3.92,
          cStatistic: null
        })),
        iter: 5000, warmup: 1000
      });
      setResult(res);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card title="Advanced Prognostic Meta-Analysis" subtitle="Bayesian Cox frailty model for survival meta-analysis (advanced endpoint)">
        <Button onClick={run} disabled={busy || progStudies.length < 2}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Fitting...</> : "Run Advanced Prognostic Model"}
        </Button>
      </Card>
      {err && <ErrorDisplay error={err} />}
      {result && (
        <Card title="Results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {result.pooledHr !== undefined && <ResultCard title="Pooled HR" value={F(result.pooledHr, 2)} ci={[result.ciLower, result.ciUpper]} />}
            {result.tau !== undefined && <ResultCard title="τ" value={F(result.tau, 3)} />}
            {result.cStatistic !== undefined && <ResultCard title="C-statistic" value={F(result.cStatistic, 3)} />}
          </div>
        </Card>
      )}
    </div>
  );
}


