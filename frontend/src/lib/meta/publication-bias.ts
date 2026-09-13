// Publication bias tests: Egger, Begg, Harbord, Peters, trim-fill
import { normalCDF } from "./core";

// ── Trim & Fill ──────────────────────────────────────────────────────

/** Trim and Fill (Duval & Tweedie 2000) — imputes missing studies to correct funnel-plot asymmetry. */
export function trimAndFill(
  studies: { effect: number; se: number }[],
): { adjustedEffect: number; adjustedCiLower: number; adjustedCiUpper: number; imputedCount: number; imputedLabels: string[]; originalEffect: number } {
  if (studies.length < 3) {
    const sumW = studies.reduce((s, x) => s + 1 / (x.se * x.se), 0);
    const eff = studies.reduce((s, x) => s + x.effect / (x.se * x.se), 0) / Math.max(sumW, 1e-12);
    const se = Math.sqrt(1 / Math.max(sumW, 1e-12));
    return { adjustedEffect: eff, adjustedCiLower: eff - 1.96 * se, adjustedCiUpper: eff + 1.96 * se, imputedCount: 0, imputedLabels: [], originalEffect: eff };
  }

  const sorted = [...studies].sort((a, b) => a.effect - b.effect);
  const sumW = sorted.reduce((s, x) => s + 1 / (x.se * x.se), 0);
  const originalEffect = sorted.reduce((s, x) => s + x.effect / (x.se * x.se), 0) / sumW;

  let remaining = [...sorted];
  let imputed: string[] = [];
  for (let iter = 0; iter < 5; iter++) {
    const sw = remaining.reduce((s, x) => s + 1 / (x.se * x.se), 0);
    const mean = remaining.reduce((s, x) => s + x.effect / (x.se * x.se), 0) / sw;
    const rightmost = remaining.reduce((max, x) => (x.effect - mean > max.effect - mean ? x : max), remaining[0]);
    if (!rightmost || rightmost.effect <= mean) break;
    remaining = remaining.filter(x => x !== rightmost);
    imputed = [...imputed, `imputed_${iter + 1}`];
  }

  const sw2 = remaining.reduce((s, x) => s + 1 / (x.se * x.se), 0);
  const mean2 = remaining.reduce((s, x) => s + x.effect / (x.se * x.se), 0) / sw2;
  const adjustedEffect = mean2;
  const adjustedSE = Math.sqrt(1 / Math.max(sw2, 1e-12));

  return {
    adjustedEffect,
    adjustedCiLower: adjustedEffect - 1.96 * adjustedSE,
    adjustedCiUpper: adjustedEffect + 1.96 * adjustedSE,
    imputedCount: imputed.length,
    imputedLabels: imputed,
    originalEffect,
  };
}

// ── Begg's Test ──────────────────────────────────────────────────────

/** Begg's rank correlation test for publication bias (rank correlation between standardized effect and variance). */
export function beggsTest(studies: { effect: number; se: number }[]): { tau: number; pValue: number; significant: boolean } {
  if (studies.length < 3) return { tau: 0, pValue: 1, significant: false };
  const n = studies.length;
  const effects = studies.map(s => s.effect);
  const variances = studies.map(s => s.se * s.se);
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const prod = (effects[i] - effects[j]) * (variances[i] - variances[j]);
      if (prod > 0) concordant++;
      else if (prod < 0) discordant++;
    }
  }
  const totalPairs = (concordant + discordant) || 1;
  const tau = (concordant - discordant) / totalPairs;
  const seTau = Math.sqrt((2 * (2 * n + 5)) / (9 * n * (n - 1)));
  const z = seTau > 0 ? tau / seTau : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  return { tau, pValue, significant: pValue < 0.05 };
}

// ── Harbord's Test ───────────────────────────────────────────────────

/** Harbord's modified Egger test for binary data (uses score-based test). */
export function harbordTest(studies: { effect: number; se: number; n_total?: number }[]): { statistic: number; pValue: number; significant: boolean } {
  if (studies.length < 3) return { statistic: 0, pValue: 1, significant: false };
  const valid = studies.filter(s => s.se > 0);
  if (valid.length < 3) return { statistic: 0, pValue: 1, significant: false };
  const precision = valid.map(s => 1 / (s.se * s.se));
  const sumP = precision.reduce((a, b) => a + b, 0);
  const meanPrec = sumP / valid.length;
  const meanEff = valid.reduce((s, x) => s + x.effect, 0) / valid.length;
  let num = 0, den = 0;
  for (let i = 0; i < valid.length; i++) {
    num += (precision[i] - meanPrec) * (valid[i].effect - meanEff);
    den += (precision[i] - meanPrec) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = meanEff - slope * meanPrec;
  const resid = valid.map((x, i) => x.effect - (intercept + slope * precision[i]));
  const s2 = resid.reduce((s, r) => s + r * r, 0) / (valid.length - 2);
  const seInt = Math.sqrt(s2 * (1 / valid.length + meanPrec * meanPrec / den));
  const tStat = seInt > 0 ? intercept / seInt : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));
  return { statistic: tStat, pValue, significant: pValue < 0.05 };
}

// ── Peters' Test ─────────────────────────────────────────────────────

/** Peters' test for publication bias (modified Harbord for binary data using total N). */
export function petersTest(studies: { effect: number; se: number; n_total?: number }[]): { statistic: number; pValue: number; significant: boolean } {
  if (studies.length < 3) return { statistic: 0, pValue: 1, significant: false };
  const valid = studies.filter(s => s.se > 0 && s.n_total != null && s.n_total > 0);
  if (valid.length < 3) return { statistic: 0, pValue: 1, significant: false };
  const invN = valid.map(s => 1 / s.n_total!);
  const meanInvN = invN.reduce((a, b) => a + b, 0) / valid.length;
  const meanEff = valid.reduce((s, x) => s + x.effect, 0) / valid.length;
  let num = 0, den = 0;
  for (let i = 0; i < valid.length; i++) {
    num += (invN[i] - meanInvN) * (valid[i].effect - meanEff);
    den += (invN[i] - meanInvN) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = meanEff - slope * meanInvN;
  const resid = valid.map((x, i) => x.effect - (intercept + slope * invN[i]));
  const s2 = resid.reduce((s, r) => s + r * r, 0) / (valid.length - 2);
  const seInt = Math.sqrt(s2 * (1 / valid.length + meanInvN * meanInvN / Math.max(den, 1e-12)));
  const tStat = seInt > 0 ? intercept / seInt : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));
  return { statistic: tStat, pValue, significant: pValue < 0.05 };
}
