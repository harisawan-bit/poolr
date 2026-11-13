export const practiceSteps = [
  { page: 'dashboard', label: 'Dashboard', hint: 'Open the review summary and check the next suggested action.' },
  { page: 'protocol', label: 'Protocol', hint: 'Inspect the review question and the population, intervention, comparator, and outcomes fields.' },
  { page: 'search', label: 'Search', hint: 'Open the visual query builder, add two terms, choose how to combine them, and preview the query.' },
  { page: 'screening', label: 'Screening', hint: 'Open a record, read its details, and try changing its screening decision.' },
  { page: 'extraction', label: 'Extraction', hint: 'Open a study row and inspect the values for each arm.' },
  { page: 'rob', label: 'Risk of Bias', hint: 'Select an assessment tool and open a study to inspect its judgments.' },
  { page: 'meta', label: 'Analysis', hint: 'Explore Pairwise settings and the method groups. Run an analysis if the engine is online.' },
  { page: 'prisma', label: 'PRISMA', hint: 'Inspect the flow diagram and compare it with the screening counts.' },
  { page: 'manuscript', label: 'Manuscript', hint: 'Open a draft section and inspect the available export controls.' },
] as const;
