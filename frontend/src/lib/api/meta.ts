// Meta-analysis API calls (meta2, TSA, model averaging, prediction interval)
import { postJson } from "./client";

// ── Prediction Interval ──────────────────────────────────────────────

export interface PredictionRequest {
  pooledEffect: number;
  se: number;
  tau2: number;
  k: number;
  logScale: boolean;
}

export interface PredictionResult {
  piLower: number;
  piUpper: number;
  piT: number;
  piDf: number;
}

export async function computePredictionInterval(req: PredictionRequest): Promise<PredictionResult> {
  return await postJson<PredictionResult>("/api/prediction", req);
}

// ── Model Averaging ──────────────────────────────────────────────────

export interface ModelWeight {
  method: string;
  tau2: number;
  aicc: number;
  weight: number;
  pooledEffect: number;
}

export interface ModelAverageResult {
  pooledEffect: number;
  se: number;
  ciLower: number;
  ciUpper: number;
  modelWeights: ModelWeight[];
}

export async function runModelAveraging(req: { effects: number[]; variances: number[] }): Promise<ModelAverageResult> {
  return await postJson<ModelAverageResult>("/api/modelaverage", req);
}

// ── Trial Sequential Analysis ────────────────────────────────────────

export interface SequentialStudy {
  study: string;
  zScore?: number;
  informationFraction?: number;
}

export interface SequentialResult {
  zCurve: Array<{ study: number; zScore: number; boundary: number }>;
  requiredInformationSize: number;
  accruedFraction: number;
  crossedBoundary: boolean;
  boundaryType: string;
}

export async function runTrialSequentialAnalysis(req: {
  studies: SequentialStudy[];
  alpha?: number;
  beta?: number;
  expectedEffect: number;
}): Promise<SequentialResult> {
  return await postJson<SequentialResult>("/api/advanced/sequential", req);
}

// ── GRADE Summary of Findings (SoF) ──────────────────────────────────

export interface SofResponse {
  rows: any[];
  markdown: string;
}

export async function generateGradeSof(req: any): Promise<SofResponse> {
  return await postJson<SofResponse>("/api/grade/sof", req);
}

// ── Specialized Analyses ─────────────────────────────────────────────

export async function runDoseResponse(req: any): Promise<any> {
  return await postJson<any>("/api/dose", req);
}

export async function runSurvivalRmst(req: any): Promise<any> {
  return await postJson<any>("/api/survival", { type: "rmst", request: req });
}

export async function runEconomicMeta(studies: any[]): Promise<any> {
  return await postJson<any>("/api/specialized/economic", studies);
}

export async function runAdverseEventsMeta(studies: any[]): Promise<any> {
  return await postJson<any>("/api/specialized/adverse", studies);
}

export async function runDcaMeta(studies: any[]): Promise<any> {
  return await postJson<any>("/api/advanced/dca", studies);
}
