// Power tools: cumulative MA, meta-regression, failsafe N, L'Abbé, bubble plot
import { normalCDF, normalPPF } from "./core";

// ── Cumulative Meta-Analysis ─────────────────────────────────────────

/** Cumulative meta-analysis (studies added by precision, largest first). */
export function cumulativeMetaAnalysis(
  studies: { study: string; effect: number; se: number }[],
): { study: string; effect: number; ciLower: number; ciUpper: number; k: number }[] {
  const sorted = [...studies].sort((a, b) => a.se - b.se);
  const results: { study: string; effect: number; ciLower: number; ciUpper: number; k: number }[] = [];
  for (let i = 1; i <= sorted.length; i++) {
    const subset = sorted.slice(0, i);
    const weights = subset.map(s => 1 / (s.se * s.se));
    const sumW = weights.reduce((a, b) => a + b, 0);
    const eff = subset.reduce((s, x, j) => s + x.effect * weights[j], 0) / sumW;
    const se = Math.sqrt(1 / sumW);
    results.push({
      study: subset[subset.length - 1].study,
      effect: eff,
      ciLower: eff - 1.96 * se,
      ciUpper: eff + 1.96 * se,
      k: i,
    });
  }
  return results;
}

// ── Meta-Regression ──────────────────────────────────────────────────

/** Weighted least-squares meta-regression (one covariate). */
export function metaRegression(
  studies: { study: string; effect: number; se: number; covariate?: number }[],
): { intercept: number; slope: number; interceptSE: number; slopeSE: number; interceptP: number; slopeP: number; rSquared: number; qModel: number; qResidual: number; n: number } | null {
  const valid = studies.filter(s => s.covariate != null && s.se > 0);
  if (valid.length < 3) return null;
  const weights = valid.map(s => 1 / (s.se * s.se));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const meanX = valid.reduce((s, x, i) => s + x.covariate! * weights[i], 0) / sumW;
  const meanY = valid.reduce((s, x, i) => s + x.effect * weights[i], 0) / sumW;
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < valid.length; i++) {
    const dx = valid[i].covariate! - meanX;
    const dy = valid[i].effect - meanY;
    ssXY += weights[i] * dx * dy;
    ssXX += weights[i] * dx * dx;
    ssYY += weights[i] * dy * dy;
  }
  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;
  const slopeSE = Math.sqrt(1 / Math.max(ssXX, 1e-12));
  const interceptSE = Math.sqrt((1 / sumW + meanX * meanX / Math.max(ssXX, 1e-12)));
  const interceptP = 2 * (1 - normalCDF(Math.abs(intercept / interceptSE)));
  const slopeP = 2 * (1 - normalCDF(Math.abs(slope / slopeSE)));
  const rSquared = ssXX > 0 && ssYY > 0 ? (ssXY * ssXY) / (ssXX * ssYY) : 0;
  const qModel = ssXY * ssXY / Math.max(ssXX, 1e-12);
  const qResidual = ssYY - qModel;
  return { intercept, slope, interceptSE, slopeSE, interceptP, slopeP, rSquared, qModel, qResidual, n: valid.length };
}

// ── Failsafe N ───────────────────────────────────────────────────────

/** Rosenthal's Failsafe N: number of null studies needed to bring p above alpha (default 0.05). */
export function rosenthalFailsafe(studies: { effect: number; se: number }[], alpha = 0.05): { failsafeN: number; meanZ: number; targetZ: number } {
  if (studies.length === 0) return { failsafeN: 0, meanZ: 0, targetZ: 0 };
  const weights = studies.map(s => 1 / (s.se * s.se));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const weightedZ = studies.reduce((s, x, i) => s + (x.effect / x.se) * weights[i], 0) / sumW;
  const meanZ = weightedZ;
  const targetZ = normalPPF(1 - alpha / 2);
  const sumZ = studies.reduce((s, x) => s + x.effect / x.se, 0);
  const failsafeN = Math.max(0, Math.round((sumZ * sumZ) / (targetZ * targetZ) - studies.length));
  return { failsafeN, meanZ, targetZ };
}

/** Orwin's Failsafe N: number of null studies needed to reduce effect below a trivial threshold. */
export function orwinFailsafe(
  studies: { effect: number; se: number }[],
  trivialEffect = 0.1,
): { failsafeN: number; currentEffect: number; trivialEffect: number } {
  if (studies.length === 0) return { failsafeN: 0, currentEffect: 0, trivialEffect };
  const weights = studies.map(s => 1 / (s.se * s.se));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const currentEffect = studies.reduce((s, x, i) => s + x.effect * weights[i], 0) / sumW;
  const failsafeN = trivialEffect !== 0 ? Math.max(0, Math.round(studies.length * (currentEffect - trivialEffect) / trivialEffect)) : 0;
  return { failsafeN, currentEffect, trivialEffect };
}

// ── L'Abbé Plot ──────────────────────────────────────────────────────

/** L'Abbé plot data: returns event rates for intervention vs control arm. */
export function labbePlotData(studies: { study: string; int_events?: number; int_n?: number; ctrl_events?: number; ctrl_n?: number }[]): { study: string; intRate: number; ctrlRate: number }[] {
  return studies.filter(s => s.int_n && s.ctrl_n && s.int_n > 0 && s.ctrl_n > 0).map(s => ({
    study: s.study,
    intRate: s.int_events != null ? s.int_events / s.int_n! : 0,
    ctrlRate: s.ctrl_events != null ? s.ctrl_events / s.ctrl_n! : 0,
  }));
}

// ── Bubble Plot ───────────────────────────────────────────────────────

/** Bubble plot data for publication bias (effect vs SE with sample-size-weighted bubbles). */
export function bubblePlotData(studies: { study: string; effect: number; se: number; n_total?: number }[]): { study: string; effect: number; se: number; n: number }[] {
  return studies.map(s => ({
    study: s.study,
    effect: s.effect,
    se: s.se,
    n: s.n_total ?? 100,
  }));
}
