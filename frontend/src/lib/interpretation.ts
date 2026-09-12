import type { Project } from './project';
import { effectSizeConverter } from './meta-engine';

/**
 * Generate plain-language interpretation of meta-analysis results.
 * Fully client-side — no AI backend dependency.
 */
export function generatePlainTextInterpretation(project: Project): { section: string; text: string }[] {
  const results = project.meta.results as any;
  const sections: { section: string; text: string }[] = [];

  if (!results) return [];

  const m = results;
  const effect = m.pooled?.effect;
  const ciLower = m.pooled?.ci_lower;
  const ciUpper = m.pooled?.ci_upper;
  const pValue = m.pooled?.p;
  const i2 = m.heterogeneity?.i2 ?? 0;
  const tau2 = m.heterogeneity?.tau2 ?? 0;
  const qP = m.heterogeneity?.q_p ?? 1;
  const measure = m.measure || 'OR';
  const k = m.studies?.length ?? 0;
  const studies = project.extraction.studies;
  const totalN = studies.reduce((s, st) => s + (st.int_n ?? 0) + (st.ctrl_n ?? 0), 0);
  const intervention = project.pico.intervention || 'the intervention';
  const comparator = project.pico.comparator || 'control';
  const population = project.pico.population || 'the target population';

  const isRatio = measure === 'OR' || measure === 'RR' || measure === 'HR';
  const ciStr = isRatio ? `[${fmt(ciLower, 2)}–${fmt(ciUpper, 2)}]` : `[${fmt(ciLower, 3)}, ${fmt(ciUpper, 3)}]`;

  // ── Pooled Effect Interpretation ──
  let pooledText = '';
  if (isRatio) {
    const direction = effect > 1 ? 'higher' : 'lower';
    const foldChange = effect > 1 ? (effect - 1) * 100 : (1 - effect) * 100;
    pooledText = `The pooled ${measure} was ${fmt(effect, 2)} (95% CI: ${ciStr}, p = ${fmt(pValue, 4)}). `;
    if (pValue < 0.05) {
      pooledText += `This represents a statistically significant ${foldChange.toFixed(0)}% ${direction} effect of ${intervention} compared to ${comparator} in ${population}.`;
    } else {
      pooledText += `The effect was not statistically significant (p = ${fmt(pValue, 3)}). The 95% confidence interval ${ciLower < 1 && ciUpper > 1 ? 'crosses' : 'does not cross'} the null value of 1.`;
    }
  } else {
    pooledText = `The pooled ${measure} was ${fmt(effect, 3)} (95% CI: ${ciStr}, p = ${fmt(pValue, 4)}). `;
    if (pValue < 0.05) {
      pooledText += `This represents a statistically significant difference of ${Math.abs(effect).toFixed(3)} standard units favoring ${effect > 0 ? intervention : comparator} in ${population}.`;
    } else {
      pooledText += `The difference was not statistically significant (p = ${fmt(pValue, 3)}).`;
    }
  }
  sections.push({ section: 'Pooled Effect', text: pooledText });

  // ── Heterogeneity Interpretation ──
  let hetText = `Heterogeneity was assessed using I² (${fmt(i2, 0)}%) and τ² (${fmt(tau2, 4)}). `;
  if (i2 < 25) {
    hetText += 'The low I² indicates minimal between-study variability, suggesting consistent findings across studies.';
  } else if (i2 < 50) {
    hetText += 'Moderate heterogeneity was observed, which may reflect differences in study populations, interventions, or outcomes.';
  } else if (i2 < 75) {
    hetText += 'Substantial heterogeneity was detected, indicating notable variability between study results. Subgroup analyses or meta-regression may explain this variation.';
  } else {
    hetText += 'Considerable heterogeneity was detected (I² > 75%). The pooled estimate should be interpreted with caution as study results vary substantially.';
  }
  if (qP < 0.05) {
    hetText += ` The Q-test was significant (p = ${fmt(qP, 3)}), confirming the presence of heterogeneity beyond chance.`;
  } else {
    hetText += ` The Q-test was not significant (p = ${fmt(qP, 3)}), suggesting observed variability may be due to chance alone.`;
  }
  sections.push({ section: 'Heterogeneity', text: hetText });

  // ── Clinical/Practical Significance ──
  let clinText = '';
  if (isRatio) {
    // Convert to NNT-like metric or standardized effect
    const smd = effectSizeConverter(effect, measure, 'SMD');
    if (smd != null) {
      clinText = `In standardized terms, the effect size corresponds to Cohen's d ≈ ${fmt(smd, 2)}. `;
      if (Math.abs(smd) < 0.2) clinText += 'This represents a small effect that may not be clinically meaningful.';
      else if (Math.abs(smd) < 0.5) clinText += 'This represents a small-to-moderate effect of potential clinical relevance.';
      else if (Math.abs(smd) < 0.8) clinText += 'This represents a moderate effect likely to be clinically meaningful.';
      else clinText += 'This represents a large effect that is likely clinically significant.';
    }
  } else if (measure === 'MD' || measure === 'SMD') {
    if (Math.abs(effect) < 0.2) clinText = 'The effect size is small (d < 0.2), which may not be clinically meaningful.';
    else if (Math.abs(effect) < 0.5) clinText = 'The effect size is small-to-moderate (d ≈ 0.2–0.5), potentially relevant for clinical practice.';
    else if (Math.abs(effect) < 0.8) clinText = 'The effect size is moderate (d ≈ 0.5–0.8), likely to be clinically meaningful.';
    else clinText = 'The effect size is large (d > 0.8), indicating a clinically significant difference.';
  }
  sections.push({ section: 'Clinical Significance', text: clinText || 'No standardized clinical significance metric available for this outcome measure.' });

  // ── Robustness ──
  let robustText = `This meta-analysis included ${k} studies with a total of ${totalN.toLocaleString()} participants. `;
  if (k >= 10) {
    robustText += 'With 10 or more studies, the analysis has adequate power to detect publication bias and small-study effects.';
  } else if (k >= 5) {
    robustText += 'With fewer than 10 studies, tests for publication bias have limited sensitivity. Results should be interpreted cautiously.';
  } else {
    robustText += 'With fewer than 5 studies, the meta-analysis has limited statistical power and should be considered exploratory.';
  }
  if (m.sensitivity?.most_influential) {
    robustText += ` Leave-one-out sensitivity analysis identified ${m.sensitivity.most_influential} as the most influential study (changing the pooled estimate by ${fmt(m.sensitivity.influence_max_change_pct, 1)}%).`;
  }
  sections.push({ section: 'Robustness & Influence', text: robustText });

  // ── Limitations ──
  const limitations: string[] = [];
  if (i2 > 50) limitations.push('substantial statistical heterogeneity');
  if (k < 10) limitations.push('small number of included studies');
  const robHigh = project.rob.assessments.filter(a => a.overall === 'High' || a.overall === 'Critical').length;
  const robSome = project.rob.assessments.filter(a => a.overall === 'Some concerns').length;
  if (robHigh > project.rob.assessments.length * 0.25) limitations.push('risk of bias in a substantial proportion of studies');
  else if (robSome > project.rob.assessments.length * 0.5) limitations.push('some concerns regarding risk of bias');
  if (m.publication_bias?.egger?.significant) limitations.push('evidence of publication bias (Egger’s test significant)');
  
  let limText = limitations.length > 0
    ? `Key limitations include: ${limitations.join(', ')}. These factors should be considered when interpreting the results and may affect the certainty of the evidence (see GRADE assessment).`
    : 'No major methodological limitations were identified in this synthesis. The risk of bias assessment, heterogeneity, and publication bias evaluation all support the robustness of these findings.';
  sections.push({ section: 'Limitations', text: limText });

  // ── Conclusion ──
  const sig = pValue < 0.05;
  let conclusion = '';
  if (sig && i2 < 50) {
    conclusion = `In summary, ${intervention} demonstrates a statistically significant and consistent effect compared to ${comparator} in ${population}. The evidence supports the use of this intervention, pending consideration of the assessed certainty of evidence and clinical context.`;
  } else if (sig && i2 >= 50) {
    conclusion = `In summary, ${intervention} shows a statistically significant effect compared to ${comparator}, but substantial heterogeneity between studies suggests the effect may vary across contexts. Further research should identify moderators of the treatment effect.`;
  } else {
    conclusion = `In summary, the available evidence does not demonstrate a statistically significant effect of ${intervention} compared to ${comparator} in ${population}. This finding may reflect a true absence of effect, insufficient statistical power, or heterogeneity masking a subgroup effect.`;
  }
  sections.push({ section: 'Conclusion', text: conclusion });

  return sections;
}

function fmt(v: unknown, digits: number): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}
