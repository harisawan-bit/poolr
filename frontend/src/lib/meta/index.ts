// Barrel re-exports for the meta-analysis engine.
// Import from "../lib/meta" for any meta-analysis function.

// Types
export type {
  StudyInput,
  MetaSettings,
  StudyResult,
  PooledResult,
  HeterogeneityResult,
  MetaAnalysisResult,
  ForestPlotData,
  FunnelPlotData,
} from "./types";

// Core
export {
  normalCDF,
  normalPPF,
  calcEffectSize,
  derSimonianLaird,
  i2Interpretation,
  validateStudyData,
  cohensKappa,
  effectSizeConverter,
  generateForestPlotData,
  generateFunnelPlotData,
  runMetaAnalysis,
} from "./core";

// Publication Bias
export {
  trimAndFill,
  beggsTest,
  harbordTest,
  petersTest,
} from "./publication-bias";

// Power Tools
export {
  cumulativeMetaAnalysis,
  metaRegression,
  rosenthalFailsafe,
  orwinFailsafe,
  labbePlotData,
  bubblePlotData,
} from "./power-tools";
