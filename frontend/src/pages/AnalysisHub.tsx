import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Button } from "../components/ui";
import { postJson } from "../lib/api";
import { Activity, BarChart3, TrendingUp, Zap, GitBranch, Grid3X3 } from "lucide-react";

const F = (n: number, d = 3) => n.toFixed(d);

interface EngineConfig {
  key: string;
  title: string;
  description: string;
  endpoint: string;
  icon: any;
  fields: FieldConfig[];
  renderResult: (result: any) => React.ReactNode;
}

interface FieldConfig {
  name: string;
  label: string;
  type: "number" | "select" | "boolean" | "textarea";
  default?: any;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

const ENGINES: EngineConfig[] = [
  {
    key: "bayesian",
    title: "Bayesian MCMC",
    description: "Gibbs sampling with R-hat, ESS, Bayes factor",
    endpoint: "/api/bayesian",
    icon: Activity,
    fields: [
      { name: "iter", label: "Iterations", type: "number", default: 10000 },
      { name: "warmup", label: "Warmup", type: "number", default: 2000 },
      { name: "chains", label: "Chains", type: "number", default: 4 },
    ],
    renderResult: (r) => (
      <div className="grid grid-cols-2 gap-3">
        <Card title="μ (median)"><div className="text-lg font-semibold">{F(r.muMedian)}</div></Card>
        <Card title="τ (median)"><div className="text-lg font-semibold">{F(r.tauMedian)}</div></Card>
        <Card title="R-hat (μ)"><div className={`text-lg font-semibold ${r.rhatMu > 1.1 ? "text-yellow-400" : "text-green-400"}`}>{F(r.rhatMu, 3)}</div></Card>
        <Card title="ESS"><div className="text-lg font-semibold">{Math.round(r.essMu)}</div></Card>
      </div>
    ),
  },
  {
    key: "gosh",
    title: "GOSH Analysis",
    description: "Graphic Approach to Heterogeneity",
    endpoint: "/api/gosh",
    icon: Grid3X3,
    fields: [{ name: "maxSubsets", label: "Max subsets", type: "number", default: 10000 }],
    renderResult: (r) => (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Card title="Overall"><div className="text-lg font-semibold">{F(r.overallPooled)}</div></Card>
          <Card title="τ²"><div className="text-lg font-semibold">{F(r.overallTau2)}</div></Card>
          <Card title="Subsets"><div className="text-lg font-semibold">{r.nSubsetsGenerated}</div></Card>
        </div>
        {r.clusterWarnings?.length > 0 && <div className="text-xs text-yellow-400">{r.clusterWarnings[0]}</div>}
      </div>
    ),
  },
  {
    key: "influence",
    title: "Influence Diagnostics",
    description: "Cook's distance, DFFITS, studentized residuals",
    endpoint: "/api/influence",
    icon: Zap,
    fields: [],
    renderResult: (r) => (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Card title="Influential"><div className="text-lg font-semibold">{r.nInfluential}</div></Card>
          <Card title="Outliers"><div className="text-lg font-semibold">{r.nOutliers}</div></Card>
        </div>
        {r.flaggedStudies?.length > 0 && <div className="text-xs text-yellow-400">{r.flaggedStudies.length} studies flagged</div>}
      </div>
    ),
  },
  {
    key: "permutation",
    title: "Permutation Test",
    description: "Non-parametric p-value",
    endpoint: "/api/permutation",
    icon: GitBranch,
    fields: [{ name: "nPermutations", label: "Permutations", type: "number", default: 5000 }],
    renderResult: (r) => (
      <div className="grid grid-cols-3 gap-3">
        <Card title="Observed"><div className="text-lg font-semibold">{F(r.observedStatistic)}</div></Card>
        <Card title="p-value"><div className="text-lg font-semibold">{F(r.pValue, 4)}</div></Card>
        <Card title="N perm"><div className="text-lg font-semibold">{r.nPermutations}</div></Card>
      </div>
    ),
  },
  {
    key: "bootstrap",
    title: "Bootstrap CI",
    description: "Percentile, BCa, normal approximation",
    endpoint: "/api/bootstrap",
    icon: BarChart3,
    fields: [
      { name: "nBootstrap", label: "Samples", type: "number", default: 5000 },
      { name: "method", label: "Method", type: "select", default: "percentile", options: [{ value: "percentile", label: "Percentile" }, { value: "bca", label: "BCa" }, { value: "normal", label: "Normal" }] },
    ],
    renderResult: (r) => (
      <div className="grid grid-cols-2 gap-3">
        <Card title="Observed"><div className="text-lg font-semibold">{F(r.observed)}</div></Card>
        <Card title="Bias"><div className="text-lg font-semibold">{F(r.bias, 4)}</div></Card>
        <Card title="95% CI"><div className="text-sm font-semibold">[{F(r.ciLower)}, {F(r.ciUpper)}]</div></Card>
        <Card title="Method"><div className="text-sm font-semibold">{r.method}</div></Card>
      </div>
    ),
  },
  {
    key: "tes",
    title: "Excess Significance",
    description: "Ioannidis & Trikalinos test",
    endpoint: "/api/tes",
    icon: TrendingUp,
    fields: [{ name: "alpha", label: "Alpha", type: "number", default: 0.05 }],
    renderResult: (r) => (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Card title="Observed sig."><div className="text-lg font-semibold">{r.observedSignificant}</div></Card>
          <Card title="Expected"><div className="text-lg font-semibold">{F(r.expectedSignificant, 1)}</div></Card>
          <Card title="p-value"><div className="text-lg font-semibold">{F(r.pValue, 4)}</div></Card>
        </div>
        <div className={`text-xs rounded p-2 ${r.excessSignificance ? "text-yellow-400 bg-yellow-900/20" : "text-green-400 bg-green-900/20"}`}>{r.interpretation}</div>
      </div>
    ),
  },
];

export default function AnalysisHub({ project }: { project: Project }) {
  const [activeEngine, setActiveEngine] = useState<string>("bayesian");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [formData, setFormData] = useState<Record<string, any>>({});

  const engine = ENGINES.find(e => e.key === activeEngine)!;

  const getStudies = () => project.extraction?.studies || [];

  const runEngine = async () => {
    setBusy(true);
    setErr(null);
    try {
      const studies = getStudies();
      if (studies.length < 2) {
        setErr("Add at least 2 studies with effect sizes first.");
        setBusy(false);
        return;
      }

      const effects: number[] = [];
      const variances: number[] = [];
      for (const s of studies) {
        if (s.effect_size != null && s.effect_se != null && s.effect_se > 0) {
          effects.push(s.effect_size);
          variances.push(s.effect_se * s.effect_se);
        } else if (s.hr != null && s.hr_lower != null && s.hr_upper != null && s.hr > 0) {
          effects.push(Math.log(s.hr));
          const se = (Math.log(s.hr_upper) - Math.log(s.hr_lower)) / (2 * 1.96);
          variances.push(se * se);
        }
      }

      if (effects.length < 2) {
        setErr("Need at least 2 studies with effect_size/se or hr/hr_lower/hr_upper.");
        setBusy(false);
        return;
      }

      const fd = formData[activeEngine] || {};
      const body = { ...fd, effects, variances, standardErrors: variances.map(v => Math.sqrt(v)) };

      const result = await postJson<any>(engine.endpoint, body);
      setResults(prev => ({ ...prev, [activeEngine]: result }));
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [activeEngine]: { ...(prev[activeEngine] || {}), [field]: value }
    }));
  };

  return (
    <div className="space-y-4">
      {/* Engine selector */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2">
        {ENGINES.map(e => (
          <button key={e.key} onClick={() => setActiveEngine(e.key)}
            className={`px-3 py-1.5 text-xs rounded-t transition-colors flex items-center gap-1.5 ${activeEngine === e.key ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}>
            <e.icon size={13} /> {e.title}
          </button>
        ))}
      </div>

      <Card title={engine.title}>
        <p className="text-xs text-[var(--color-muted-foreground)] mb-3">{engine.description}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {engine.fields.map(f => (
            <div key={f.name}>
              {f.type === "number" && (
                <label className="block">
                  <span className="text-xs text-[var(--color-muted-foreground)]">{f.label}</span>
                  <input type="number" value={(formData[activeEngine]?.[f.name] ?? f.default) || 0}
                    onChange={e => updateField(f.name, parseFloat(e.target.value) || 0)}
                    className="flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px] mt-1" />
                </label>
              )}
              {f.type === "select" && (
                <label className="block">
                  <span className="text-xs text-[var(--color-muted-foreground)]">{f.label}</span>
                  <select value={formData[activeEngine]?.[f.name] || f.default}
                    onChange={e => updateField(f.name, e.target.value)}
                    className="flex w-full rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] px-3 py-2 text-[12.5px] mt-1">
                    {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>
        <Button onClick={runEngine} disabled={busy} className="mt-3">
          {busy ? "Running..." : "Run Analysis"}
        </Button>
      </Card>

      {err && <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded p-2">{err}</div>}

      {results[activeEngine] && (
        <Card title="Results">
          {engine.renderResult(results[activeEngine])}
        </Card>
      )}
    </div>
  );
}
