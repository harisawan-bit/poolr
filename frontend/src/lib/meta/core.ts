// Core meta-analysis functions: effect size, DL estimator, main run function
import type {
  StudyInput,
  MetaSettings,
  StudyResult,
  HeterogeneityResult,
  MetaAnalysisResult,
  ForestPlotData,
  FunnelPlotData,
} from "./types";
import type { ScreenDecision } from "../project";

// ── Statistical helpers ───────────────────────────────────────────────

/** Cumulative distribution function of the standard normal. */
export function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/** Inverse normal CDF (quantile function). */
export function normalPPF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00
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

/** Log-gamma function. */
function gammaLn(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

/** Regularized lower incomplete gamma function. */
function regularizedGammaP(a: number, x: number, g: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;
  let sum = 1 / a;
  let term = 1 / a;
  for (let n = 1; n < 100; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-10) break;
  }
  return Math.exp(-x + a * Math.log(x) - g) * sum;
}

/** Chi-square CDF. */
function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  const g = gammaLn(df / 2);
  return regularizedGammaP(df / 2, x / 2, g);
}

// ── Effect Size Calculation ──────────────────────────────────────────

export function calcEffectSize(s: StudyInput, measure: string): { effect: number; se: number } {
  if (measure === 'OR') {
    const a = (s.int_events || 0) + 0.5;
    const b = (s.int_n || 0) - (s.int_events || 0) + 0.5;
    const c = (s.ctrl_events || 0) + 0.5;
    const d = (s.ctrl_n || 0) - (s.ctrl_events || 0) + 0.5;
    return { effect: Math.log((a * d) / (b * c)), se: Math.sqrt(1/a + 1/b + 1/c + 1/d) };
  } else if (measure === 'RR') {
    const a = (s.int_events || 0) + 0.5;
    const b = (s.int_n || 0) + 0.5;
    const c = (s.ctrl_events || 0) + 0.5;
    const d = (s.ctrl_n || 0) + 0.5;
    return { effect: Math.log((a / b) / (c / d)), se: Math.sqrt(1/a - 1/b + 1/c - 1/d) };
  } else if (measure === 'RD') {
    const a = s.int_events || 0;
    const b = s.int_n || 0;
    const c = s.ctrl_events || 0;
    const d = s.ctrl_n || 0;
    return {
      effect: (a / b) - (c / d),
      se: Math.sqrt((a * (b - a)) / (b * b * b) + (c * (d - c)) / (d * d * d)),
    };
  } else if (measure === 'MD') {
    const n1 = s.int_n || 0;
    const n2 = s.ctrl_n || 0;
    const m1 = s.int_mean || 0;
    const m2 = s.ctrl_mean || 0;
    const sd1 = s.int_sd || 0;
    const sd2 = s.ctrl_sd || 0;
    const pooledSD = Math.sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / (n1 + n2 - 2));
    return { effect: m1 - m2, se: pooledSD * Math.sqrt(1/n1 + 1/n2) };
  } else if (measure === 'SMD') {
    const n1 = s.int_n || 0;
    const n2 = s.ctrl_n || 0;
    const m1 = s.int_mean || 0;
    const m2 = s.ctrl_mean || 0;
    const sd1 = s.int_sd || 0;
    const sd2 = s.ctrl_sd || 0;
    const pooledSD = Math.sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / (n1 + n2 - 2));
    const effect = (m1 - m2) / pooledSD;
    const correction = 1 - (3 / (4 * (n1 + n2) - 9));
    const correctedEffect = effect * correction;
    return {
      effect: correctedEffect,
      se: Math.sqrt((n1 + n2) / (n1 * n2) + (correctedEffect * correctedEffect) / (2 * (n1 + n2))),
    };
  }
  return { effect: s.effect_size || 0, se: s.se || 1 };
}

// ── DerSimonian-Laird Heterogeneity ──────────────────────────────────

export function derSimonianLaird(studies: { effect: number; se: number }[]): HeterogeneityResult {
  const k = studies.length;
  if (k < 2) return { q: 0, df: 0, q_p: 1, i2: 0, i2_lower: 0, i2_upper: 0, tau2: 0, tau: 0, h2: 1 };

  const weights = studies.map(s => 1 / (s.se * s.se));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const fixedEffect = studies.reduce((sum, s, i) => sum + s.effect * weights[i], 0) / sumW;

  let q = 0;
  for (let i = 0; i < k; i++) q += weights[i] * (studies[i].effect - fixedEffect) ** 2;

  const df = k - 1;
  const q_p = 1 - chiSquareCDF(q, df);
  const i2 = Math.max(0, ((q - df) / q) * 100);
  const i2SE = Math.sqrt(4 * q * q * (df - 1) / (df * df * df));
  const i2_lower = Math.max(0, i2 - 1.96 * i2SE);
  const i2_upper = Math.min(100, i2 + 1.96 * i2SE);

  const c = sumW - weights.reduce((sum, w) => sum + w * w, 0) / sumW;
  const tau2 = Math.max(0, (q - df) / c);
  const tau = Math.sqrt(tau2);
  const h2 = q / df;

  return { q, df, q_p, i2, i2_lower, i2_upper, tau2, tau, h2 };
}

// ── I² Interpretation ────────────────────────────────────────────────

/** I² interpretation categories (Higgins et al. 2003). */
export function i2Interpretation(i2: number): { label: string; color: string } {
  if (i2 < 25) return { label: 'Low', color: 'var(--color-include)' };
  if (i2 < 50) return { label: 'Moderate', color: 'var(--color-unsure)' };
  if (i2 < 75) return { label: 'High', color: 'var(--color-unsure)' };
  return { label: 'Very High', color: 'var(--color-exclude)' };
}

// ── Data Validation ──────────────────────────────────────────────────

/** Flag suspicious study entries. */
export function validateStudyData(study: StudyInput): string[] {
  const issues: string[] = [];
  if (study.int_events != null && study.int_n != null && study.int_events > study.int_n)
    issues.push('Intervention events exceed total N');
  if (study.ctrl_events != null && study.ctrl_n != null && study.ctrl_events > study.ctrl_n)
    issues.push('Control events exceed total N');
  if (study.int_events != null && study.int_events < 0) issues.push('Negative intervention events');
  if (study.ctrl_events != null && study.ctrl_events < 0) issues.push('Negative control events');
  if (study.int_n != null && study.int_n <= 0) issues.push('Intervention N ≤ 0');
  if (study.ctrl_n != null && study.ctrl_n <= 0) issues.push('Control N ≤ 0');
  if (study.int_sd != null && study.int_sd < 0) issues.push('Negative intervention SD');
  if (study.ctrl_sd != null && study.ctrl_sd < 0) issues.push('Negative control SD');
  if (study.se != null && study.se <= 0) issues.push('Standard error ≤ 0 (cannot weight)');
  if (study.hr != null && study.hr <= 0) issues.push('Hazard ratio ≤ 0');
  if (study.effect_se != null && study.effect_se <= 0) issues.push('Effect SE ≤ 0');
  return issues;
}

// ── Cohen's Kappa (inter-rater reliability) ──────────────────────────

/** Cohen's Kappa for inter-rater reliability (dual screening). */
export function cohensKappa(
  reviewerA: ScreenDecision[],
  reviewerB: ScreenDecision[],
): { kappa: number; agreement: number; se: number; z: number; pValue: number; interpretation: string } {
  if (reviewerA.length === 0 || reviewerA.length !== reviewerB.length)
    return { kappa: 0, agreement: 0, se: 0, z: 0, pValue: 1, interpretation: 'N/A' };

  const categories: ScreenDecision[] = ['include', 'exclude', 'unsure'];
  const n = reviewerA.length;
  let observed = 0;
  for (let i = 0; i < n; i++) if (reviewerA[i] === reviewerB[i]) observed++;
  const pObserved = observed / n;

  const countA: Record<string, number> = {};
  const countB: Record<string, number> = {};
  for (const c of categories) { countA[c] = 0; countB[c] = 0; }
  for (const d of reviewerA) countA[d] = (countA[d] || 0) + 1;
  for (const d of reviewerB) countB[d] = (countB[d] || 0) + 1;

  let pExpected = 0;
  for (const c of categories) pExpected += (countA[c] / n) * (countB[c] / n);

  const kappa = pExpected < 1 ? (pObserved - pExpected) / (1 - pExpected) : 0;
  const se = Math.sqrt((pObserved * (1 - pObserved)) / (n * (1 - pExpected) ** 2));
  const z = se > 0 ? kappa / se : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  let interpretation = 'Poor';
  if (kappa >= 0.81) interpretation = 'Almost perfect';
  else if (kappa >= 0.61) interpretation = 'Substantial';
  else if (kappa >= 0.41) interpretation = 'Moderate';
  else if (kappa >= 0.21) interpretation = 'Fair';
  else if (kappa >= 0.01) interpretation = 'Slight';

  return { kappa, agreement: pObserved, se, z, pValue, interpretation };
}

// ── Effect Size Converter ────────────────────────────────────────────

const _ = null;
export function effectSizeConverter(
  value: number,
  from: 'OR' | 'RR' | 'RD' | 'SMD' | 'cohens_d' | 'hedges_g' | 'fisher_z' | 'r' | 'logOR',
  to: 'OR' | 'RR' | 'RD' | 'SMD' | 'cohens_d' | 'hedges_g' | 'fisher_z' | 'r' | 'logOR',
): number | null {
  if (from === to) return value;
  let logOR: number;
  switch (from) {
    case 'logOR': logOR = value; break;
    case 'OR': logOR = Math.log(Math.max(1e-10, value)); break;
    case 'RR': logOR = Math.log(Math.max(1e-10, value)); break;
    case 'fisher_z': logOR = value * 2; break;
    case 'r': logOR = value * 2; break;
    case 'SMD': case 'cohens_d': case 'hedges_g': logOR = value * (Math.PI / Math.sqrt(3)); break;
    case 'RD': logOR = Math.log(1 + value); break;
    default: return _;
  }
  switch (to) {
    case 'logOR': return logOR;
    case 'OR': return Math.exp(logOR);
    case 'RR': return Math.exp(logOR);
    case 'fisher_z': return logOR / 2;
    case 'r': return Math.tanh(logOR / 2);
    case 'SMD': case 'cohens_d': case 'hedges_g': return logOR * (Math.sqrt(3) / Math.PI);
    case 'RD': return Math.exp(logOR) - 1;
    default: return _;
  }
}

// ── Forest & Funnel Plot Data ────────────────────────────────────────

/** Generate forest plot data from analysis results. */
export function generateForestPlotData(result: MetaAnalysisResult): ForestPlotData {
  return {
    studies: result.studies.map(s => ({
      study: s.study, effect: s.effect, ci_lower: s.ci_lower,
      ci_upper: s.ci_upper, weight: s.weight,
    })),
    pooled: { effect: result.pooled.effect, ci_lower: result.pooled.ci_lower, ci_upper: result.pooled.ci_upper },
    xLabel: 'Effect Size',
  };
}

/** Generate funnel plot data from analysis results. */
export function generateFunnelPlotData(result: MetaAnalysisResult): FunnelPlotData {
  const points = result.studies.map(s => ({
    effect: s.effect,
    se: s.se ?? (Math.abs(s.ci_upper - s.ci_lower) / (2 * 1.959964)),
    study: s.study,
  }));
  const maxSE = Math.max(...points.map(p => p.se));
  const pseudoCI: { x: number; y: number }[] = [];
  for (let se = 0; se <= maxSE; se += maxSE / 50) {
    pseudoCI.push({ x: result.pooled.effect, y: se });
  }
  return { points, pseudoCI };
}

// ── Main Meta-Analysis Function ──────────────────────────────────────

/** Run a complete meta-analysis (pooled effect, heterogeneity, subgroups, sensitivity, bias). */
export function runMetaAnalysis(settings: MetaSettings, inputStudies: StudyInput[]): MetaAnalysisResult {
  const { measure, model } = settings;

  const studies = inputStudies.map(s => {
    const { effect, se } = calcEffectSize(s, measure);
    return { study: s.study, effect, se, subgroup: s.subgroup || '' };
  }).filter(s => Number.isFinite(s.effect) && Number.isFinite(s.se) && s.se > 0);

  if (studies.length === 0) {
    return {
      pooled: { effect: 0, ci_lower: 0, ci_upper: 0, se: 0, z: 0, p: 1 },
      heterogeneity: { q: 0, df: 0, q_p: 1, i2: 0, i2_lower: 0, i2_upper: 0, tau2: 0, tau: 0, h2: 1 },
      studies: [],
    };
  }

  const het = derSimonianLaird(studies);
  const weights = studies.map(s => 1 / (s.se * s.se + (model === 'random' ? het.tau2 : 0)));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const pooledEffect = studies.reduce((sum, s, i) => sum + s.effect * weights[i], 0) / sumW;
  const pooledSE = Math.sqrt(1 / sumW);
  const z = pooledEffect / pooledSE;
  const p = 2 * (1 - normalCDF(Math.abs(z)));
  const zCrit = normalPPF(0.975);
  const isRatio = measure === 'OR' || measure === 'RR';
  const displayPooled = isRatio ? Math.exp(pooledEffect) : pooledEffect;
  const displayCiLower = isRatio ? Math.exp(pooledEffect - zCrit * pooledSE) : pooledEffect - zCrit * pooledSE;
  const displayCiUpper = isRatio ? Math.exp(pooledEffect + zCrit * pooledSE) : pooledEffect + zCrit * pooledSE;

  const studyResults: StudyResult[] = studies.map((s, i) => ({
    study: s.study,
    effect: isRatio ? Math.exp(s.effect) : s.effect,
    ci_lower: isRatio ? Math.exp(s.effect - zCrit * s.se) : s.effect - zCrit * s.se,
    ci_upper: isRatio ? Math.exp(s.effect + zCrit * s.se) : s.effect + zCrit * s.se,
    weight: (weights[i] / sumW) * 100,
    subgroup: s.subgroup,
    se: s.se,
  }));

  // Subgroup analysis
  let subgroups: MetaAnalysisResult['subgroups'] | undefined;
  const subgroupsMap = new Map<string, { effect: number; se: number }[]>();
  studies.forEach(s => {
    const sg = s.subgroup || 'Overall';
    if (!subgroupsMap.has(sg)) subgroupsMap.set(sg, []);
    subgroupsMap.get(sg)!.push({ effect: s.effect, se: s.se });
  });

  if (subgroupsMap.size > 1) {
    const groups: { name: string; effect: number; ci_lower: number; ci_upper: number; k: number; i2_within?: number; se: number }[] = [];
    subgroupsMap.forEach((sgStudies, name) => {
      const sgWeights = sgStudies.map(s => 1 / (s.se * s.se + het.tau2));
      const sgSumW = sgWeights.reduce((a, b) => a + b, 0);
      const sgEffect = sgStudies.reduce((sum, s, i) => sum + s.effect * sgWeights[i], 0) / sgSumW;
      const sgSE = Math.sqrt(1 / sgSumW);
      const sgHet = derSimonianLaird(sgStudies);
      groups.push({
        name,
        effect: isRatio ? Math.exp(sgEffect) : sgEffect,
        ci_lower: isRatio ? Math.exp(sgEffect - zCrit * sgSE) : sgEffect - zCrit * sgSE,
        ci_upper: isRatio ? Math.exp(sgEffect + zCrit * sgSE) : sgEffect + zCrit * sgSE,
        k: sgStudies.length,
        i2_within: sgHet.i2,
        se: sgSE,
      });
    });

    let qBetween = 0;
    groups.forEach(g => {
      const gEffect = isRatio ? Math.log(g.effect) : g.effect;
      const gWeight = g.se > 0 ? 1 / (g.se * g.se) : 1;
      qBetween += gWeight * ((gEffect - pooledEffect) ** 2);
    });
    const dfBetween = groups.length - 1;
    const pBetween = 1 - chiSquareCDF(qBetween, dfBetween);
    subgroups = { groups, between: { q: qBetween, df: dfBetween, p: pBetween } };
  }

  // Sensitivity (leave-one-out)
  const loo: { excluded: string; effect: number; ci_lower: number; ci_upper: number; i2: number }[] = [];
  let maxChange = 0;
  let mostInfluential = '';
  for (let i = 0; i < studies.length; i++) {
    const remaining = studies.filter((_, j) => j !== i);
    const remainingWeights = remaining.map(s => 1 / (s.se * s.se + het.tau2));
    const remainingSumW = remainingWeights.reduce((a, b) => a + b, 0);
    const remainingEffect = remaining.reduce((sum, s, j) => sum + s.effect * remainingWeights[j], 0) / remainingSumW;
    const remainingSE = Math.sqrt(1 / remainingSumW);
    const remainingHet = derSimonianLaird(remaining);
    loo.push({
      excluded: studies[i].study, effect: remainingEffect,
      ci_lower: remainingEffect - zCrit * remainingSE,
      ci_upper: remainingEffect + zCrit * remainingSE,
      i2: remainingHet.i2,
    });
    const change = Math.abs((remainingEffect - pooledEffect) / pooledEffect) * 100;
    if (change > maxChange) { maxChange = change; mostInfluential = studies[i].study; }
  }

  // Publication bias (Egger's test)
  let egger: { intercept: number; p_value: number; significant: boolean } | undefined;
  if (studies.length >= 3) {
    const precision = studies.map(s => 1 / s.se);
    const stdEffect = studies.map(s => s.effect / s.se);
    const meanPrec = precision.reduce((a, b) => a + b, 0) / precision.length;
    const meanStd = stdEffect.reduce((a, b) => a + b, 0) / stdEffect.length;
    let num = 0, den = 0;
    for (let i = 0; i < studies.length; i++) {
      num += (precision[i] - meanPrec) * (stdEffect[i] - meanStd);
      den += (precision[i] - meanPrec) ** 2;
    }
    const slope = den > 0 ? num / den : 0;
    const intercept = meanStd - slope * meanPrec;
    const resid = studies.map((_, i) => stdEffect[i] - (intercept + slope * precision[i]));
    const s2 = resid.reduce((sum, r) => sum + r * r, 0) / (studies.length - 2);
    const seIntercept = Math.sqrt(s2 * (1 / studies.length + meanPrec * meanPrec / den));
    const tStat = seIntercept > 0 ? intercept / seIntercept : 0;
    const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));
    egger = { intercept, p_value: pValue, significant: pValue < 0.05 };
  }

  return {
    pooled: { effect: displayPooled, ci_lower: displayCiLower, ci_upper: displayCiUpper, se: pooledSE, z, p, ci_method: model === 'random' ? 'DerSimonian-Laird' : 'Inverse variance' },
    heterogeneity: het,
    studies: studyResults,
    subgroups,
    sensitivity: { leave_one_out: loo, most_influential: mostInfluential || undefined, influence_max_change_pct: maxChange },
    publication_bias: { egger },
  };
}
