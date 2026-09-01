// poolr settings — persistent app configuration

export interface AIScreeningConfig {
  batchSize: number;
  minConfidence: number;
  autoAcceptThreshold: number;
  humanReviewThreshold: number;
  enabled: boolean;
}

export interface SearchDefaults {
  databases: string[];
  resultsPerDatabase: number;
}

export interface ExportDefaults {
  format: 'docx' | 'latex' | 'json' | 'md';
  includeFigures: boolean;
  includeRawData: boolean;
  citationStyle: 'vancouver' | 'apa' | 'harvard' | 'bibtex';
}

export interface AppearanceConfig {
  theme: 'light' | 'dark';
  density: 'compact' | 'comfortable';
  fontSize: number;
  dockStyle: 'colorful' | 'monochrome' | 'minimal';
}

export interface StudyTypeConfig {
  type: 'standard' | 'network' | 'ipd' | 'multilevel' | 'diagnostic' | 'proportions' | 'qualitative' | 'manual';
}

export interface PoolrSettings {
  ai: AIScreeningConfig;
  search: SearchDefaults;
  export: ExportDefaults;
  appearance: AppearanceConfig;
  studyType: StudyTypeConfig;
}

const SETTINGS_KEY = 'poolr.settings';

export const DEFAULT_SETTINGS: PoolrSettings = {
  ai: {
    batchSize: 50,
    minConfidence: 0.7,
    autoAcceptThreshold: 0.85,
    humanReviewThreshold: 0.5,
    enabled: false,
  },
  search: {
    databases: ['PubMed', 'Embase', 'Cochrane CENTRAL', 'Scopus'],
    resultsPerDatabase: 1000,
  },
  export: {
    format: 'docx',
    includeFigures: true,
    includeRawData: true,
    citationStyle: 'vancouver',
  },
  appearance: {
      theme: 'dark',
      density: 'comfortable',
      fontSize: 12.5,
      dockStyle: 'colorful',
    },
  studyType: {
    type: 'standard',
  },
};

export function loadSettings(): PoolrSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ai: { ...DEFAULT_SETTINGS.ai, ...parsed.ai },
      search: { ...DEFAULT_SETTINGS.search, ...parsed.search },
      export: { ...DEFAULT_SETTINGS.export, ...parsed.export },
      appearance: { ...DEFAULT_SETTINGS.appearance, ...parsed.appearance },
      studyType: { ...DEFAULT_SETTINGS.studyType, ...parsed.studyType },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: PoolrSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // quota — non-fatal
  }
}

export function resetSettings(): PoolrSettings {
  saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
