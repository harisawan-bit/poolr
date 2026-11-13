import { lazy, Suspense, useState } from "react";
import type { Project } from "../lib/project";
import Meta from "./Meta";
import { Search, ChevronRight } from "lucide-react";
const BayesianHub = lazy(() => import("./hub/BayesianHub").then((m) => ({ default: m.BayesianHub })));
const DiagnosticsHub = lazy(() => import("./hub/DiagnosticsHub").then((m) => ({ default: m.DiagnosticsHub })));
const NetworkHub = lazy(() => import("./hub/NetworkHub").then((m) => ({ default: m.NetworkHub })));
const ComplexDataHub = lazy(() => import("./hub/ComplexDataHub").then((m) => ({ default: m.ComplexDataHub })));
const DoseResponseHub = lazy(() => import("./hub/DoseResponseHub").then((m) => ({ default: m.DoseResponseHub })));
const DiagnosticHub = lazy(() => import("./hub/DiagnosticHub").then((m) => ({ default: m.DiagnosticHub })));
const FiguresHub = lazy(() => import("./hub/FiguresHub").then((m) => ({ default: m.FiguresHub })));
const SpecializedHub = lazy(() => import("./hub/SpecializedHub").then((m) => ({ default: m.SpecializedHub })));
const QualityHub = lazy(() => import("./hub/QualityHub").then((m) => ({ default: m.QualityHub })));
const InteroperabilityHub = lazy(() => import("./hub/InteroperabilityHub").then((m) => ({ default: m.InteroperabilityHub })));
const ReportsHub = lazy(() => import("./hub/ReportsHub").then((m) => ({ default: m.ReportsHub })));
const QualitativeHub = lazy(() => import("./hub/AdvancedEnginesHub").then((m) => ({ default: m.QualitativeHub })));
const AdvancedDiagnosticsHub = lazy(() => import("./hub/AdvancedEnginesHub").then((m) => ({ default: m.AdvancedDiagnosticsHub })));
import "./analysis-workspace.css";

const sections = [
  { title: "Analyze", pages: [
    ["pairwise", "Pairwise meta-analysis"], ["diagnostics", "Sensitivity and reporting bias"],
    ["bayesian", "Bayesian methods"], ["network", "Network meta-analysis"],
  ] },
  { title: "Other synthesis methods", pages: [
    ["diagnostic", "Diagnostic accuracy"], ["complex", "Survival, IPD and multilevel models"],
    ["doseresponse", "Dose-response"], ["qualitative", "Qualitative synthesis"],
    ["advanced", "Additional models"], ["specialized", "Specialized methods"],
  ] },
  { title: "Figures and reporting", pages: [
    ["figures", "Analysis figures"], ["quality", "Certainty and appraisal"], ["reports", "Replication and exports"],
    ["interop", "Import, deduplication and review tools"],
  ] },
] as const;
type CategoryKey = typeof sections[number]["pages"][number][0];
const pages = sections.flatMap(section => Array.from<readonly [CategoryKey, string]>(section.pages));

export default function AnalysisHub({ project, onProjectChange, initialSection = "pairwise", initialPanel }: {
  project: Project;
  onProjectChange: (project: Project) => void;
  initialSection?: CategoryKey;
  initialPanel?: string;
}) {
  const [active, setActive] = useState(initialSection);
  const [panel, setPanel] = useState(initialPanel);
  const [method, setMethod] = useState<CatalogItem>();
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const matches = needle ? ENGINE_CATALOG.filter(item =>
    `${item.name} ${item.description} ${item.inputs}`.toLowerCase().includes(needle)) : [];
  const title = pages.find(([key]) => key === active)?.[1];
  const props = { project, onProjectChange, initialPanel: method?.panel ?? panel, focusMethod: method?.id };
  const views = {
    pairwise: <Meta project={project} onChange={onProjectChange} />,
    diagnostics: <DiagnosticsHub {...props} />,
    bayesian: <BayesianHub {...props} />,
    network: <NetworkHub {...props} />,
    complex: <ComplexDataHub {...props} />,
    doseresponse: <DoseResponseHub {...props} />,
    diagnostic: <DiagnosticHub {...props} />,
    figures: <FiguresHub {...props} />,
    specialized: <SpecializedHub {...props} />,
    quality: <QualityHub {...props} />,
    interop: <InteroperabilityHub {...props} />,
    reports: <ReportsHub {...props} />,
    qualitative: <QualitativeHub {...props} />,
    advanced: <AdvancedDiagnosticsHub {...props} />,
  };
  return <div className="analysis-workspace">
    <nav aria-label="Analysis pages" className="analysis-directory">
      {sections.map(section => <section key={section.title}>
        <h2>{section.title}</h2>
        {section.pages.map(([key, label]) => <button key={key} type="button" aria-current={active === key ? "page" : undefined}
          onClick={() => { setActive(key); setPanel(undefined); setMethod(undefined); setFilter(""); }}>{label}</button>)}
      </section>)}
    </nav>
    <div className="analysis-page">
      <label className="analysis-search"><Search size={16} aria-hidden /><span className="sr-only">Find a method</span>
        <input type="search" placeholder="Find a method" value={filter} onChange={event => setFilter(event.target.value)} />
      </label>
      {needle && <section aria-label="Matching methods" className="analysis-results">
        {matches.length === 0 && <p role="status">No methods match this search.</p>}
        {matches.map(item => <button key={item.id} type="button" onClick={() => {
          setActive(item.category); setPanel(undefined); setMethod(item); setFilter("");
        }}>
          <span><strong>{item.name}</strong><small>{item.description}</small><small>Data needed: {item.inputs}</small></span>
          <ChevronRight size={16} aria-hidden />
        </button>)}
      </section>}
      <section aria-label={title} hidden={!!needle} key={method?.id ?? active}>
        <h2 className="analysis-page-title">{method?.name ?? title}</h2>
        {method && <p className="analysis-requirements">{method.description} <strong>Data needed:</strong> {method.inputs}.</p>}
        <Suspense fallback={<div role="status" className="p-4 text-xs text-[var(--color-text-muted)]">Loading analysis module…</div>}>
          {views[active]}
        </Suspense>
      </section>
    </div>
  </div>;
}

interface CatalogItem {
  id: string;
  name: string;
  category: CategoryKey;
  panel?: string;
  description: string;
  inputs: string;
}

const ENGINE_CATALOG: CatalogItem[] = [
  // Bayesian
  { id: "pairwise", name: "Pairwise meta-analysis", category: "pairwise", panel: "pairwise", description: "Combine comparable studies of the same contrast", inputs: "Extracted outcomes or study effects" },
  { id: "bayesian", name: "Bayesian MCMC Meta-Analysis", category: "bayesian", panel: "mcmc", description: "Gibbs sampler for hierarchical random-effects model with ROPE and Bayes Factor", inputs: "Effects & Variances" },
  { id: "bayesian-nma", name: "Bayesian NMA & SUCRA", category: "network", panel: "bayesian", description: "Hierarchical consistency model, SUCRA rankings and rank probabilities", inputs: "Treatment network pairs" },
  { id: "bmma", name: "Bayesian Model Averaging (RoBMA)", category: "bayesian", panel: "bmma", description: "Averages across fixed, random, PET-PEESE, and selection models", inputs: "Effects & SEs" },
  { id: "phylo", name: "Phylogenetic Meta-Analysis", category: "bayesian", panel: "bmma", description: "Models evolutionary non-independence using Pagel's λ and phylogenetic trees", inputs: "Species & Covariance" },

  // Diagnostics & Robustness
  { id: "gosh", name: "GOSH Heterogeneity Analysis", category: "diagnostics", panel: "gosh", description: "Compares pooled estimates across study subsets to explore heterogeneity", inputs: "Effects & Variances" },
  { id: "influence", name: "Cook's D & Influence Diagnostics", category: "diagnostics", panel: "influence", description: "Cook's distance, DFFITS, hat values, and studentized residuals", inputs: "Effects & Variances" },
  { id: "permutation", name: "Permutation Test", category: "diagnostics", panel: "robust", description: "Exact / Monte Carlo label permutation test for small study sets", inputs: "Effects & Variances" },
  { id: "bootstrap", name: "Bootstrap Confidence Intervals", category: "diagnostics", panel: "robust", description: "Percentile and BCa non-parametric bootstrap confidence intervals", inputs: "Effects & Variances" },
  { id: "tes", name: "Test of Excess Significance", category: "diagnostics", panel: "tes", description: "Ioannidis & Trikalinos binomial test for selective reporting bias", inputs: "Effects & Variances" },
  { id: "locationscale", name: "Location-Scale Meta-Regression", category: "diagnostics", panel: "tes", description: "Simultaneously models effect magnitude (location) and residual variance (scale)", inputs: "Effects & Moderators" },
  { id: "mi", name: "Multiple Imputation (Rubin's Rules)", category: "diagnostics", panel: "mi", description: "Predictive Mean Matching (PMM) and Rubin's variance combination for missing outcome data", inputs: "Effects & Variances w/ Missing" },
  { id: "prediction", name: "Prediction Intervals (Graham-Higgins)", category: "diagnostics", panel: "prediction", description: "95% prediction intervals for individual clinical settings with t-distribution critical values", inputs: "Pooled, SE, Tau², k" },
  { id: "modelaverage", name: "Frequentist Model Averaging", category: "diagnostics", panel: "prediction", description: "AICc-weighted multimodel averaging across DL, REML, ML, PM, and Fixed-Effect estimators", inputs: "Effects & Variances" },
  { id: "proportion", name: "Single-Arm Proportion Meta-Analysis", category: "diagnostics", panel: "proportion", description: "Pooled proportions via GLMM logit-normal and Freeman-Tukey double-arcsine transform", inputs: "Events (r) & Total (N)" },
  { id: "pvalue-combine", name: "P-Value Combination Suite", category: "diagnostics", panel: "pvalue", description: "Combines significance using Fisher, Stouffer Z, Tippett minimum, and Edgington sum tests", inputs: "List of p-values" },
  { id: "cluster-detect", name: "Funnel Plot Cluster Detection", category: "diagnostics", panel: "cluster", description: "DBSCAN density clustering on effect-precision space and Fail-Safe N calculations", inputs: "Effects & Variances" },
  { id: "clusterrobust", name: "Cluster-Robust Egger Test", category: "diagnostics", panel: "cluster", description: "Small-sample CRVE sandwich covariance estimator for publication bias with dependent studies", inputs: "Effects, SEs & Clusters" },

  // Network & Comparative
  { id: "nma", name: "Frequentist Network Meta-Analysis", category: "network", panel: "frequentist", description: "Rücker graph-theoretic NMA with network inconsistency decomposition", inputs: "Pairwise contrast pairs" },
  { id: "sucra-ci", name: "SUCRA Rankings & Bootstrap CIs", category: "network", panel: "sucra", description: "Surface Under Cumulative Ranking Curve with percentile bootstrap confidence bounds", inputs: "P-score / SUCRA matrix" },
  { id: "cnma", name: "Component Network Meta-Analysis", category: "network", panel: "cnma", description: "Estimates independent effects of components in multi-ingredient interventions", inputs: "Multi-component arms" },
  { id: "bucher", name: "Bucher Indirect Comparison", category: "network", panel: "cnma", description: "Indirect contrast via common comparator C (A vs B = A vs C - B vs C)", inputs: "Arms vs Common" },
  { id: "multiarm", name: "Multi-Arm Trial Adjustment", category: "network", panel: "multiarm", description: "Corrects covariance induced by shared control arms in 3-arm / 4-arm trials", inputs: "Multi-arm trials" },
  { id: "nma-multilevel", name: "3-Level Multilevel NMA", category: "network", panel: "multiarm", description: "Hierarchical network meta-analysis decomposing within-study and between-study trial variance", inputs: "Contrast network & Clusters" },
  { id: "nma-regression", name: "Network Meta-Regression", category: "network", panel: "multiarm", description: "Evaluates treatment-by-covariate interactions across complex multi-treatment networks", inputs: "Network & Study Covariates" },
  { id: "league-matrix", name: "League Table Matrix Generator", category: "network", panel: "figures", description: "Publication-ready vector SVG league matrix with all pairwise comparisons", inputs: "NMA Matrix" },
  { id: "bubble-plot", name: "Continuous Bubble Plot", category: "network", panel: "figures", description: "SVG continuous meta-regression plot with weights mapped to bubble radii", inputs: "Moderator & Effect" },

  // Complex Data & IPD
  { id: "ipd-from-km", name: "Guyot IPD from KM Curves", category: "complex", panel: "km", description: "Reconstructs individual patient survival times from digitized KM curves with CSV export", inputs: "Time & Survival coords" },
  { id: "tsa", name: "Trial Sequential Analysis (TSA)", category: "complex", panel: "tsa", description: "O'Brien-Fleming monitoring boundaries, required information size (RIS), and futility zones", inputs: "Information size & Events" },
  { id: "dca", name: "Decision Curve Analysis (DCA)", category: "complex", panel: "dca", description: "Net Benefit curves comparing model strategy against treat-all and treat-none thresholds", inputs: "Thresholds & Probabilities" },
  { id: "competing-risks", name: "Competing Risks (Fine-Gray)", category: "complex", panel: "competing", description: "Subdistribution hazard ratios (sHR) and cumulative incidence functions (CIF)", inputs: "Subdistribution Hazards" },
  { id: "cumulative-forest", name: "Cumulative Forest Evolution", category: "complex", panel: "cumulative", description: "Chronological cumulative meta-analysis tracking effect stabilization and I² evolution", inputs: "Studies ordered by Year" },
  { id: "prognostic-meta", name: "Prognostic Factor Meta-Analysis", category: "complex", panel: "prognostic", description: "Prognostic factor pooling with CHARMS checklist and TRIPOD compliance audit", inputs: "Adjusted HRs / ORs" },
  { id: "rve", name: "Robust Variance Estimation (RVE)", category: "complex", panel: "rve", description: "Hedges, Tipton & Pustejovsky CR2 correction for dependent effect sizes", inputs: "Effects & Study IDs" },
  { id: "multilevel", name: "3-Level Multilevel Meta-Analysis", category: "complex", panel: "multilevel", description: "Decomposes variance into sampling (L1), within-study (L2), and between-study (L3)", inputs: "Effects & Clusters" },

  // Dose-Response & Splines
  { id: "dose-gls", name: "Greenland-Longnecker GLS Trend", category: "doseresponse", panel: "gls", description: "Generalized Least Squares trend for correlated relative risks in categorized dose groups", inputs: "Doses, Cases & Relative Risks" },
  { id: "dose-rcs", name: "Restricted Cubic Splines (RCS)", category: "doseresponse", panel: "rcs", description: "Non-linear RCS dose-response curves with Harrell knot placement and Wald test of non-linearity", inputs: "Dose & Effect pairs" },
  { id: "dose-multi", name: "Multivariate Dose-Response", category: "doseresponse", panel: "multi", description: "Multivariate GLS pooling across multi-exposure dimensional studies", inputs: "Exposure doses & Covariance" },
  { id: "response-surface", name: "2D Response Surface", category: "doseresponse", panel: "surface", description: "Bivariate dose-interaction response surface modeling dual exposures", inputs: "Dose 1, Dose 2 & Effects" },
  { id: "spatiotemporal", name: "Spatio-Temporal Meta-Analysis", category: "doseresponse", panel: "spatio", description: "Spatial Matérn covariance kernel and temporal AR(1) autocorrelation modeling", inputs: "Coordinates, Year & Effects" },

  // Diagnostic Test Accuracy
  { id: "dta-bivariate", name: "Bivariate DTA Meta-Analysis (Reitsma)", category: "diagnostic", panel: "bivariate", description: "Joint bivariate GLMM for logit sensitivity and logit specificity with correlation ρ", inputs: "TP, FP, FN, TN 2x2 counts" },
  { id: "dta-hsroc", name: "HSROC Model (Rutter & Gatsonis)", category: "diagnostic", panel: "hsroc", description: "Hierarchical SROC estimating diagnostic accuracy, threshold parameter, and scale shape", inputs: "2x2 Contingency Tables" },
  { id: "dta-dor-forest", name: "Diagnostic OR Forest & SROC Curve", category: "diagnostic", panel: "dor", description: "Moses-Littenberg SROC curve with AUC integration and Diagnostic Odds Ratio forest plot", inputs: "2x2 Diagnostic Data" },
  { id: "prisma-dta-flow", name: "PRISMA-DTA 2018 Flow Diagram", category: "diagnostic", panel: "prisma", description: "Vector SVG flow tailored for diagnostic test accuracy systematic reviews", inputs: "DTA Identification Counts" },

  // Figures & Visualizations
  { id: "fig-galbraith", name: "Galbraith Radial Plot", category: "figures", panel: "galbraith", description: "Standardized effect vs precision with 95% confidence arc for heterogeneity screening", inputs: "Effects & Variances" },
  { id: "fig-labbe", name: "L'Abbé Binary Plot", category: "figures", panel: "labbe", description: "Experimental event rate vs control event rate with equality line and effect bubbles", inputs: "Binary 2x2 Arm Data" },
  { id: "fig-baujat", name: "Baujat Influence Plot", category: "figures", panel: "baujat", description: "Contribution to overall heterogeneity Q vs influence on overall pooled effect", inputs: "Effects & Variances" },
  { id: "fig-contour", name: "Contour-Enhanced Funnel Plot", category: "figures", panel: "contour", description: "Funnel plot overlaid with p < 0.10, p < 0.05, p < 0.01 statistical significance contours", inputs: "Meta-analysis model" },
  { id: "fig-forest", name: "Vector SVG Forest Plot", category: "figures", panel: "forest", description: "Publication-grade vector SVG forest plot with diamond summary and weights", inputs: "Meta-analysis model" },

  // Specialized & Niche
  { id: "umbrella", name: "Umbrella Review Evidence Grading", category: "specialized", panel: "umbrella", description: "Ioannidis Class I-IV criteria grading: significance, sample size, heterogeneity & Egger bias", inputs: "Systematic Review Meta-Analyses" },
  { id: "qualitative", name: "Qualitative Meta-Synthesis", category: "specialized", panel: "qualitative", description: "Thomas & Harden thematic synthesis with inductive descriptive coding and frequency matrix", inputs: "Qualitative Quotes & Themes" },
  { id: "bibliometrics", name: "Citation Network & Bibliometrics", category: "specialized", panel: "bibliometric", description: "Adjacency matrix, co-citation clustering, betweenness centrality, and H-index tracking", inputs: "Citation DOIs & References" },
  { id: "niche-corr", name: "Correlation Coefficient Meta-Analysis", category: "specialized", panel: "niche", description: "Fisher's z-transformation for Pearson r and Spearman rho correlations", inputs: "Correlation (r) & N" },
  { id: "niche-var", name: "Variability Ratio (VR / CVR)", category: "specialized", panel: "niche", description: "Nakagawa variability ratio and coefficient of variation ratio between groups", inputs: "Means, SDs & Sample sizes" },
  { id: "niche-sced", name: "Single-Case Experimental Design (SCED)", category: "specialized", panel: "niche", description: "Non-overlap of all pairs (NAP), Tau-U trend control, and Percentage of Non-Overlapping Data", inputs: "Baseline & Intervention Points" },
  { id: "niche-poisson", name: "Poisson GLMM Rate-Ratio", category: "specialized", panel: "niche", description: "Incidence rate ratio synthesis with log-person-time offsets and Poisson overdispersion", inputs: "Events & Person-Time Offsets" },
  { id: "niche-agreement", name: "Inter-Rater Reliability & Agreement", category: "specialized", panel: "niche", description: "Synthesis of Cohen's Kappa, Fleiss' Kappa, and Intraclass Correlation Coefficients (ICC)", inputs: "Kappa / ICC & Variances" },

  // Evidence Quality & GRADE
  { id: "rob2", name: "Cochrane Risk of Bias 2 (RoB 2)", category: "quality", panel: "rob2", description: "5 domains for RCTs with traffic light SVG and weighted summary bars", inputs: "Domain judgments" },
  { id: "robins-i", name: "ROBINS-I Tool", category: "quality", panel: "robins", description: "7 domains for non-randomized studies of interventions", inputs: "NRSI domains" },
  { id: "quadas-2", name: "QUADAS-2 Tool", category: "quality", panel: "quadas", description: "Quality assessment tool for diagnostic accuracy studies across 4 domains", inputs: "DTA domains" },
  { id: "amstar-2", name: "AMSTAR 2 Appraisal", category: "quality", panel: "amstar", description: "16-item critical appraisal instrument with critical flaw weighting", inputs: "Appraisal items" },
  { id: "nos", name: "Newcastle-Ottawa Scale (NOS)", category: "quality", panel: "nos", description: "Star rating system for cohort and case-control observational studies", inputs: "Selection & Outcome" },
  { id: "grade-profile", name: "GRADE Evidence Profile & SoF", category: "quality", panel: "grade", description: "Certainty ratings across 5 downgrade factors (RoB, Inconsistency, Imprecision, etc.)", inputs: "Study assessments" },

  // Interoperability & AI Review
  { id: "ai-screening", name: "Interactive AI Screening Panel", category: "interop", panel: "aiscreen", description: "Title/Abstract screening with PICO criteria, semantic confidence scoring, and reviewer override", inputs: "PICO Criteria & Citations" },
  { id: "revman", name: "RevMan 5 XML Import / Export", category: "interop", panel: "revman", description: "Full roundtrip compatibility with Cochrane Review Manager (.rm5)", inputs: "XML / CSV" },
  { id: "deduplicate", name: "Citation Deduplication Pipeline", category: "interop", panel: "dedup", description: "3-tier deduplication via DOI, Levenshtein title distance, and Author/Year", inputs: "Citation list" },
  { id: "prisma-dta", name: "PRISMA-DTA Flow Diagram", category: "interop", panel: "prisma", description: "Vector SVG flowchart tailored for diagnostic test accuracy systematic reviews", inputs: "Screening counts" },
  { id: "scr-flow", name: "PRISMA-ScR Scoping Diagram", category: "interop", panel: "prisma", description: "Vector SVG flowchart tailored for scoping reviews according to PRISMA-ScR", inputs: "ScR flow counts" },
  { id: "living-automate", name: "Living Review Surveillance", category: "interop", panel: "living", description: "Autonomous periodic surveillance search and screening threshold triggers", inputs: "Search query & timer" },

  // Reports & Reproducibility
  { id: "r-code", name: "R Replication Code Studio", category: "reports", panel: "r_code", description: "R code for reproducing the current pairwise analysis", inputs: "Model results & data" },
  { id: "methods-para", name: "Methods Paragraph Generator", category: "reports", panel: "methods", description: "Standardized Cochrane and PRISMA statistical methods text drafting", inputs: "Model parameters" },
  { id: "latex-manuscript", name: "LaTeX Manuscript & Tables", category: "reports", panel: "latex", description: "Full publication-grade LaTeX source with formatted tables and TikZ plots", inputs: "Synthesis results" },
  { id: "html-report", name: "Standalone HTML Executive Report", category: "reports", panel: "html", description: "Single-file interactive HTML report with embedded styles and charts", inputs: "Synthesis results" },
  { id: "stata-python", name: "Python & Stata Scripts", category: "reports", panel: "scripts", description: "Script translation into Python (statsmodels) and Stata meta commands", inputs: "Study datasets" },
  { id: "citations-export", name: "Bibliographic Citations Exporter", category: "reports", panel: "citations", description: "Export included studies into BibTeX (.bib) and RIS reference formats", inputs: "Citations / DOIs" },
];
