// Power & Sample Size Calculator for Meta-Analysis
// Computes minimum detectable number of studies, power given k, or required sample size
// Based on Jackson & Bowden (2009) and Borenstein et al. (2009)

export interface PowerInput {
  nStudies: number;       // expected number of studies
  avgSampleSize: number;  // average per-study sample size (per arm)
  effectSize: number;     // expected SMD or logOR
  heterogeneityI2: number; // expected I² (0-100)
  alpha: number;          // significance level
  power: number;          // target power
  twoTailed: boolean;
}

export interface PowerResult {
  achievedPower: number;      // proportion
  minDetectableEffect: number;
  requiredStudies: number;    // for target power
  totalSampleSize: number;    // across all studies
  standardError: number;
  criticalZ: number;
  note: string;
}

export function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

export function normalPPF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00,
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    const r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

/**
 * Compute achieved power for a random-effects meta-analysis.
 * Uses the standard error of the pooled effect with random-effects variance.
 */
export function computePower(input: PowerInput): PowerResult {
  const { nStudies, avgSampleSize, effectSize, heterogeneityI2, alpha, twoTailed } = input;

  // Within-study variance for SMD (Hedges' g)
  const withinStudyVar = (2 * avgSampleSize) / (avgSampleSize * avgSampleSize) + (effectSize * effectSize) / (4 * avgSampleSize);

  // Between-study variance (tau²) from I²
  // I² = tau² / (tau² + typicalVar) → tau² = I² * typicalVar / (1 - I²)
  const i2Proportion = heterogeneityI2 / 100;
  const tau2 = i2Proportion < 1
    ? (i2Proportion * withinStudyVar) / (1 - i2Proportion)
    : withinStudyVar * 9; // I²=100% → very large tau²

  // Random-effects variance of pooled estimate
  // Var = 1 / Σ(1/(se_i² + tau²))
  const perStudyWeight = 1 / (withinStudyVar + tau2);
  const pooledVar = 1 / (nStudies * perStudyWeight);
  const pooledSE = Math.sqrt(pooledVar);

  const criticalZ = twoTailed ? normalPPF(1 - alpha / 2) : normalPPF(1 - alpha);

  // Non-centrality parameter
  const ncp = Math.abs(effectSize) / pooledSE;

  // Power = P(Z > z_crit - ncp) + P(Z < -z_crit - ncp) for two-tailed
  const achievedPower = twoTailed
    ? 1 - normalCDF(criticalZ - ncp) + normalCDF(-criticalZ - ncp)
    : 1 - normalCDF(criticalZ - ncp);

  // Minimum detectable effect size (MDES) at target power
  const targetZ = normalPPF(input.power);
  const mdes = (criticalZ + targetZ) * pooledSE;

  // Required number of studies for target power
  // n = (z_crit + z_power)² * (withinVar + tau²) / effectSize²
  const requiredStudies = effectSize !== 0
    ? Math.ceil(Math.pow(criticalZ + targetZ, 2) * (withinStudyVar + tau2) / (effectSize * effectSize))
    : Infinity;

  const note = nStudies < 3
    ? 'Very few studies — power calculation is unreliable with k < 3'
    : heterogeneityI2 > 75
    ? 'High heterogeneity substantially reduces power; consider subgroup analysis'
    : '';

  return {
    achievedPower: Math.min(0.999, Math.max(0.001, achievedPower)),
    minDetectableEffect: mdes,
    requiredStudies: Number.isFinite(requiredStudies) ? requiredStudies : nStudies,
    totalSampleSize: nStudies * avgSampleSize * 2,
    standardError: pooledSE,
    criticalZ,
    note,
  };
}

/**
 * Compute prediction interval for a random-effects meta-analysis.
 * The prediction interval shows the range where the true effect of a new study would fall.
 */
export function predictionInterval(
  pooledEffect: number,
  tau2: number,
  sePooled: number,
  df: number,
): { lower: number; upper: number; tCrit: number } {
  // Using t-distribution approximation with df = k - 2
  const tCrit = df > 0 ? normalPPF(0.975) : 1.96; // using normal approx for simplicity
  const predVar = sePooled * sePooled + tau2;
  const predSE = Math.sqrt(predVar);
  return {
    lower: pooledEffect - tCrit * predSE,
    upper: pooledEffect + tCrit * predSE,
    tCrit,
  };
}
