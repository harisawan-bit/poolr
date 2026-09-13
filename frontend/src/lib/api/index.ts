// Barrel re-exports for the API layer.
// Import from "../lib/api" for any API function.

export {
  ENGINE_URL,
  offlineMessage,
  engineHealth,
  postJson,
  getProject,
  saveProject,
  openProjectDialog,
  readTextFiles,
  exportProject,
} from "./client";

export type { DialogResult, PickedFile } from "./client";

export {
  computePredictionInterval,
  runModelAveraging,
  runTrialSequentialAnalysis,
  generateGradeSof,
  runDoseResponse,
  runSurvivalRmst,
  runEconomicMeta,
  runAdverseEventsMeta,
  runDcaMeta,
} from "./meta";

export type {
  PredictionRequest,
  PredictionResult,
  ModelWeight,
  ModelAverageResult,
  SequentialStudy,
  SequentialResult,
  SofResponse,
} from "./meta";

export {
  fetchRobFigure,
  fetchDiagnosticFigure,
} from "./figures";

export type { RobFigureRequest, DiagnosticPlotInput } from "./figures";

export {
  pubmedSearch,
  openalexSearch,
  crossrefSearch,
  clinicaltrialsSearch,
  scopusSearch,
  wosSearch,
  embaseSearch,
  cochraneSearch,
  prosperoSearch,
  googleScholarSearch,
  runPriorityScreening,
} from "./search";

export type { SearchResult, SearchResponse } from "./search";

export {
  exportReplicationCode,
  exportCitations,
} from "./export";
