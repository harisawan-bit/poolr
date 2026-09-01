"use client";

/** 2.1 Project templates — pre-fill configurations for common study types. */

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  pico: { population: string; intervention: string; comparator: string; outcomes: string };
  databases: string;
  studyType: string;
  searchStrategy: string;
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: "rct-binary",
    name: "RCT (Binary)",
    description: "Randomized controlled trial with binary outcomes",
    pico: {
      population: "",
      intervention: "Experimental intervention",
      comparator: "Placebo or standard care",
      outcomes: "Primary: [binary outcome]\nSecondary: [adverse events]"
    },
    databases: "PubMed, Embase, Cochrane CENTRAL, ClinicalTrials.gov",
    studyType: "binary",
    searchStrategy: "Randomized controlled trial[Title/Abstract] AND [intervention] AND [outcome]"
  },
  {
    id: "rct-continuous",
    name: "RCT (Continuous)",
    description: "Randomized controlled trial with continuous outcomes",
    pico: {
      population: "",
      intervention: "Experimental intervention",
      comparator: "Placebo or standard care",
      outcomes: "Primary: [continuous outcome, e.g. pain score, blood pressure]"
    },
    databases: "PubMed, Embase, Cochrane CENTRAL",
    studyType: "continuous",
    searchStrategy: "Randomized controlled trial[Title/Abstract] AND [intervention] AND [outcome]"
  },
  {
    id: "diagnostic",
    name: "Diagnostic Test Accuracy",
    description: "Meta-analysis of diagnostic test accuracy",
    pico: {
      population: "Patients with suspected condition",
      intervention: "Index test",
      comparator: "Reference standard",
      outcomes: "Sensitivity, specificity, diagnostic odds ratio, AUC"
    },
    databases: "PubMed, Embase, Cochrane Database of Systematic Reviews",
    studyType: "diagnostic",
    searchStrategy: "sensitivity[Title/Abstract] AND specificity[Title/Abstract] AND [disease]"
  },
  {
    id: "prognostic",
    name: "Prognostic Factor/Model",
    description: "Meta-analysis of prognostic factors",
    pico: {
      population: "Patients with condition",
      intervention: "[Prognostic factor]",
      comparator: "Absence of factor",
      outcomes: "Overall survival, disease-free survival"
    },
    databases: "PubMed, Embase, PROSPERO",
    studyType: "prognostic",
    searchStrategy: "prognosis[Title/Abstract] AND [factor] AND [outcome]"
  },
  {
    id: "prevalence",
    name: "Prevalence",
    description: "Meta-analysis of prevalence/incidence",
    pico: {
      population: "[Target population]",
      intervention: "",
      comparator: "",
      outcomes: "Prevalence, incidence"
    },
    databases: "PubMed, Embase, Global Index Medicus",
    studyType: "proportion",
    searchStrategy: "prevalence[Title/Abstract] AND [condition] AND [population]"
  },
  {
    id: "qualitative",
    name: "Qualitative Synthesis",
    description: "Qualitative evidence synthesis / thematic analysis",
    pico: {
      population: "[Population]",
      intervention: "[Experience/phenomenon]",
      comparator: "",
      outcomes: "Themes, experiences"
    },
    databases: "PubMed, CINAHL, PsycINFO",
    studyType: "qualitative",
    searchStrategy: "qualitative AND [phenomenon] AND experience"
  },
];

export function getTemplate(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}
