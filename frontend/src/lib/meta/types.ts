// Shared types for the meta-analysis engine
// All interfaces used across meta/ modules live here.

/** Single-study input for meta-analysis */
export interface StudyInput {
  study: string;
  // Binary
  int_events?: number;
  int_n?: number;
  ctrl_events?: number;
  ctrl_n?: number;
  // Continuous
  int_mean?: number;
  int_sd?: number;
  ctrl_mean?: number;
  ctrl_sd?: number;
  // Survival
  hr?: number;
  hr_lower?: number;
  hr_upper?: number;
  // Generic
  effect_size?: number;
  se?: number;
  effect_se?: number;
  // Subgroup
  subgroup?: string;
  // Meta-regression
  year?: number;
  design?: string;
  // Total N (for Peters' test, bubble plots)
  n_total?: number;
}

/** Settings controlling the meta-analysis model */
export interface MetaSettings {
  measure: 'OR' | 'RR' | 'RD' | 'MD' | 'SMD';
  model: 'random' | 'fixed';
  method: 'DL' | 'REML' | 'PM' | 'HS' | 'ML' | 'EB';
}

/** Result for a single study (effect, CI, weight) */
export interface StudyResult {
  study: string;
  effect: number;
  ci_lower: number;
  ci_upper: number;
  weight: number;
  subgroup: string;
  se?: number;
}

/** Pooled effect result */
export interface PooledResult {
  effect: number;
  ci_lower: number;
  ci_upper: number;
  se: number;
  z: number;
  p: number;
  ci_method?: string;
}

/** Heterogeneity statistics */
export interface HeterogeneityResult {
  q: number;
  df: number;
  q_p: number;
  i2: number;
  i2_lower: number;
  i2_upper: number;
  tau2: number;
  tau: number;
  h2: number;
}

/** Complete meta-analysis output */
export interface MetaAnalysisResult {
  pooled: PooledResult;
  heterogeneity: HeterogeneityResult;
  studies: StudyResult[];
  subgroups?: {
    groups: { name: string; effect: number; ci_lower: number; ci_upper: number; k: number; i2_within?: number }[];
    between?: { q: number; df: number; p: number };
  };
  sensitivity?: {
    leave_one_out: { excluded: string; effect: number; ci_lower: number; ci_upper: number; i2: number }[];
    most_influential?: string;
    influence_max_change_pct: number;
  };
  publication_bias?: {
    egger?: { intercept: number; p_value: number; significant: boolean };
    begg?: { tau: number; p_value: number; significant: boolean };
  };
}

/** Forest plot data shape */
export interface ForestPlotData {
  studies: { study: string; effect: number; ci_lower: number; ci_upper: number; weight: number }[];
  pooled: { effect: number; ci_lower: number; ci_upper: number };
  xLabel: string;
}

/** Funnel plot data shape */
export interface FunnelPlotData {
  points: { effect: number; se: number; study: string }[];
  pseudoCI: { x: number; y: number }[];
}
