import { useState } from "react";
import type { Project } from "../lib/project";
import { Card, Button } from "../components/ui";
import { postJson } from "../lib/api";
import { Activity, BarChart3, TrendingUp, Zap, GitBranch, Grid3X3, Layers, Target, Globe, FileText, Users, Link, Database, Download, Upload, AlertTriangle, Scale, Hash, Brain, ShieldAlert } from "lucide-react";

const F = (n: number, d = 3) => n.toFixed(d);

interface EngineConfig {
  key: string;
  title: string;
  category: string;
  description: string;
  endpoint: string;
  icon: any;
  fields: FieldConfig[];
  needsExtraction?: boolean;
  renderResult: (result: any) => React.ReactNode;
}

interface FieldConfig {
  name: string;
  label: string;
  type: "number" | "select" | "boolean";
  default?: any;
  options?: { value: string; label: string }[];
}

const ENGINES: EngineConfig[] = [
  // HETEROGENEITY & ROBUST
  { key: "bayesian", title: "Bayesian MCMC", category: "Bayesian", description: "Gibbs sampling with R-hat, ESS, Bayes factor", endpoint: "/api/bayesian", icon: Activity, fields: [{ name: "iter", label: "Iterations", type: "number", default: 10000 }, { name: "warmup", label: "Warmup", type: "number", default: 2000 }, { name: "chains", label: "Chains", type: "number", default: 4 }], renderResult: (r) => (<div className="grid grid-cols-2 gap-3"><Card title="μ (median)"><div className="text-lg font-semibold">{F(r.muMedian)}</div></Card><Card title="τ (median)"><div className="text-lg font-semibold">{F(r.tauMedian)}</div></Card><Card title="R-hat"><div className={`text-lg font-semibold ${r.rhatMu > 1.1 ? "text-yellow-400" : "text-green-400"}`}>{F(r.rhatMu, 3)}</div></Card><Card title="ESS"><div className="text-lg font-semibold">{Math.round(r.essMu)}</div></Card></div>) },
  { key: "gosh", title: "GOSH", category: "Heterogeneity", description: "Graphic Approach to Heterogeneity", endpoint: "/api/gosh", icon: Grid3X3, fields: [{ name: "maxSubsets", label: "Max subsets", type: "number", default: 10000 }], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-3 gap-3"><Card title="Overall"><div className="text-lg font-semibold">{F(r.overallPooled)}</div></Card><Card title="τ²"><div className="text-lg font-semibold">{F(r.overallTau2)}</div></Card><Card title="Subsets"><div className="text-lg font-semibold">{r.nSubsetsGenerated}</div></Card></div>{r.clusterWarnings?.length > 0 && <div className="text-xs text-yellow-400">{r.clusterWarnings[0]}</div>}</div>) },
  { key: "influence", title: "Influence", category: "Diagnostics", description: "Cook's D, DFFITS, studentized residuals", endpoint: "/api/influence", icon: Zap, fields: [], renderResult: (r) => (<div className="grid grid-cols-2 gap-3"><Card title="Influential"><div className="text-lg font-semibold">{r.nInfluential}</div></Card><Card title="Outliers"><div className="text-lg font-semibold">{r.nOutliers}</div></Card></div>) },
  { key: "permutation", title: "Permutation", category: "Robust", description: "Non-parametric p-value", endpoint: "/api/permutation", icon: GitBranch, fields: [{ name: "nPermutations", label: "Permutations", type: "number", default: 5000 }], renderResult: (r) => (<div className="grid grid-cols-3 gap-3"><Card title="Observed"><div className="text-lg font-semibold">{F(r.observedStatistic)}</div></Card><Card title="p-value"><div className="text-lg font-semibold">{F(r.pValue, 4)}</div></Card><Card title="N"><div className="text-lg font-semibold">{r.nPermutations}</div></Card></div>) },
  { key: "bootstrap", title: "Bootstrap", category: "Robust", description: "Percentile, BCa, normal", endpoint: "/api/bootstrap", icon: BarChart3, fields: [{ name: "nBootstrap", label: "Samples", type: "number", default: 5000 }, { name: "method", label: "Method", type: "select", default: "percentile", options: [{ value: "percentile", label: "Percentile" }, { value: "bca", label: "BCa" }, { value: "normal", label: "Normal" }] }], renderResult: (r) => (<div className="grid grid-cols-2 gap-3"><Card title="Observed"><div className="text-lg font-semibold">{F(r.observed)}</div></Card><Card title="Bias"><div className="text-lg font-semibold">{F(r.bias, 4)}</div></Card><Card title="95% CI"><div className="text-sm font-semibold">[{F(r.ciLower)}, {F(r.ciUpper)}]</div></Card><Card title="Method"><div className="text-sm font-semibold capitalize">{r.method}</div></Card></div>) },
  { key: "tes", title: "Excess Signif.", category: "Bias", description: "Ioannidis test", endpoint: "/api/tes", icon: TrendingUp, fields: [{ name: "alpha", label: "Alpha", type: "number", default: 0.05 }], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-3 gap-3"><Card title="Observed"><div className="text-lg font-semibold">{r.observedSignificant}</div></Card><Card title="Expected"><div className="text-lg font-semibold">{F(r.expectedSignificant, 1)}</div></Card><Card title="p-value"><div className="text-lg font-semibold">{F(r.pValue, 4)}</div></Card></div><div className={`text-xs rounded p-2 ${r.excessSignificance ? "text-yellow-400 bg-yellow-900/20" : "text-green-400 bg-green-900/20"}`}>{r.interpretation}</div></div>) },
  { key: "locationscale", title: "Location-Scale", category: "Advanced", description: "Heterogeneity as function of moderator", endpoint: "/api/locationscale", icon: Target, fields: [], renderResult: (r) => (<div className="grid grid-cols-2 gap-3"><Card title="Location Int."><div className="text-lg font-semibold">{F(r.locationIntercept)}</div></Card><Card title="Location Slope"><div className="text-lg font-semibold">{F(r.locationSlope)}</div></Card><Card title="τ²"><div className="text-lg font-semibold">{F(r.tau2)}</div></Card><Card title="I²"><div className="text-lg font-semibold">{F(r.i2, 1)}%</div></Card></div>) },
  { key: "mi", title: "Multiple Imp.", category: "Missing Data", description: "Rubin's rules for missing data", endpoint: "/api/mi", icon: Layers, fields: [{ name: "m", label: "Imputations", type: "number", default: 20 }], renderResult: (r) => (<div className="grid grid-cols-3 gap-3"><Card title="Pooled"><div className="text-lg font-semibold">{F(r.pooledEffect)}</div></Card><Card title="Within Var"><div className="text-lg font-semibold">{F(r.withinVariance)}</div></Card><Card title="Between Var"><div className="text-lg font-semibold">{F(r.betweenVariance)}</div></Card></div>) },
  { key: "rcs", title: "RCS Splines", category: "Dose-Response", description: "Restricted cubic splines", endpoint: "/api/rcs", icon: Activity, fields: [{ name: "nKnots", label: "Knots", type: "select", default: "3", options: [{ value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5" }] }], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Card title="Nonlin. p"><div className="text-lg font-semibold">{F(r.nonlinearityP, 4)}</div></Card><Card title="AIC"><div className="text-lg font-semibold">{F(r.aic, 1)}</div></Card></div></div>) },
  { key: "clusterrobust", title: "Cluster-Robust", category: "Robust", description: "Hedges-Tipton-Pustejovsky", endpoint: "/api/clusterrobust", icon: ShieldAlert, fields: [], renderResult: (r) => (<div className="grid grid-cols-2 gap-3"><Card title="Pooled"><div className="text-lg font-semibold">{F(r.pooledEffect)}</div></Card><Card title="Robust SE"><div className="text-lg font-semibold">{F(r.robustSe)}</div></Card><Card title="Naive SE"><div className="text-lg font-semibold">{F(r.naiveSe)}</div></Card><Card title="Design Eff."><div className="text-lg font-semibold">{F(r.designEffect, 2)}</div></Card></div>) },
  { key: "rve", title: "RVE", category: "Robust", description: "Robust Variance Estimation", endpoint: "/api/rve", icon: Scale, fields: [{ name: "correction", label: "Correction", type: "select", default: "CR2", options: [{ value: "CR0", label: "CR0" }, { value: "CR1", label: "CR1" }, { value: "CR2", label: "CR2" }] }], renderResult: (r) => (<div className="grid grid-cols-2 gap-3"><Card title="Pooled"><div className="text-lg font-semibold">{F(r.pooledEffect)}</div></Card><Card title="Robust SE"><div className="text-lg font-semibold">{F(r.robustSe)}</div></Card><Card title="df"><div className="text-lg font-semibold">{F(r.df, 1)}</div></Card><Card title="p"><div className="text-lg font-semibold">{F(r.p, 4)}</div></Card></div>) },

  // NETWORK MA
  { key: "bayesiannma", title: "Bayes NMA", category: "Network MA", description: "MCMC for NMA with DIC", endpoint: "/api/bayesian-nma", icon: Brain, fields: [{ name: "iter", label: "Iterations", type: "number", default: 5000 }, { name: "warmup", label: "Warmup", type: "number", default: 1000 }, { name: "chains", label: "Chains", type: "number", default: 2 }], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-3 gap-3"><Card title="τ²"><div className="text-lg font-semibold">{F(r.tau2)}</div></Card><Card title="DIC"><div className="text-lg font-semibold">{F(r.dic, 1)}</div></Card><Card title="pD"><div className="text-lg font-semibold">{F(r.pd, 1)}</div></Card></div></div>) },
  { key: "nmaregression", title: "NMA Reg.", category: "Network MA", description: "Study-level covariates", endpoint: "/api/nma/regression", icon: Target, fields: [], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Card title="Treatments"><div className="text-lg font-semibold">{r.treatments?.length || 0}</div></Card><Card title="Covariates"><div className="text-lg font-semibold">{r.covariateEffects?.length || 0}</div></Card></div></div>) },
  { key: "multilevelnma", title: "Multilevel NMA", category: "Network MA", description: "3-level hierarchical", endpoint: "/api/nma/multilevel", icon: Layers, fields: [], renderResult: (r) => (<div className="grid grid-cols-3 gap-3"><Card title="τ² within"><div className="text-lg font-semibold">{F(r.tau2Within)}</div></Card><Card title="τ² between"><div className="text-lg font-semibold">{F(r.tau2Between)}</div></Card><Card title="I²"><div className="text-lg font-semibold">{F(r.i2Total, 1)}%</div></Card></div>) },
  { key: "cnma", title: "CNMA", category: "Network MA", description: "Component NMA", endpoint: "/api/cnma", icon: GitBranch, fields: [], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Card title="Components"><div className="text-lg font-semibold">{r.nComponents}</div></Card><Card title="Interventions"><div className="text-lg font-semibold">{r.nInterventions}</div></Card></div></div>) },
  { key: "bucher", title: "Bucher", category: "Network MA", description: "Indirect comparison", endpoint: "/api/bucher", icon: Link, fields: [], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Card title="Indirect Effect"><div className="text-lg font-semibold">{F(r.indirectEffect)}</div></Card><Card title="95% CI"><div className="text-sm font-semibold">[{F(r.ciLower)}, {F(r.ciUpper)}]</div></Card></div><div className="text-xs text-[var(--color-muted-foreground)]">{r.interpretation}</div></div>) },
  { key: "multiarm", title: "Multi-Arm", category: "Network MA", description: "Multi-arm trial correction", endpoint: "/api/nma/multiarm", icon: Users, fields: [], renderResult: (r) => (<div className="grid grid-cols-3 gap-3"><Card title="Effects"><div className="text-lg font-semibold">{r.effects?.length || 0}</div></Card><Card title="Q"><div className="text-lg font-semibold">{F(r.qTotal, 2)}</div></Card><Card title="I²"><div className="text-lg font-semibold">{F(r.i2, 1)}%</div></Card></div>) },

  // DIAGNOSTIC & SURVIVAL
  { key: "bivariatedta", title: "Bivariate DTA", category: "Diagnostic", description: "Joint sens/spec pooling", endpoint: "/api/dta/bivariate", icon: Target, fields: [], renderResult: (r) => (<div className="grid grid-cols-2 gap-3"><Card title="Sensitivity"><div className="text-lg font-semibold">{F(r.sensitivity, 3)}</div></Card><Card title="Specificity"><div className="text-lg font-semibold">{F(r.specificity, 3)}</div></Card><Card title="DOR"><div className="text-lg font-semibold">{F(r.dor, 2)}</div></Card><Card title="AUC"><div className="text-lg font-semibold">{F(r.auc, 3)}</div></Card></div>) },
  { key: "hsroc", title: "HSROC", category: "Diagnostic", description: "Hierarchical SROC", endpoint: "/api/dta/hsroc", icon: Activity, fields: [], renderResult: (r) => (<div className="grid grid-cols-3 gap-3"><Card title="θ (accuracy)"><div className="text-lg font-semibold">{F(r.theta)}</div></Card><Card title="λ"><div className="text-lg font-semibold">{F(r.lambda)}</div></Card><Card title="AUC"><div className="text-lg font-semibold">{F(r.auc, 3)}</div></Card></div>) },
  { key: "competingrisks", title: "Comp. Risks", category: "Survival", description: "Competing risks MA", endpoint: "/api/competing-risks", icon: AlertTriangle, fields: [], renderResult: (r) => (<div className="grid grid-cols-2 gap-3"><Card title="Pooled HR1"><div className="text-lg font-semibold">{F(r.pooledHr1)}</div></Card><Card title="Pooled HR2"><div className="text-lg font-semibold">{F(r.pooledHr2)}</div></Card><Card title="τ²₁"><div className="text-lg font-semibold">{F(r.tau21)}</div></Card><Card title="τ²₂"><div className="text-lg font-semibold">{F(r.tau22)}</div></Card></div>) },
  { key: "ipdfromkm", title: "IPDfromKM", category: "Survival", description: "Reconstruct IPD from KM", endpoint: "/api/ipd/from-km", icon: Database, fields: [], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-3 gap-3"><Card title="Total"><div className="text-lg font-semibold">{r.totalPatients}</div></Card><Card title="Events"><div className="text-lg font-semibold">{r.totalEvents}</div></Card><Card title="Censored"><div className="text-lg font-semibold">{r.totalCensored}</div></Card></div><div className="grid grid-cols-2 gap-3"><Card title="Recon. HR"><div className="text-lg font-semibold">{F(r.reconstructedHr)}</div></Card><Card title="Median"><div className="text-lg font-semibold">{F(r.reconstructedMedian, 1)}</div></Card></div></div>) },

  // REPORTING & WORKFLOW
  { key: "grade", title: "GRADE SoF", category: "Reporting", description: "Summary of Findings", endpoint: "/api/grade/sof-table", icon: FileText, fields: [], needsExtraction: false, renderResult: (r) => (<div className="space-y-3"><div className="text-sm font-semibold">Generated {r.outcomes?.length || 0} outcome rows</div><pre className="text-xs bg-[#1a1b23] p-3 rounded max-h-48 overflow-auto whitespace-pre-wrap">{r.markdown?.slice(0, 800)}...</pre></div>) },
  { key: "citationdedup", title: "Cit. Dedup.", category: "Workflow", description: "Citation deduplication", endpoint: "/api/deduplicate", icon: Layers, fields: [], needsExtraction: false, renderResult: (r) => (<div className="grid grid-cols-3 gap-3"><Card title="Total"><div className="text-lg font-semibold">{r.totalCitations}</div></Card><Card title="Unique"><div className="text-lg font-semibold">{r.uniqueCitations}</div></Card><Card title="Dups Removed"><div className="text-lg font-semibold">{r.duplicatesRemoved}</div></Card></div>) },
  { key: "citationnetwork", title: "Cit. Network", category: "Workflow", description: "Co-citation analysis", endpoint: "/api/citation/network", icon: GitBranch, fields: [], needsExtraction: false, renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-3 gap-3"><Card title="Papers"><div className="text-lg font-semibold">{r.totalPapers}</div></Card><Card title="Co-citations"><div className="text-lg font-semibold">{r.coCitations?.length || 0}</div></Card><Card title="Clusters"><div className="text-lg font-semibold">{r.clusters?.length || 0}</div></Card></div></div>) },
  { key: "prismascr", title: "PRISMA-ScR", category: "Reporting", description: "Scoping review flow", endpoint: "/api/scr/flow", icon: FileText, fields: [], needsExtraction: false, renderResult: (r) => (<div className="space-y-3"><div className="text-sm font-semibold mb-2">Flow Diagram Generated</div><div className="grid grid-cols-4 gap-2 text-xs"><Card title="Identified"><div className="text-base font-semibold">{r.totalIdentified}</div></Card><Card title="Screened"><div className="text-base font-semibold">{r.recordsScreened}</div></Card><Card title="Eligible"><div className="text-base font-semibold">{r.fullTextAssessed}</div></Card><Card title="Included"><div className="text-base font-semibold">{r.studiesIncluded}</div></Card></div></div>) },
  { key: "bmma", title: "BMMA", category: "Bayesian", description: "Model-averaged MA", endpoint: "/api/bma", icon: Layers, fields: [], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Card title="Pooled"><div className="text-lg font-semibold">{F(r.pooledEffect)}</div></Card><Card title="95% CI"><div className="text-sm font-semibold">[{F(r.ciLower)}, {F(r.ciUpper)}]</div></Card></div><div className="text-xs text-[var(--color-muted-foreground)]">Models: {r.models?.length || 0} | PB prob: {F(r.publicationBiasProbability * 100, 1)}%</div></div>) },
  { key: "phylo", title: "Phylo MA", category: "Specialized", description: "Phylogenetic correlation", endpoint: "/api/phylo", icon: GitBranch, fields: [], renderResult: (r) => (<div className="grid grid-cols-2 gap-3"><Card title="Pooled"><div className="text-lg font-semibold">{F(r.pooledEffect)}</div></Card><Card title="τ²"><div className="text-lg font-semibold">{F(r.tau2)}</div></Card><Card title="λ (signal)"><div className="text-lg font-semibold">{F(r.phylogeneticSignal, 3)}</div></Card><Card title="I²"><div className="text-lg font-semibold">{F(r.i2, 1)}%</div></Card></div>) },
  { key: "pvalue", title: "P-Value Comb.", category: "Robust", description: "Fisher, Stouffer, etc.", endpoint: "/api/pvalue/combine", icon: Hash, fields: [{ name: "method", label: "Method", type: "select", default: "fisher", options: [{ value: "fisher", label: "Fisher" }, { value: "stouffer", label: "Stouffer" }, { value: "tippett", label: "Tippett" }, { value: "edgington", label: "Edgington" }] }], renderResult: (r) => (<div className="grid grid-cols-3 gap-3"><Card title="Combined p"><div className="text-lg font-semibold">{F(r.combinedP, 4)}</div></Card><Card title="Statistic"><div className="text-lg font-semibold">{F(r.testStatistic, 2)}</div></Card><Card title="Method"><div className="text-lg font-semibold capitalize">{r.method}</div></Card></div>) },
  { key: "umbrella", title: "Umbrella", category: "Review", description: "Review of reviews", endpoint: "/api/umbrella", icon: Layers, fields: [], needsExtraction: false, renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-3 gap-3"><Card title="Reviews"><div className="text-lg font-semibold">{r.nReviews}</div></Card><Card title="Unique Studies"><div className="text-lg font-semibold">{r.totalUniqueStudies}</div></Card><Card title="CCA"><div className="text-lg font-semibold">{F(r.cca, 1)}%</div></Card></div><div className={`text-xs ${r.overlapLevel === "High" || r.overlapLevel === "Very high" ? "text-yellow-400" : "text-green-400"}`}>Overlap: {r.overlapLevel}</div></div>) },
  { key: "spatiotemporal", title: "Spatio-Temp.", category: "Specialized", description: "Space-time MA", endpoint: "/api/spatiotemporal", icon: Globe, fields: [], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Card title="Pooled"><div className="text-lg font-semibold">{F(r.pooledEffect)}</div></Card><Card title="Moran's I"><div className="text-lg font-semibold">{F(r.moranI, 3)}</div></Card><Card title="τ²"><div className="text-lg font-semibold">{F(r.tau2)}</div></Card><Card title="I²"><div className="text-lg font-semibold">{F(r.i2, 1)}%</div></Card></div></div>) },
  { key: "responsesurface", title: "Response Surf.", category: "Dose-Response", description: "2D dose-response", endpoint: "/api/response-surface", icon: Grid3X3, fields: [{ name: "model", label: "Model", type: "select", default: "linear", options: [{ value: "linear", label: "Linear" }, { value: "interaction", label: "Interaction" }, { value: "quadratic", label: "Quadratic" }] }], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Card title="R²"><div className="text-lg font-semibold">{F(r.r2, 3)}</div></Card><Card title="Q"><div className="text-lg font-semibold">{F(r.q, 2)}</div></Card><Card title="AIC"><div className="text-lg font-semibold">{F(r.aic, 1)}</div></Card><Card title="BIC"><div className="text-lg font-semibold">{F(r.bic, 1)}</div></Card></div></div>) },
  { key: "multivariatedose", title: "Multivar. Dose", category: "Dose-Response", description: "Multiple outcomes", endpoint: "/api/dose/multivariate", icon: Layers, fields: [], renderResult: (r) => (<div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Card title="R²"><div className="text-lg font-semibold">{F(r.r2, 3)}</div></Card><Card title="Q"><div className="text-lg font-semibold">{F(r.q, 2)}</div></Card><Card title="I²"><div className="text-lg font-semibold">{F(r.i2, 1)}%</div></Card><Card title="Model"><div className="text-sm font-semibold">{r.model}</div></Card></div></div>) },

  // SYNC
  { key: "zotero", title: "Zotero", category: "Sync", description: "Zotero sync", endpoint: "/api/zotero/connect", icon: Download, fields: [], needsExtraction: false, renderResult: (r) => (<div className="space-y-3"><div className={`text-lg font-semibold ${r.connected ? "text-green-400" : "text-red-400"}`}>{r.connected ? "Connected" : "Not Connected"}</div><Card title="Items"><div className="text-lg font-semibold">{r.totalItems}</div></Card></div>) },
  { key: "mendeley", title: "Mendeley", category: "Sync", description: "Mendeley sync", endpoint: "/api/mendeley/connect", icon: Upload, fields: [], needsExtraction: false, renderResult: (r) => (<div className="space-y-3"><div className={`text-lg font-semibold ${r.connected ? "text-green-400" : "text-red-400"}`}>{r.connected ? "Connected" : "Not Connected"}</div><Card title="Documents"><div className="text-lg font-semibold">{r.totalDocuments}</div></Card></div>) },
];

const CATEGORIES = ["All", ...Array.from(new Set(ENGINES.map(e => e.category)))];

export default function AnalysisHub({ project }: { project: Project }) {
  const [activeEngine, setActiveEngine] = useState<string>("bayesian");
  const [activeCategory, setActiveCategory] = useState<string>("All");
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
      const fd = formData[activeEngine] || {};
      let body: any = { ...fd };

      if (engine.needsExtraction !== false) {
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
            if (se > 0) variances.push(se * se);
          }
        }

        if (effects.length < 2) {
          setErr("Need at least 2 studies with effect_size/se or hr/hr_lower/hr_upper.");
          setBusy(false);
          return;
        }

        body.effects = effects;
        body.variances = variances;
        body.standardErrors = variances.map((v: number) => Math.sqrt(v));
      }

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

  const filteredEngines = activeCategory === "All" ? ENGINES : ENGINES.filter(e => e.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Category selector */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-2 py-1 text-xs rounded transition-colors ${activeCategory === cat ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Engine selector */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] pb-2">
        {filteredEngines.map(e => (
          <button key={e.key} onClick={() => setActiveEngine(e.key)}
            className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${activeEngine === e.key ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}>
            <e.icon size={11} /> {e.title}
          </button>
        ))}
      </div>

      <Card title={engine.title}>
        <p className="text-xs text-[var(--color-muted-foreground)] mb-3">{engine.description}</p>
        {engine.fields.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
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
        )}
        <Button onClick={runEngine} disabled={busy}>
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
