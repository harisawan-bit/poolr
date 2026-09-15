import { useState } from "react";
import type { Project } from "../lib/project";
import { StudySelector, useStudyManager } from "../components/StudyManager";
import { BayesianHub } from "./hub/BayesianHub";
import { DiagnosticsHub } from "./hub/DiagnosticsHub";
import { NetworkHub } from "./hub/NetworkHub";
import { ComplexDataHub } from "./hub/ComplexDataHub";
import { QualityHub } from "./hub/QualityHub";
import { InteroperabilityHub } from "./hub/InteroperabilityHub";
import {
  Activity,
  Grid3X3,
  GitMerge,
  FileSpreadsheet,
  ShieldCheck,
  ArrowLeftRight,
  Sparkles,
  Search,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

interface Props {
  project: Project;
  onProjectChange?: (p: Project) => void;
}

type CategoryKey = "overview" | "bayesian" | "diagnostics" | "network" | "complex" | "quality" | "interop";

interface CategoryMeta {
  key: CategoryKey;
  label: string;
  badge: string;
  Icon: any;
  description: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    key: "overview",
    label: "Engine Catalog",
    badge: "34 Engines",
    Icon: Sparkles,
    description: "Cable-managed overview and status matrix of all native analytical engines",
  },
  {
    key: "bayesian",
    label: "Bayesian & NMA",
    badge: "MCMC · SUCRA",
    Icon: Activity,
    description: "Gibbs sampling, Bayesian network meta-analysis, RoBMA model averaging & phylogeny",
  },
  {
    key: "diagnostics",
    label: "Diagnostics & Robustness",
    badge: "GOSH · Outliers",
    Icon: Grid3X3,
    description: "GOSH subset combinations, Cook's distance, permutation, BCa bootstrap & TES",
  },
  {
    key: "network",
    label: "Network & Comparative",
    badge: "CNMA · Bucher",
    Icon: GitMerge,
    description: "Frequentist NMA, Component NMA, Bucher indirect comparisons & multi-arm models",
  },
  {
    key: "complex",
    label: "Complex Data & IPD",
    badge: "Guyot · RVE · Splines",
    Icon: FileSpreadsheet,
    description: "IPD reconstruction from KM curves, robust variance estimation & 3-level models",
  },
  {
    key: "quality",
    label: "Evidence Quality & GRADE",
    badge: "RoB 2 · ROBINS-I",
    Icon: ShieldCheck,
    description: "RoB 2, ROBINS-I, QUADAS-2, AMSTAR 2, NOS, and GRADE Evidence Profiles",
  },
  {
    key: "interop",
    label: "Interoperability & Data Hub",
    badge: "RevMan · Sync",
    Icon: ArrowLeftRight,
    description: "RevMan 5 XML roundtrip, citation deduplication, Zotero/Mendeley sync & PRISMA flows",
  },
];

export default function AnalysisHub({ project, onProjectChange }: Props) {
  const { studies, activeStudyId, addStudy, removeStudy, switchStudy } = useStudyManager();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("bayesian");
  const [catalogFilter, setCatalogFilter] = useState("");

  const handleAddStudy = () => {
    const name = prompt("Study name:");
    if (name) {
      addStudy(name, project);
    }
  };

  const handleImportProject = async () => {
    alert("Use the Open button in the header bar or RevMan XML Hub to import datasets.");
  };

  return (
    <div className="space-y-4">
      {/* Top bar: Multi-Study dataset selector and active study context */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-3">
          <StudySelector
            studies={studies}
            activeStudyId={activeStudyId}
            onSwitch={switchStudy}
            onAdd={handleAddStudy}
            onRemove={removeStudy}
            onImport={handleImportProject}
          />
          <span className="text-xs text-[var(--color-muted-foreground)]">
            Active Study Dataset · {project.extraction?.studies?.length ?? 0} extracted studies ready
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
          <CheckCircle2 size={13} className="text-green-400" />
          <span className="font-mono font-medium text-[var(--color-text)]">C# Native Engine v0.6.1</span>
        </div>
      </div>

      {/* Segmented Category Navigation Bar — Cable Managed, no messy wiring */}
      <nav aria-label="Analysis Hub Categories" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          const Icon = cat.Icon;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                isActive
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)] shadow-sm"
                  : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] hover:border-[var(--color-border)] hover:bg-[var(--hover-surface)] hover:text-[var(--color-text)]"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <Icon size={16} className={isActive ? "text-[var(--color-accent)]" : ""} />
                <span
                  className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                    isActive
                      ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                      : "bg-[var(--color-border)]/60 text-[var(--color-muted-foreground)]"
                  }`}
                >
                  {cat.badge}
                </span>
              </div>
              <span className="text-xs font-semibold leading-tight line-clamp-1">{cat.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main active hub view */}
      <div className="mt-2">
        {activeCategory === "overview" && (
          <EngineCatalogView
            filter={catalogFilter}
            onFilterChange={setCatalogFilter}
            onSelectCategory={(cat) => setActiveCategory(cat)}
          />
        )}
        {activeCategory === "bayesian" && (
          <BayesianHub project={project} onProjectChange={onProjectChange} />
        )}
        {activeCategory === "diagnostics" && (
          <DiagnosticsHub project={project} onProjectChange={onProjectChange} />
        )}
        {activeCategory === "network" && (
          <NetworkHub project={project} onProjectChange={onProjectChange} />
        )}
        {activeCategory === "complex" && (
          <ComplexDataHub project={project} onProjectChange={onProjectChange} />
        )}
        {activeCategory === "quality" && (
          <QualityHub project={project} onProjectChange={onProjectChange} />
        )}
        {activeCategory === "interop" && (
          <InteroperabilityHub project={project} onProjectChange={onProjectChange} />
        )}
      </div>
    </div>
  );
}

// ─── Cable-Managed Engine Catalog & Status Matrix ───────────────────────────
interface CatalogItem {
  id: string;
  name: string;
  category: CategoryKey;
  endpoint: string;
  description: string;
  inputs: string;
  tag: string;
}

const ENGINE_CATALOG: CatalogItem[] = [
  // Bayesian
  { id: "bayesian", name: "Bayesian MCMC Meta-Analysis", category: "bayesian", endpoint: "/api/bayesian", description: "Gibbs sampler for hierarchical random-effects model with ROPE and Bayes Factor", inputs: "Effects & Variances", tag: "Gibbs MCMC" },
  { id: "bayesian-nma", name: "Bayesian NMA & SUCRA", category: "bayesian", endpoint: "/api/bayesian-nma", description: "Hierarchical consistency model, SUCRA rankings and rank probabilities", inputs: "Treatment network pairs", tag: "SUCRA / DIC" },
  { id: "bmma", name: "Bayesian Model Averaging (RoBMA)", category: "bayesian", endpoint: "/api/bma", description: "Averages across fixed, random, PET-PEESE, and selection models", inputs: "Effects & SEs", tag: "Model Averaged" },
  { id: "phylo", name: "Phylogenetic Meta-Analysis", category: "bayesian", endpoint: "/api/phylo", description: "Models evolutionary non-independence using Pagel's λ and phylogenetic trees", inputs: "Species & Covariance", tag: "Pagel's λ" },

  // Diagnostics
  { id: "gosh", name: "GOSH Heterogeneity Analysis", category: "diagnostics", endpoint: "/api/gosh", description: "Evaluates all 2ᵏ study subsets to identify multi-cluster heterogeneity patterns", inputs: "Effects & Variances", tag: "Combinatorics" },
  { id: "influence", name: "Cook's D & Influence Diagnostics", category: "diagnostics", endpoint: "/api/influence", description: "Cook's distance, DFFITS, hat values, and studentized residuals", inputs: "Effects & Variances", tag: "Diagnostics" },
  { id: "permutation", name: "Permutation Test", category: "diagnostics", endpoint: "/api/permutation", description: "Exact / Monte Carlo label permutation test for small study sets", inputs: "Effects & Variances", tag: "Non-Parametric" },
  { id: "bootstrap", name: "Bootstrap Confidence Intervals", category: "diagnostics", endpoint: "/api/bootstrap", description: "Percentile and BCa non-parametric bootstrap confidence intervals", inputs: "Effects & Variances", tag: "Resampling" },
  { id: "tes", name: "Test of Excess Significance", category: "diagnostics", endpoint: "/api/tes", description: "Ioannidis & Trikalinos binomial test for selective reporting bias", inputs: "Effects & Variances", tag: "Publication Bias" },
  { id: "locationscale", name: "Location-Scale Meta-Regression", category: "diagnostics", endpoint: "/api/locationscale", description: "Simultaneously models effect magnitude (location) and residual variance (scale)", inputs: "Effects & Moderators", tag: "Heteroskedastic" },
  { id: "clusterrobust", name: "Cluster-Robust Egger Test", category: "diagnostics", endpoint: "/api/clusterrobust", description: "Cluster-robust sandwich estimator for publication bias with dependent effects", inputs: "Effects & Clusters", tag: "CRVE" },

  // Network
  { id: "nma", name: "Frequentist Network Meta-Analysis", category: "network", endpoint: "/api/nma", description: "Rücker graph-theoretic NMA with network inconsistency decomposition", inputs: "Pairwise contrast pairs", tag: "Graph Theory" },
  { id: "cnma", name: "Component Network Meta-Analysis", category: "network", endpoint: "/api/cnma", description: "Estimates independent effects of components in multi-ingredient interventions", inputs: "Multi-component arms", tag: "Additivity" },
  { id: "bucher", name: "Bucher Indirect Comparison", category: "network", endpoint: "/api/bucher", description: "Indirect contrast via common comparator C (A vs B = A vs C - B vs C)", inputs: "Arms vs Common", tag: "Indirect Contrast" },
  { id: "multiarm", name: "Multi-Arm Trial Adjustment", category: "network", endpoint: "/api/nma/multiarm", description: "Corrects covariance induced by shared control arms in 3-arm / 4-arm trials", inputs: "Multi-arm trials", tag: "Covariance" },
  { id: "league-matrix", name: "League Table Matrix Generator", category: "network", endpoint: "/api/figure/league-matrix", description: "Publication-ready vector SVG league matrix with all pairwise comparisons", inputs: "NMA Matrix", tag: "SVG Vector" },
  { id: "bubble-plot", name: "Continuous Bubble Plot", category: "network", endpoint: "/api/figure/bubble", description: "SVG continuous meta-regression plot with weights mapped to bubble radii", inputs: "Moderator & Effect", tag: "SVG Vector" },

  // Complex Data & IPD
  { id: "ipd-from-km", name: "Guyot IPD from KM Curves", category: "complex", endpoint: "/api/ipd/from-km", description: "Reconstructs individual patient survival times from digitized KM curves", inputs: "Time & Survival coords", tag: "Guyot (2012)" },
  { id: "rve", name: "Robust Variance Estimation (RVE)", category: "complex", endpoint: "/api/rve", description: "Hedges, Tipton & Pustejovsky CR2 correction for dependent effect sizes", inputs: "Effects & Study IDs", tag: "CR2 Correction" },
  { id: "multilevel", name: "3-Level Multilevel Meta-Analysis", category: "complex", endpoint: "/api/multilevel", description: "Decomposes variance into sampling (L1), within-study (L2), and between-study (L3)", inputs: "Effects & Clusters", tag: "REML 3-Level" },
  { id: "dose", name: "Dose-Response & Splines", category: "complex", endpoint: "/api/dose", description: "GLS trend estimation with restricted cubic splines (RCS) and knot placement", inputs: "Dose & Outcome data", tag: "RCS Splines" },
  { id: "survival", name: "Survival & Competing Risks", category: "complex", endpoint: "/api/survival", description: "Restricted mean survival time (RMST) and cumulative incidence modeling", inputs: "Survival parameters", tag: "RMST" },

  // Quality & GRADE
  { id: "rob2", name: "Cochrane Risk of Bias 2 (RoB 2)", category: "quality", endpoint: "/api/rob2", description: "5 domains for RCTs with traffic light SVG and weighted summary bars", inputs: "Domain judgments", tag: "Cochrane Standard" },
  { id: "robins-i", name: "ROBINS-I Tool", category: "quality", endpoint: "/api/robins-i", description: "7 domains for non-randomized studies of interventions", inputs: "NRSI domains", tag: "Non-Randomized" },
  { id: "quadas-2", name: "QUADAS-2 Tool", category: "quality", endpoint: "/api/quadas-2", description: "Quality assessment tool for diagnostic accuracy studies across 4 domains", inputs: "DTA domains", tag: "Diagnostic" },
  { id: "amstar-2", name: "AMSTAR 2 Appraisal", category: "quality", endpoint: "/api/amstar-2", description: "16-item critical appraisal instrument with critical flaw weighting", inputs: "Appraisal items", tag: "Systematic Review" },
  { id: "nos", name: "Newcastle-Ottawa Scale (NOS)", category: "quality", endpoint: "/api/nos", description: "Star rating system for cohort and case-control observational studies", inputs: "Selection & Outcome", tag: "Observational" },
  { id: "grade-profile", name: "GRADE Evidence Profile & SoF", category: "quality", endpoint: "/api/grade/evidence-profile", description: "Certainty ratings across 5 downgrade factors (RoB, Inconsistency, Imprecision, etc.)", inputs: "Study assessments", tag: "GRADE Standard" },

  // Interoperability
  { id: "revman", name: "RevMan 5 XML Import / Export", category: "interop", endpoint: "/api/revman/import", description: "Full roundtrip compatibility with Cochrane Review Manager (.rm5)", inputs: "XML / CSV", tag: "Cochrane XML" },
  { id: "deduplicate", name: "Citation Deduplication Pipeline", category: "interop", endpoint: "/api/deduplicate", description: "3-tier deduplication via DOI, Levenshtein title distance, and Author/Year", inputs: "Citation list", tag: "Multi-Pass" },
  { id: "zotero", name: "Zotero & Mendeley Sync", category: "interop", endpoint: "/api/zotero/connect", description: "Two-way cloud reference sync for libraries, collections, and attachments", inputs: "API Credentials", tag: "Reference Sync" },
  { id: "prisma-dta", name: "PRISMA-DTA Flow Diagram", category: "interop", endpoint: "/api/prisma-dta", description: "Vector SVG flowchart tailored for diagnostic test accuracy systematic reviews", inputs: "Screening counts", tag: "PRISMA-DTA" },
  { id: "scr-flow", name: "PRISMA-ScR Scoping Diagram", category: "interop", endpoint: "/api/scr/flow", description: "Vector SVG flowchart tailored for scoping reviews according to PRISMA-ScR", inputs: "ScR flow counts", tag: "PRISMA-ScR" },
  { id: "living-automate", name: "Living Review Surveillance", category: "interop", endpoint: "/api/living/automate", description: "Autonomous periodic surveillance search and screening threshold triggers", inputs: "Search query & timer", tag: "Autonomous" },
];

function EngineCatalogView({
  filter,
  onFilterChange,
  onSelectCategory,
}: {
  filter: string;
  onFilterChange: (s: string) => void;
  onSelectCategory: (cat: CategoryKey) => void;
}) {
  const filtered = ENGINE_CATALOG.filter(
    (e) =>
      e.name.toLowerCase().includes(filter.toLowerCase()) ||
      e.description.toLowerCase().includes(filter.toLowerCase()) ||
      e.endpoint.toLowerCase().includes(filter.toLowerCase()) ||
      e.tag.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 bg-[var(--color-card)] p-4 rounded-xl border border-[var(--color-border)]">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Native Engine Registry (34 Methods)</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            All algorithms run in-process on the local C# sidecar with zero cloud latency.
          </p>
        </div>
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            type="text"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Search engines, endpoints, tags…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--input-bg)] text-[var(--color-text)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectCategory(item.category)}
            className="group flex flex-col justify-between p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-accent)] hover:bg-[var(--hover-surface)] transition-all cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold">
                  {item.tag}
                </span>
                <span className="text-[10px] font-mono text-[var(--color-muted-foreground)] truncate max-w-[140px]">
                  {item.endpoint}
                </span>
              </div>
              <h3 className="text-xs font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                {item.name}
              </h3>
              <p className="text-[11px] text-[var(--color-muted-foreground)] mt-1 line-clamp-2">
                {item.description}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-[var(--color-border)]/50 flex items-center justify-between text-[10.5px]">
              <span className="text-[var(--color-muted-foreground)]">Inputs: {item.inputs}</span>
              <span className="flex items-center text-[var(--color-accent)] font-medium group-hover:translate-x-0.5 transition-transform">
                Open <ChevronRight size={12} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
