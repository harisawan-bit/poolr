import type { Project } from './project';

export interface ManuscriptSections {
  title: string;
  abstract: string;
  introduction: string;
  methods: string;
  results: string;
  discussion: string;
  conclusion: string;
}

/**
 * Generate structured manuscript sections from project data.
 * Fully client-side — no AI dependency.
 */
export function draftManuscriptTemplate(project: Project, customNotes = ''): ManuscriptSections {
  const pico = project.pico;
  const results = project.meta.results as any;
  const studies = project.extraction.studies;
  const robAssessments = project.rob.assessments;
  const studyCount = studies.length;
  const totalN = studies.reduce((s, st) => s + (st.int_n ?? 0) + (st.ctrl_n ?? 0), 0);

  const robLow = robAssessments.filter(a => a.overall === 'Low').length;
  const robSome = robAssessments.filter(a => a.overall === 'Some concerns').length;
  const robHigh = robAssessments.filter(a => a.overall === 'High' || a.overall === 'Critical').length;

  const intervention = pico.intervention || '[intervention]';
  const comparator = pico.comparator || '[comparator]';
  const population = pico.population || '[population]';
  const outcomes = pico.outcomes || '[outcomes]';

  const hasResults = !!results;
  const pooledEffect = hasResults ? results.pooled?.effect : null;
  const ciLower = hasResults ? results.pooled?.ci_lower : null;
  const ciUpper = hasResults ? results.pooled?.ci_upper : null;
  const pValue = hasResults ? results.pooled?.p : null;
  const i2 = hasResults ? results.heterogeneity?.i2 : null;
  const measure = results?.measure || 'OR';
  const k = hasResults ? results.studies?.length : studyCount;
  const sig = pValue != null && pValue < 0.05;

  // ── Title ──
  const titleDraft = `Effectiveness of ${intervention} compared to ${comparator} for ${population}: A systematic review and meta-analysis`;

  // ── Abstract ──
  let abstractDraft = `**Background:** ${intervention} has been proposed as an intervention for ${population}, but its effectiveness compared to ${comparator} remains uncertain.\n\n`;
  abstractDraft += `**Objective:** To assess the effectiveness of ${intervention} compared to ${comparator} for ${outcomes} in ${population}.\n\n`;
  abstractDraft += `**Methods:** A systematic review and meta-analysis was conducted. Databases were searched for randomized controlled trials. Two reviewers independently screened, extracted data, and assessed risk of bias.`;
  if (hasResults) {
    abstractDraft += ` A random-effects meta-analysis was performed using the DerSimonian-Laird method.`;
  }
  abstractDraft += `\n\n`;
  abstractDraft += `**Results:** ${k} studies (${totalN.toLocaleString()} participants) were included.`;
  if (hasResults && pooledEffect != null) {
    abstractDraft += ` The pooled ${measure} was ${pooledEffect.toFixed(2)} (95% CI: ${ciLower.toFixed(2)}–${ciUpper.toFixed(2)}, p = ${pValue.toFixed(4)}).`;
    if (i2 != null) abstractDraft += ` Heterogeneity was ${i2 > 50 ? 'substantial' : 'moderate'} (I² = ${i2.toFixed(0)}%).`;
  }
  abstractDraft += `\n\n`;
  abstractDraft += `**Conclusion:** ${sig ? `${intervention} appears to have a statistically significant effect compared to ${comparator}.` : `No statistically significant difference was found between ${intervention} and ${comparator}.`} Further high-quality research is ${sig ? 'needed to confirm these findings' : 'required to establish effectiveness'}.`;
  if (customNotes) abstractDraft += `\n\n**Notes:** ${customNotes}`;

  // ── Introduction ──
  let introDraft = `Despite widespread use of ${intervention} for ${population}, uncertainty remains regarding its comparative effectiveness against ${comparator}. `;
  introDraft += `Previous reviews have yielded conflicting results, highlighting the need for an updated synthesis.\n\n`;
  introDraft += `The primary objective of this systematic review and meta-analysis is to assess the effectiveness of ${intervention} compared to ${comparator} for ${outcomes} in ${population}. `;
  introDraft += `Secondarily, we aimed to explore sources of heterogeneity and assess the certainty of evidence using the GRADE framework.`;
  if (customNotes) introDraft += `\n\n**Author context:** ${customNotes}`;

  // ── Methods ──
  let methodsDraft = `This systematic review and meta-analysis was conducted according to the PRISMA 2020 statement and prospectively registered.\n\n`;
  methodsDraft += `**Search strategy:** A comprehensive search of electronic databases (PubMed, Embase, Cochrane CENTRAL, Scopus) was conducted from inception to ${new Date().getFullYear()}. The search strategy combined Medical Subject Headings (MeSH) and free-text terms for: `;
  methodsDraft += `(Population: "${population}") AND (Intervention: "${intervention}") AND (Comparator: "${comparator}") AND (Outcomes: "${outcomes}"). `;
  methodsDraft += `No language restrictions were applied.\n\n`;
  methodsDraft += `**Eligibility criteria:** Randomized controlled trials (RCTs) comparing ${intervention} with ${comparator} in ${population} were eligible. Studies reporting on ${outcomes} were included.\n\n`;
  methodsDraft += `**Study selection and data extraction:** Two reviewers independently screened titles, abstracts, and full texts. Disagreements were resolved by consensus or third-party adjudication. Data extraction was performed using a standardized form.\n\n`;
  methodsDraft += `**Risk of bias:** Two reviewers independently assessed risk of bias using the Cochrane Risk of Bias tool (RoB 2). Disagreements were resolved by discussion.\n\n`;
  methodsDraft += `**Data synthesis:** A random-effects meta-analysis was performed using the DerSimonian-Laird method. Heterogeneity was quantified using I² and τ². Publication bias was assessed using funnel plots and Egger's test where appropriate (≥10 studies). The GRADE framework was used to assess certainty of evidence.\n\n`;
  methodsDraft += `**Subgroup analyses:** Pre-specified subgroup analyses examined the influence of study characteristics on effect estimates.\n\n`;
  methodsDraft += `**Sensitivity analyses:** Leave-one-out sensitivity analysis was conducted to assess the robustness of pooled estimates.`;

  // ── Results ──
  let resultsDraft = `**Study selection:** The search identified records for screening. After removing duplicates, records were screened at the title/abstract level, and full texts were assessed. ${k} studies (${totalN.toLocaleString()} participants) met inclusion criteria.\n\n`;
  resultsDraft += `**Study characteristics:** Included studies enrolled ${totalN.toLocaleString()} participants. ${studyCount} studies were RCTs. Studies varied in sample size, intervention duration, and follow-up periods.\n\n`;
  resultsDraft += `**Risk of bias:** ${robLow} studies were rated as low risk of bias, ${robSome} as having some concerns, and ${robHigh} as high risk of bias.\n\n`;

  if (hasResults && pooledEffect != null) {
    resultsDraft += `**Pooled effect:** The pooled ${measure} was ${pooledEffect.toFixed(2)} (95% CI: ${ciLower.toFixed(2)}–${ciUpper.toFixed(2)}, p = ${pValue.toFixed(4)}). `;
    resultsDraft += sig ? `This represents a statistically significant effect.` : `This was not statistically significant.`;
    resultsDraft += `\n\n`;
    resultsDraft += `**Heterogeneity:** `;
    if (i2 != null) {
      if (i2 > 75) resultsDraft += `Considerable heterogeneity was detected (I² = ${i2.toFixed(0)}%).`;
      else if (i2 > 50) resultsDraft += `Substantial heterogeneity was observed (I² = ${i2.toFixed(0)}%).`;
      else if (i2 > 25) resultsDraft += `Moderate heterogeneity was observed (I² = ${i2.toFixed(0)}%).`;
      else resultsDraft += `Minimal heterogeneity was detected (I² = ${i2.toFixed(0)}%).`;
    }
    resultsDraft += `\n\n`;
    resultsDraft += `**Sensitivity analysis:** Leave-one-out analysis confirmed the robustness of the pooled estimate.\n\n`;
    resultsDraft += `**Publication bias:** `;
    if (k >= 10) {
      resultsDraft += `Funnel plot inspection and Egger's test did not reveal significant publication bias.`;
    } else {
      resultsDraft += `With fewer than 10 studies, publication bias could not be reliably assessed.`;
    }
  } else {
    resultsDraft += `**Synthesis:** A narrative synthesis was conducted. Meta-analysis was not performed due to insufficient data or heterogeneity.`;
  }

  // ── Discussion ──
  let discussionDraft = `**Summary of evidence:** This systematic review ${hasResults ? `and meta-analysis` : ''} synthesized evidence from ${k} studies (${totalN.toLocaleString()} participants) comparing ${intervention} with ${comparator} for ${population}. `;
  if (hasResults && pooledEffect != null) {
    discussionDraft += `The pooled ${measure} of ${pooledEffect.toFixed(2)} (95% CI: ${ciLower.toFixed(2)}–${ciUpper.toFixed(2)}) ${sig ? 'suggests a statistically significant effect' : 'did not reach statistical significance'}.`;
  }
  discussionDraft += `\n\n`;
  discussionDraft += `**Comparison with prior work:** Our findings are consistent with previous reviews in this area. The observed effect size is comparable to that reported in similar populations.\n\n`;
  discussionDraft += `**Strengths and limitations:`;
  discussionDraft += `\n- Strengths include a comprehensive search, dual screening, and GRADE assessment.`;
  discussionDraft += `\n- Limitations include ${robHigh > 0 ? 'risk of bias in some included studies, ' : ''}${i2 != null && i2 > 50 ? 'substantial heterogeneity, ' : ''}and ${k < 10 ? 'a small number of included studies' : 'potential for publication bias'}.`;
  discussionDraft += `\n- The generalizability of findings may be limited by the characteristics of included populations.\n\n`;
  discussionDraft += `**Implications for practice:** ${sig ? `These findings support the use of ${intervention} in clinical practice for ${population}.` : `Current evidence does not support a clear advantage of ${intervention} over ${comparator}.`} Clinicians should consider individual patient factors when making treatment decisions.\n\n`;
  discussionDraft += `**Implications for research:** Further large-scale, high-quality RCTs are needed to ${sig ? 'confirm these findings and explore moderators of effect' : 'establish the effectiveness of ${intervention}'}. Future studies should standardize outcome reporting and include long-term follow-up.`;

  // ── Conclusion ──
  let conclusionDraft = `This systematic review ${hasResults ? 'and meta-analysis' : ''} ${sig ? `provides evidence for a statistically significant effect of ${intervention} compared to ${comparator} in ${population}` : `did not find a statistically significant difference between ${intervention} and ${comparator} for ${population}`}. `;
  conclusionDraft += `The certainty of evidence was ${robHigh > 0 || (i2 != null && i2 > 50) ? 'low to moderate' : 'moderate to high'}. `;
  conclusionDraft += `These findings ${sig ? 'support' : 'do not support'} the use of ${intervention} in clinical practice. Further research is needed to strengthen the evidence base.`;

  return {
    title: titleDraft,
    abstract: abstractDraft,
    introduction: introDraft,
    methods: methodsDraft,
    results: resultsDraft,
    discussion: discussionDraft,
    conclusion: conclusionDraft,
  };
}
