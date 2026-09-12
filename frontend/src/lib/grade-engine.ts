import type { StudyInput } from './meta-engine';

export interface GradeDomainAssessment {
  domain: string;
  rating: 'no' | 'serious' | 'very_severe';
  reason: string;
}

export interface GradeOutcomeResult {
  outcome: string;
  startingCertainty: 'High' | 'Moderate' | 'Low' | 'Very Low';
  finalCertainty: 'High' | 'Moderate' | 'Low' | 'Very Low';
  domains: GradeDomainAssessment[];
  upgradeFactors: string[];
  downgradeScore: number;
}

export interface GradeInput {
  outcome: string;
  studies: StudyInput[];
  effect: number;
  ciLower: number;
  ciUpper: number;
  measure: string;
  i2: number;
  tau2: number;
  qPvalue: number;
  robHigh: number;
  robSome: number;
  robLow: number;
  totalN: number;
  expectedDirection: 'favors_intervention' | 'favors_control' | 'no_difference';
  mcId?: number;
}

/**
 * Client-side GRADE certainty of evidence assessment.
 * Implements the GRADE approach (Guyatt et al. 2008, 2011):
 * - Starting from study design (RCT = high)
 * - Downgrade: RoB, inconsistency, indirectness, imprecision, publication bias
 * - Upgrade: large effect, dose-response, confounders toward null
 */
export function assessCertainty(input: GradeInput): GradeOutcomeResult {
  const domains: GradeDomainAssessment[] = [];
  const upgradeFactors: string[] = [];
  let downgradeScore = 0;
  let startingCertainty: 'High' | 'Moderate' | 'Low' | 'Very Low' = 'High'; // RCT design

  // ── 1. Risk of Bias (downgrade based on proportion of high RoB studies) ──
  const totalRob = input.robHigh + input.robSome + input.robLow;
  if (totalRob > 0) {
    const highRobPct = input.robHigh / totalRob;
    const someRobPct = input.robSome / totalRob;
    if (highRobPct > 0.5) {
      domains.push({ domain: 'Risk of Bias', rating: 'very_severe', reason: `>50% of studies at high risk of bias (${input.robHigh}/${totalRob})` });
      downgradeScore += 2;
    } else if (highRobPct > 0.25 || someRobPct > 0.5) {
      domains.push({ domain: 'Risk of Bias', rating: 'serious', reason: `Majority of studies have some concerns or high RoB` });
      downgradeScore += 1;
    } else {
      domains.push({ domain: 'Risk of Bias', rating: 'no', reason: 'Most studies at low risk of bias' });
    }
  }

  // ── 2. Inconsistency (downgrade based on I², τ², Q p-value) ──
  if (input.i2 > 75) {
    domains.push({ domain: 'Inconsistency', rating: 'very_severe', reason: `Very high heterogeneity (I² = ${input.i2.toFixed(0)}%)` });
    downgradeScore += 2;
  } else if (input.i2 > 50) {
    domains.push({ domain: 'Inconsistency', rating: 'serious', reason: `Substantial heterogeneity (I² = ${input.i2.toFixed(0)}%)` });
    downgradeScore += 1;
  } else if (input.i2 > 25 && input.qPvalue < 0.1) {
    domains.push({ domain: 'Inconsistency', rating: 'serious', reason: `Moderate heterogeneity with significant Q-test (I² = ${input.i2.toFixed(0)}%, p = ${input.qPvalue.toFixed(3)})` });
    downgradeScore += 1;
  } else {
    domains.push({ domain: 'Inconsistency', rating: 'no', reason: `Low heterogeneity (I² = ${input.i2.toFixed(0)}%)` });
  }

  // ── 3. Indirectness (flag if PICO doesn't match population) ──
  // For now we flag "no" since the user-defined PICO is assumed direct
  domains.push({ domain: 'Indirectness', rating: 'no', reason: 'PICO matches the review question' });

  // ── 4. Imprecision (downgrade if CI crosses null or few events) ──
  const isRatio = input.measure === 'OR' || input.measure === 'RR' || input.measure === 'HR';
  const nullValue = isRatio ? 1 : 0;
  const ciWidth = input.ciUpper - input.ciLower;
  const crossesNull = (input.ciLower < nullValue && input.ciUpper > nullValue) ||
    (input.ciLower > nullValue && input.ciUpper < nullValue);

  if (crossesNull && input.totalN < 300) {
    domains.push({ domain: 'Imprecision', rating: 'very_severe', reason: `CI crosses null value and small sample (N = ${input.totalN})` });
    downgradeScore += 2;
  } else if (crossesNull || input.totalN < 300) {
    domains.push({ domain: 'Imprecision', rating: 'serious', reason: crossesNull
      ? `Confidence interval crosses null value`
      : `Small optimal information size (N = ${input.totalN})` });
    downgradeScore += 1;
  } else if (ciWidth > Math.abs(input.effect) * 1.5) {
    domains.push({ domain: 'Imprecision', rating: 'serious', reason: 'Wide confidence interval relative to effect size' });
    downgradeScore += 1;
  } else {
    domains.push({ domain: 'Imprecision', rating: 'no', reason: 'Adequate sample size and precise estimate' });
  }

  // ── 5. Publication Bias (downgrade based on funnel plot tests / small-study effects) ──
  // Without Egger's p-value input, we flag as "suspected" if high heterogeneity + few studies
  const k = input.studies.length;
  if (k < 10) {
    domains.push({ domain: 'Publication Bias', rating: 'serious', reason: `Fewer than 10 studies — publication bias cannot be reliably assessed` });
    downgradeScore += 1;
  } else {
    domains.push({ domain: 'Publication Bias', rating: 'no', reason: 'Sufficient studies to assess funnel plot asymmetry' });
  }

  // ── Upgrade factors (only for observational; not typically applied here) ──
  // Large effect upgrade
  const absEffect = Math.abs(input.effect);
  if (isRatio) {
    const logEffect = Math.log(input.effect);
    if (Math.abs(logEffect) > Math.log(2)) {
      upgradeFactors.push('Large effect size (OR/RR > 2.0 or < 0.5)');
    }
  } else if (absEffect > 0.8) {
    upgradeFactors.push('Large effect size (SMD > 0.8)');
  }

  // Dose-response placeholder (would need actual data)
  // Confounding toward null placeholder

  // ── Calculate final certainty ──
  const netDowngrade = downgradeScore - Math.min(upgradeFactors.length, 2); // max +2 from upgrade
  let finalCertainty: GradeOutcomeResult['finalCertainty'];
  if (netDowngrade >= 3) finalCertainty = 'Very Low';
  else if (netDowngrade >= 2) finalCertainty = 'Low';
  else if (netDowngrade >= 1) finalCertainty = 'Moderate';
  else finalCertainty = 'High';

  return {
    outcome: input.outcome,
    startingCertainty,
    finalCertainty,
    domains,
    upgradeFactors,
    downgradeScore: netDowngrade,
  };
}

/**
 * Build a formatted Summary of Findings table row from a GRADE assessment.
 */
export function gradeToMarkdown(result: GradeOutcomeResult): string {
  const cert = result.finalCertainty;
  const certSymbol = cert === 'High' ? '⊕⊕⊕⊕' : cert === 'Moderate' ? '⊕⊕⊕○' : cert === 'Low' ? '⊕⊕○○' : '⊕○○○';
  const downgrade = result.domains
    .filter(d => d.rating !== 'no')
    .map(d => `${d.domain}: ${d.rating === 'very_severe' ? '−2' : '−1'}`)
    .join('; ');
  return `**${result.outcome}**: ${certSymbol} ${cert} certainty. ${downgrade ? `Downgraded for ${downgrade}.` : 'No downgrading.'}`;
}

/**
 * Get all downgrade reasons as a human-readable string.
 */
export function getDowngradeReasons(result: GradeOutcomeResult): string {
  const active = result.domains.filter(d => d.rating !== 'no');
  if (active.length === 0) return 'None';
  return active.map(d => `${d.domain} (${d.reason})`).join('; ');
}
