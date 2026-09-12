// Data Extraction Form Template Builder
// Generates structured extraction forms with validation rules
// Based on Cochrane, JBI, and custom templates

export interface ExtractionField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'calculation';
  section: string;
  required: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: string;
  };
  description?: string;
  calculation?: string; // for calculated fields
}

export interface ExtractionTemplate {
  id: string;
  name: string;
  description: string;
  studyType: 'RCT' | 'observational' | 'diagnostic' | 'mixed' | 'custom';
  fields: ExtractionField[];
}

export interface ExtractionFormData {
  templateId: string;
  studyId: string;
  values: Record<string, string | number | boolean>;
  timestamp: string;
  reviewer: string;
}

export function getBuiltInTemplates(): ExtractionTemplate[] {
  return [
    {
      id: 'cochrane-rct',
      name: 'Cochrane RCT Extraction',
      description: 'Standard Cochrane Review data extraction form for randomized controlled trials',
      studyType: 'RCT',
      fields: [
        { id: 'study_id', label: 'Study ID', type: 'text', section: 'Identification', required: true, description: 'First author year (e.g., Smith 2020)' },
        { id: 'country', label: 'Country', type: 'text', section: 'Identification', required: true },
        { id: 'year', label: 'Year of Publication', type: 'number', section: 'Identification', required: true, validation: { min: 1950, max: 2030 } },
        { id: 'design', label: 'Study Design', type: 'select', section: 'Methods', required: true, options: ['Parallel RCT', 'Cluster RCT', 'Crossover RCT', 'Factorial RCT', 'Other'] },
        { id: 'randomization', label: 'Randomization Method', type: 'select', section: 'Methods', required: true, options: ['Computer generated', 'Random number table', 'Coin toss', 'Not reported', 'Other'] },
        { id: 'allocation_concealment', label: 'Allocation Concealment', type: 'select', section: 'Methods', required: true, options: ['Adequate', 'Inadequate', 'Unclear'] },
        { id: 'blinding', label: 'Blinding', type: 'select', section: 'Methods', required: true, options: ['Open', 'Single-blind', 'Double-blind', 'Triple-blind'] },
        { id: 'n_randomized', label: 'N Randomized (Intervention)', type: 'number', section: 'Participants', required: true, validation: { min: 1 } },
        { id: 'n_control', label: 'N Randomized (Control)', type: 'number', section: 'Participants', required: true, validation: { min: 1 } },
        { id: 'age_mean', label: 'Mean Age', type: 'number', section: 'Participants', required: false, validation: { min: 0, max: 120 } },
        { id: 'pct_female', label: '% Female', type: 'number', section: 'Participants', required: false, validation: { min: 0, max: 100 } },
        { id: 'intervention_desc', label: 'Intervention Description', type: 'text', section: 'Intervention', required: true },
        { id: 'comparator_desc', label: 'Comparator Description', type: 'text', section: 'Comparison', required: true },
        { id: 'duration', label: 'Follow-up Duration (weeks)', type: 'number', section: 'Methods', required: false, validation: { min: 0 } },
        { id: 'outcome_primary', label: 'Primary Outcome', type: 'text', section: 'Outcomes', required: true },
        { id: 'outcome_timepoint', label: 'Outcome Timepoint', type: 'text', section: 'Outcomes', required: true },
        { id: 'events_int', label: 'Events (Intervention)', type: 'number', section: 'Results', required: false, validation: { min: 0 } },
        { id: 'n_int', label: 'N analyzed (Intervention)', type: 'number', section: 'Results', required: false, validation: { min: 0 } },
        { id: 'events_ctrl', label: 'Events (Control)', type: 'number', section: 'Results', required: false, validation: { min: 0 } },
        { id: 'n_ctrl', label: 'N analyzed (Control)', type: 'number', section: 'Results', required: false, validation: { min: 0 } },
        { id: 'mean_int', label: 'Mean (Intervention)', type: 'number', section: 'Results', required: false },
        { id: 'sd_int', label: 'SD (Intervention)', type: 'number', section: 'Results', required: false, validation: { min: 0 } },
        { id: 'mean_ctrl', label: 'Mean (Control)', type: 'number', section: 'Results', required: false },
        { id: 'sd_ctrl', label: 'SD (Control)', type: 'number', section: 'Results', required: false, validation: { min: 0 } },
        { id: 'withdrawals', label: 'Withdrawals/Total', type: 'text', section: 'Results', required: false },
      ],
    },
    {
      id: 'jbi-observational',
      name: 'JBI Observational Study Extraction',
      description: 'Joanna Briggs Institute extraction form for cohort and case-control studies',
      studyType: 'observational',
      fields: [
        { id: 'study_id', label: 'Study ID', type: 'text', section: 'Identification', required: true },
        { id: 'study_design', label: 'Study Design', type: 'select', section: 'Methods', required: true, options: ['Prospective Cohort', 'Retrospective Cohort', 'Case-Control', 'Cross-Sectional', 'Case Series'] },
        { id: 'setting', label: 'Setting/Context', type: 'text', section: 'Methods', required: true },
        { id: 'population', label: 'Population', type: 'text', section: 'Participants', required: true },
        { id: 'sample_size', label: 'Sample Size', type: 'number', section: 'Participants', required: true, validation: { min: 1 } },
        { id: 'exposure', label: 'Exposure/Prognostic Factor', type: 'text', section: 'Exposure', required: true },
        { id: 'exposure_measure', label: 'How Exposure Measured', type: 'text', section: 'Exposure', required: true },
        { id: 'outcome', label: 'Outcome', type: 'text', section: 'Outcomes', required: true },
        { id: 'outcome_measure', label: 'Outcome Measurement', type: 'text', section: 'Outcomes', required: true },
        { id: 'follow_up', label: 'Follow-up Period', type: 'text', section: 'Methods', required: false },
        { id: 'effect_measure', label: 'Effect Measure', type: 'select', section: 'Results', required: true, options: ['OR', 'RR', 'HR', 'RD', 'MD', 'SMD', 'Other'] },
        { id: 'effect_value', label: 'Effect Estimate', type: 'number', section: 'Results', required: true },
        { id: 'ci_lower', label: '95% CI Lower', type: 'number', section: 'Results', required: false },
        { id: 'ci_upper', label: '95% CI Upper', type: 'number', section: 'Results', required: false },
        { id: 'p_value', label: 'P-value', type: 'number', section: 'Results', required: false, validation: { min: 0, max: 1 } },
        { id: 'confounders', label: 'Confounders Adjusted For', type: 'text', section: 'Methods', required: false },
        { id: 'notes', label: 'Notes', type: 'text', section: 'General', required: false },
      ],
    },
    {
      id: 'diagnostic-accuracy',
      name: 'QUADAS-2 Diagnostic Accuracy Extraction',
      description: 'Data extraction for diagnostic test accuracy studies',
      studyType: 'diagnostic',
      fields: [
        { id: 'study_id', label: 'Study ID', type: 'text', section: 'Identification', required: true },
        { id: 'index_test', label: 'Index Test', type: 'text', section: 'Test', required: true },
        { id: 'reference_standard', label: 'Reference Standard', type: 'text', section: 'Test', required: true },
        { id: 'threshold', label: 'Threshold/Cut-off', type: 'text', section: 'Test', required: false },
        { id: 'tp', label: 'True Positives (TP)', type: 'number', section: '2x2 Table', required: true, validation: { min: 0 } },
        { id: 'fp', label: 'False Positives (FP)', type: 'number', section: '2x2 Table', required: true, validation: { min: 0 } },
        { id: 'fn', label: 'False Negatives (FN)', type: 'number', section: '2x2 Table', required: true, validation: { min: 0 } },
        { id: 'tn', label: 'True Negatives (TN)', type: 'number', section: '2x2 Table', required: true, validation: { min: 0 } },
        { id: 'sensitivity', label: 'Sensitivity (%)', type: 'number', section: 'Results', required: false, validation: { min: 0, max: 100 } },
        { id: 'specificity', label: 'Specificity (%)', type: 'number', section: 'Results', required: false, validation: { min: 0, max: 100 } },
        { id: 'disease_prevalence', label: 'Disease Prevalence (%)', type: 'number', section: 'Participants', required: false, validation: { min: 0, max: 100 } },
        { id: 'consecutive', label: 'Consecutive/Random Sampling', type: 'select', section: 'Methods', required: true, options: ['Consecutive', 'Random', 'Convenience', 'Unclear'] },
      ],
    },
  ];
}

export function validateExtractionData(field: ExtractionField, value: unknown): string[] {
  const errors: string[] = [];
  if (field.required && (value === undefined || value === null || value === '')) {
    errors.push(`${field.label} is required`);
    return errors;
  }
  if (value === undefined || value === null || value === '') return errors;

  if (field.type === 'number') {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) {
      errors.push(`${field.label} must be a number`);
    } else {
      if (field.validation?.min !== undefined && num < field.validation.min) {
        errors.push(`${field.label} must be >= ${field.validation.min}`);
      }
      if (field.validation?.max !== undefined && num > field.validation.max) {
        errors.push(`${field.label} must be <= ${field.validation.max}`);
      }
    }
  }

  if (field.validation?.pattern && typeof value === 'string') {
    const re = new RegExp(field.validation.pattern);
    if (!re.test(value)) {
      errors.push(`${field.label} format is invalid`);
    }
  }

  return errors;
}

export function exportExtractionToCsv(data: ExtractionFormData[], template: ExtractionTemplate): string {
  if (data.length === 0) return '';
  const headers = ['StudyID', 'Template', 'Timestamp', 'Reviewer', ...template.fields.map(f => f.label)];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = data.map(d => [
    d.studyId,
    template.name,
    d.timestamp,
    d.reviewer,
    ...template.fields.map(f => d.values[f.id] ?? ''),
  ].map(esc).join(','));
  return [headers.map(esc).join(','), ...rows].join('\n');
}

export function computeDerivedValues(_template: ExtractionTemplate, values: Record<string, string | number | boolean>): Record<string, number> {
  const derived: Record<string, number> = {};

  // Compute sensitivity/specificity from 2x2
  const tp = Number(values['tp']) || 0;
  const fp = Number(values['fp']) || 0;
  const fn = Number(values['fn']) || 0;
  const tn = Number(values['tn']) || 0;

  if (tp + fn > 0) derived['computed_sensitivity'] = (tp / (tp + fn)) * 100;
  if (tn + fp > 0) derived['computed_specificity'] = (tn / (tn + fp)) * 100;
  if (tp + fp + fn + tn > 0) {
    const n = tp + fp + fn + tn;
    derived['computed_prevalence'] = ((tp + fn) / n) * 100;
    derived['computed_accuracy'] = ((tp + tn) / n) * 100;
  }

  // Compute effect sizes from summary data
  const eventsInt = Number(values['events_int']) || 0;
  const nInt = Number(values['n_int']) || 0;
  const eventsCtrl = Number(values['events_ctrl']) || 0;
  const nCtrl = Number(values['n_ctrl']) || 0;
  if (nInt > 0 && nCtrl > 0) {
    const pInt = (eventsInt + 0.5) / (nInt + 0.5);
    const pCtrl = (eventsCtrl + 0.5) / (nCtrl + 0.5);
    derived['computed_lnOR'] = Math.log((pInt / (1 - pInt)) / (pCtrl / (1 - pCtrl)));
    derived['computed_lnRR'] = Math.log(pInt / pCtrl);
    derived['computed_RD'] = (eventsInt / nInt) - (eventsCtrl / nCtrl);
  }

  // Compute SMD from means
  const mInt = Number(values['mean_int']);
  const sdInt = Number(values['sd_int']);
  const mCtrl = Number(values['mean_ctrl']);
  const sdCtrl = Number(values['sd_ctrl']);
  if (!isNaN(mInt) && !isNaN(sdInt) && !isNaN(mCtrl) && !isNaN(sdCtrl) && !isNaN(nInt) && !isNaN(nCtrl)) {
    const pooledSD = Math.sqrt(((nInt - 1) * sdInt * sdInt + (nCtrl - 1) * sdCtrl * sdCtrl) / (nInt + nCtrl - 2));
    if (pooledSD > 0) {
      derived['computed_SMD'] = (mInt - mCtrl) / pooledSD;
    }
  }

  return derived;
}
