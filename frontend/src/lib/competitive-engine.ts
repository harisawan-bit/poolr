// Bridge additions for the Competitive Engine (v0.6.0)
// Add to api.ts — uses existing postJson helper.

import { postJson } from "./api";

// ── 1. Influence Diagnostics ─────────────────────────────────────────

export interface InfluenceRequest {
  effects: number[];
  variances: number[];
  method: string; // "DL" | "REML" | "PM"
}

export interface InfluenceEntry {
  studyIndex: number;
  cookDistance: number;
  dffits: number;
  covratio: number;
  tau2Del: number;
  pooledEffectDel: number;
  i2Del: number;
  delQ: number;
  influential: boolean;
  flagReason: string | null;
}

export interface InfluenceResult {
  fullPooledEffect: number;
  fullSe: number;
  fullTau2: number;
  fullI2: number;
  fullQ: number;
  k: number;
  diagnostics: InfluenceEntry[];
  influentialStudies: number[];
  interpretation: string;
  method: string;
}

export function runInfluence(req: InfluenceRequest): Promise<InfluenceResult> {
  return postJson("/api/competitive/influence", req);
}

// ── 2. Bubble Meta-Regression ────────────────────────────────────────

export interface BubbleMetaRequest {
  effects: number[];
  variances: number[];
  moderators: number[];
  names?: string[];
  model: string;
  method: string;
}

export interface BubblePoint {
  studyIndex: number;
  x: number;
  y: number;
  radius: number;
  weight: number;
}

export interface BubbleMetaResult {
  slope: number;
  intercept: number;
  seSlope: number;
  seIntercept: number;
  zSlope: number;
  pSlope: number;
  rSquared: number;
  adjRSquared: number;
  k: number;
  points: BubblePoint[];
  tau2: number;
  qModel: number;
  qResidual: number;
  pModel: number;
  i2: number;
  interpretation: string;
  method: string;
}

export function runBubbleMeta(req: BubbleMetaRequest): Promise<BubbleMetaResult> {
  return postJson("/api/competitive/bubble", req);
}

// ── 3. Subgroup Interaction Test ─────────────────────────────────────

export interface InteractionRequest {
  effects: number[];
  variances: number[];
  moderators: number[];
  subgroups: string[];
  model: string;
  method: string;
}

export interface SubgroupMetaRegression {
  subgroup: string;
  k: number;
  slope: number;
  seSlope: number;
  pSlope: number;
  intercept: number;
  pooledEffect: number;
  ciLower: number;
  ciUpper: number;
  i2: number;
  tau2: number;
}

export interface InteractionResult {
  qInteraction: number;
  pInteraction: number;
  dfInteraction: number;
  fStatistic: number;
  pF: number;
  subgroupRegressions: SubgroupMetaRegression[];
  significant: boolean;
  interpretation: string;
  method: string;
}

export function runSubgroupInteraction(
  req: InteractionRequest
): Promise<InteractionResult> {
  return postJson("/api/competitive/interaction", req);
}

// ── 4. Multivariate Meta-Regression ─────────────────────────────────

export interface MultivariateRequest {
  effects: number[];
  variances: number[];
  moderators: number[][]; // [study][moderator]
  moderatorNames?: string[];
  model: string;
  method: string;
}

export interface CoefficientResult {
  name: string;
  estimate: number;
  se: number;
  z: number;
  p: number;
  ciLower: number;
  ciUpper: number;
}

export interface MultivariateResult {
  k: number;
  p: number;
  tau2: number;
  i2: number;
  rSquared: number;
  adjRSquared: number;
  fStatistic: number;
  pF: number;
  dfModel: number;
  dfResidual: number;
  coefficients: CoefficientResult[];
  qModel: number;
  qResidual: number;
  qTotal: number;
  pResidual: number;
  interpretation: string;
  method: string;
}

export function runMultivariateRegression(
  req: MultivariateRequest
): Promise<MultivariateResult> {
  return postJson("/api/competitive/multivariate", req);
}

// ── 5. Cluster-Robust Variance Estimation ───────────────────────────

export interface CrveRequest {
  effects: number[];
  variances: number[];
  clusters: string[];
  moderators: number[][]; // [study][mod]
  correction: string; // "CR0" | "CR2" | "CR4"
}

export interface CrveCoefficient {
  name: string;
  estimate: number;
  seNaive: number;
  seRobust: number;
  tNaive: number;
  tRobust: number;
  pRobust: number;
  ciLower: number;
  ciUpper: number;
  df: number;
}

export interface CrveResult {
  k: number;
  nClusters: number;
  correction: string;
  coefficients: CrveCoefficient[];
  fRobust: number;
  pFRobust: number;
  df1: number;
  df2: number;
  interpretation: string;
  method: string;
}

export function runClusterRobust(req: CrveRequest): Promise<CrveResult> {
  return postJson("/api/competitive/crve", req);
}

// ── 6. Bayesian Meta-Analysis ────────────────────────────────────────

export interface BayesianRequest {
  effects: number[];
  variances: number[];
  priorMuMean?: number;
  priorMuSd?: number;
  priorTauScale?: number;
  priorTauType?: string; // "half-cauchy" | "half-normal" | "uniform"
  nGrid?: number;
  fixedTau2?: number;
}

export interface BayesianSummary {
  posteriorMean: number;
  posteriorMedian: number;
  posteriorSd: number;
  ciLower95: number;
  ciUpper95: number;
  ciLower80: number;
  ciUpper80: number;
  probGreaterThanZero: number;
  probGreaterThanPrior: number;
  mapTau: number;
}

export interface BayesianResult {
  mu: BayesianSummary;
  tau: BayesianSummary;
  priorMuMean: number;
  priorMuSd: number;
  priorTauScale: number;
  mapMu: number;
  bayesFactorH1: number;
  bayesFactorH0: number;
  dlml: number;
  tauGrid: number[];
  tauPosterior: number[];
  muConditionalMean: number[];
  tau2Mle: number;
  frequentistMu: number;
  frequentistSe: number;
  frequentistP: number;
  interpretation: string;
  method: string;
}

export function runBayesianMeta(req: BayesianRequest): Promise<BayesianResult> {
  return postJson("/api/competitive/bayesian", req);
}
