// PROSPERO Registration Wizard
// Step-by-step helper to generate a PROSPERO-compliant protocol document
// Client-side only — zero new dependencies

export interface ProsperoSection {
  id: string;
  title: string;
  description: string;
  required: boolean;
  fields: ProsperoField[];
}

export interface ProsperoField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'multi-select' | 'checkbox';
  placeholder?: string;
  options?: string[];
  required: boolean;
  helpText?: string;
  value: string | string[] | boolean;
  title?: string; // optional display title (alias for label)
}

export interface ProsperoProtocol {
  reviewTitle: string;
  reviewQuestion: string;
  population: string;
  intervention: string;
  comparator: string;
  outcome: string;
  studyDesign: string[];
  searchSources: string[];
  searchDate: string;
  languageRestrictions: string;
  country: string;
  contactName: string;
  contactEmail: string;
  affiliation: string;
  reviewTeam: string[];
  conflictsOfInterest: string;
  fundingSource: string;
  anticipatedStartDate: string;
  anticipatedCompletionDate: string;
  status: 'protocol' | 'ongoing' | 'completed';
}

const PROSPERO_SECTIONS: ProsperoSection[] = [
  {
    id: 'identification',
    title: 'Identification',
    description: 'Review title and registration details',
    required: true,
    fields: [
      {
        id: 'reviewTitle',
        label: 'Review title',
        type: 'textarea',
        placeholder: 'e.g. Effect of cognitive behavioral therapy for anxiety in children: a systematic review and meta-analysis',
        required: true,
        value: '',
      },
      {
        id: 'reviewQuestion',
        label: 'Review question',
        type: 'textarea',
        placeholder: 'State the primary research question using PICO format',
        required: true,
        value: '',
      },
    ],
  },
  {
    id: 'methodology',
    title: 'Methodology',
    description: 'Eligibility criteria and search strategy',
    required: true,
    fields: [
      {
        id: 'population',
        label: 'Population / Condition',
        type: 'textarea',
        placeholder: 'Describe the target population and condition of interest',
        required: true,
        value: '',
      },
      {
        id: 'intervention',
        label: 'Intervention / Exposure',
        type: 'textarea',
        placeholder: 'Describe the intervention or exposure being investigated',
        required: true,
        value: '',
      },
      {
        id: 'comparator',
        label: 'Comparator / Control',
        type: 'text',
        placeholder: 'e.g. Placebo, usual care, no intervention',
        required: true,
        value: '',
      },
      {
        id: 'outcome',
        label: 'Outcomes',
        type: 'textarea',
        placeholder: 'List primary and secondary outcomes (separate with commas)',
        required: true,
        value: '',
      },
      {
        id: 'studyDesign',
        label: 'Study design',
        type: 'multi-select',
        options: [
          'Randomized Controlled Trial',
          'Non-Randomized Controlled Trial',
          'Cohort Study',
          'Case-Control Study',
          'Cross-Sectional Study',
          'Case Series',
          'Case Report',
          'Qualitative Study',
          'Ecological Study',
          'Other',
        ],
        required: true,
        value: [] as string[],
      },
    ],
  },
  {
    id: 'search',
    title: 'Search Strategy',
    description: 'Databases and search constraints',
    required: true,
    fields: [
      {
        id: 'searchSources',
        label: 'Information sources',
        type: 'multi-select',
        options: [
          'MEDLINE (PubMed)',
          'Embase',
          'Cochrane CENTRAL',
          'CINAHL',
          'PsycINFO',
          'Web of Science',
          'Scopus',
          'LILACS',
          'ClinicalTrials.gov',
          'WHO ICTRP',
          'OpenGrey',
          'ProQuest Dissertations',
        ],
        required: true,
        value: [] as string[],
      },
      {
        id: 'searchDate',
        label: 'Search date',
        type: 'date',
        required: true,
        value: '',
      },
      {
        id: 'languageRestrictions',
        label: 'Language restrictions',
        type: 'select',
        options: ['No language restrictions', 'English only', 'English and Spanish', 'Other'],
        required: true,
        value: 'No language restrictions',
      },
    ],
  },
  {
    id: 'team',
    title: 'Review Team',
    description: 'Contact information and team members',
    required: true,
    fields: [
      {
        id: 'contactName',
        label: 'Named contact',
        type: 'text',
        placeholder: 'Full name of corresponding reviewer',
        required: true,
        value: '',
      },
      {
        id: 'contactEmail',
        label: 'Named contact email',
        type: 'text',
        placeholder: 'institutional@email.edu',
        required: true,
        value: '',
      },
      {
        id: 'affiliation',
        label: 'Organizational affiliation',
        type: 'text',
        placeholder: 'University or institution name',
        required: true,
        value: '',
      },
      {
        id: 'reviewTeam',
        label: 'Review team members',
        type: 'textarea',
        placeholder: 'List all team members and their roles (one per line)',
        required: true,
        value: '',
      },
      {
        id: 'conflictsOfInterest',
        label: 'Conflicts of interest',
        type: 'textarea',
        placeholder: 'Declare any conflicts of interest, or state "None declared"',
        required: false,
        value: '',
      },
      {
        id: 'fundingSource',
        label: 'Funding source / sponsors',
        type: 'text',
        placeholder: 'Grant number or "No external funding"',
        required: false,
        value: '',
      },
    ],
  },
  {
    id: 'timeline',
    title: 'Timeline',
    description: 'Expected start and completion dates',
    required: true,
    fields: [
      {
        id: 'anticipatedStartDate',
        label: 'Anticipated start date',
        type: 'date',
        required: true,
        value: '',
      },
      {
        id: 'anticipatedCompletionDate',
        label: 'Anticipated completion date',
        type: 'date',
        required: true,
        value: '',
      },
    ],
  },
];

export function getProsperoSections(): ProsperoSection[] {
  return PROSPERO_SECTIONS;
}

export function validateProsperoSection(sectionId: string, data: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const section = PROSPERO_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return errors;

  for (const field of section.fields) {
    if (!field.required) continue;
    const value = data[field.id];
    if (value === undefined || value === null || value === '') {
      errors.push(`${field.label} is required`);
    } else if (Array.isArray(value) && value.length === 0) {
      errors.push(`${field.label} must have at least one selection`);
    }
  }
  return errors;
}

export function generateProsperoMarkdown(data: Record<string, any>): string {
  const sections: string[] = [];

  sections.push(`# PROSPERO Protocol Registration`);
  sections.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}\n`);
  sections.push(`**Review Title:** ${data.reviewTitle}\n`);

  sections.push(`## Review Question`);
  sections.push(`${data.reviewQuestion}\n`);

  sections.push(`## Eligibility Criteria`);
  sections.push(`| Element | Description |`);
  sections.push(`|---------|-------------|`);
  sections.push(`| Population | ${data.population} |`);
  sections.push(`| Intervention | ${data.intervention} |`);
  sections.push(`| Comparator | ${data.comparator} |`);
  sections.push(`| Outcomes | ${data.outcome} |`);
  sections.push(`| Study Designs | ${data.studyDesign.join(', ')} |\n`);

  sections.push(`## Search Strategy`);
  sections.push(`- **Sources:** ${Array.isArray(data.searchSources) ? data.searchSources.join(', ') : data.searchSources}`);
  sections.push(`- **Search Date:** ${data.searchDate}`);
  sections.push(`- **Language:** ${data.languageRestrictions}\n`);

  sections.push(`## Review Team`);
  sections.push(`- **Contact:** ${data.contactName} (${data.contactEmail})`);
  sections.push(`- **Affiliation:** ${data.affiliation}`);
  sections.push(`- **Team:**\n${String(data.reviewTeam).split('\n').map((t: string) => `  - ${t}`).join('\n')}`);
  if (data.conflictsOfInterest) sections.push(`\n- **Conflicts:** ${data.conflictsOfInterest}`);
  if (data.fundingSource) sections.push(`\n- **Funding:** ${data.fundingSource}\n`);

  sections.push(`## Timeline`);
  sections.push(`- **Start:** ${data.anticipatedStartDate}`);
  sections.push(`- **Completion:** ${data.anticipatedCompletionDate}`);
  sections.push(`- **Status:** ${data.status}\n`);

  sections.push(`---`);
  sections.push(`*This protocol was generated using poolr and is formatted for PROSPERO submission.`);
  sections.push(`Please review all fields before submitting to [PROSPERO](https://www.crd.york.ac.uk/prospero/).*`);

  return sections.join('\n');
}

export function getCompletionPercentage(data: Record<string, unknown>): number {
  const requiredFields = PROSPERO_SECTIONS.flatMap((s) => s.fields.filter((f) => f.required));
  const filled = requiredFields.filter((f) => {
    const v = data[f.id];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'boolean') return true;
    return v !== '' && v !== undefined && v !== null;
  });
  return Math.round((filled.length / requiredFields.length) * 100);
}
