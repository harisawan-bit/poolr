// AI provider configuration and service layer

export interface AIProvider {
  id: string;
  name: string;
  provider: 'openrouter' | 'tokenrouter' | 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'together' | 'groq' | 'perplexity' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
  freeTier: boolean;
  dailyLimit: number;
  requestsUsed: number;
  lastReset: string; // ISO date
  maxConcurrent: number;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const PROVIDERS_KEY = 'poolr.aiProviders';

export const DEFAULT_PROVIDERS: Omit<AIProvider, 'id' | 'apiKey' | 'requestsUsed' | 'lastReset'>[] = [
  { name: 'OpenRouter', provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'auto', freeTier: true, dailyLimit: 50, maxConcurrent: 10, temperature: 0.1, maxTokens: 4096, enabled: true },
  { name: 'Token Router', provider: 'tokenrouter', baseUrl: 'https://tokenrouter.ai/api/v1', model: 'auto', freeTier: true, dailyLimit: 50, maxConcurrent: 10, temperature: 0.1, maxTokens: 4096, enabled: true },
  { name: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', freeTier: false, dailyLimit: 1000, maxConcurrent: 5, temperature: 0.1, maxTokens: 4096, enabled: false },
  { name: 'Anthropic', provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-haiku-20240307', freeTier: false, dailyLimit: 1000, maxConcurrent: 5, temperature: 0.1, maxTokens: 4096, enabled: false },
  { name: 'Google Gemini', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-flash', freeTier: true, dailyLimit: 150, maxConcurrent: 10, temperature: 0.1, maxTokens: 4096, enabled: false },
  { name: 'Mistral', provider: 'mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-7b-instruct', freeTier: true, dailyLimit: 100, maxConcurrent: 5, temperature: 0.1, maxTokens: 4096, enabled: false },
  { name: 'Together AI', provider: 'together', baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', freeTier: true, dailyLimit: 100, maxConcurrent: 5, temperature: 0.1, maxTokens: 4096, enabled: false },
  { name: 'Groq', provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', freeTier: true, dailyLimit: 100, maxConcurrent: 5, temperature: 0.1, maxTokens: 4096, enabled: false },
  { name: 'Perplexity', provider: 'perplexity', baseUrl: 'https://api.perplexity.ai', model: 'llama-3.1-sonar-large-128k-online', freeTier: true, dailyLimit: 50, maxConcurrent: 5, temperature: 0.1, maxTokens: 4096, enabled: false },
  { name: 'Custom', provider: 'custom', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', freeTier: true, dailyLimit: 9999, maxConcurrent: 3, temperature: 0.1, maxTokens: 4096, enabled: false },
];

export function loadProviders(): AIProvider[] {
  try {
    const raw = localStorage.getItem(PROVIDERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveProviders(providers: AIProvider[]): void {
  try {
    localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers));
  } catch {
    // quota — non-fatal
  }
}

export function getActiveProviders(): AIProvider[] {
  const providers = loadProviders();
  const today = new Date().toISOString().split('T')[0];
  return providers.filter(p => {
    if (!p.enabled || !p.apiKey) return false;
    // Reset counter if new day
    if (p.lastReset !== today) {
      p.requestsUsed = 0;
      p.lastReset = today;
    }
    // Check limit
    if (p.freeTier && p.requestsUsed >= p.dailyLimit) return false;
    return true;
  });
}

export function trackRequest(providerId: string): void {
  const providers = loadProviders();
  const p = providers.find(x => x.id === providerId);
  if (p) {
    p.requestsUsed++;
    saveProviders(providers);
  }
}

export async function callAI(provider: AIProvider, messages: AIMessage[]): Promise<AIResponse> {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: provider.temperature,
      max_tokens: provider.maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
  const data = await res.json();
  trackRequest(provider.id);
  return {
    providerId: provider.id,
    providerName: provider.name,
    model: provider.model,
    content: data.choices[0].message.content,
    usage: data.usage,
  };
}

export async function callAIMultiProvider(providers: AIProvider[], messages: AIMessage[]): Promise<AIResponse[]> {
  const results = await Promise.allSettled(providers.map(p => callAI(p, messages)));
  return results
    .filter((r): r is PromiseFulfilledResult<AIResponse> => r.status === 'fulfilled')
    .map(r => r.value);
}

// ── Phase C: AI Everywhere helpers ──

/** Suggest PICO elements from a free-text research question. */
export async function suggestPICO(
  question: string
): Promise<{ population: string; intervention: string; comparator: string; outcomes: string }> {
  const providers = getActiveProviders();
  const useProviders = providers.length > 0 ? providers : DEFAULT_PROVIDERS.filter(p => p.freeTier).map((p, i) => ({ ...p, id: `default-${i}`, apiKey: '', requestsUsed: 0, lastReset: new Date().toISOString().split('T')[0] }));

  const messages: AIMessage[] = [
    {
      role: 'system',
      content:
        'You are a systematic review methodologist. Given a research question, extract the PICO elements. Respond with ONLY a JSON object in this exact format: {"population": "...", "intervention": "...", "comparator": "...", "outcomes": "..."}. Be specific and concise.',
    },
    { role: 'user', content: `Research question: ${question}` },
  ];

  const response = await callAI(useProviders[0], messages);
  try {
    const parsed = JSON.parse(response.content);
    return {
      population: parsed.population || '',
      intervention: parsed.intervention || '',
      comparator: parsed.comparator || '',
      outcomes: parsed.outcomes || '',
    };
  } catch {
    return { population: '', intervention: '', comparator: '', outcomes: '' };
  }
}

/** Generate a Boolean search strategy for a specific database from PICO. */
export async function generateSearchStrategy(
  pico: { population: string; intervention: string; comparator: string; outcomes: string },
  database: string
): Promise<string> {
  const providers = getActiveProviders();
  const useProviders = providers.length > 0 ? providers : DEFAULT_PROVIDERS.filter(p => p.freeTier).map((p, i) => ({ ...p, id: `default-${i}`, apiKey: '', requestsUsed: 0, lastReset: new Date().toISOString().split('T')[0] }));

  const messages: AIMessage[] = [
    {
      role: 'system',
      content:
        'You are a systematic review search specialist. Generate a Boolean search strategy (using AND, OR, NOT, MeSH terms, wildcards) for the given database based on the PICO. Return ONLY the search string, no explanation.',
    },
    {
      role: 'user',
      content: `Database: ${database}\nPICO:\n- Population: ${pico.population}\n- Intervention: ${pico.intervention}\n- Comparator: ${pico.comparator}\n- Outcomes: ${pico.outcomes}`,
    },
  ];

  const response = await callAI(useProviders[0], messages);
  return response.content.trim();
}

/** Suggest a risk-of-bias rating for a domain given study abstract and domain name. */
export async function suggestRoB(
  abstract: string,
  domain: string
): Promise<{ rating: string; reason: string }> {
  const providers = getActiveProviders();
  const useProviders = providers.length > 0 ? providers : DEFAULT_PROVIDERS.filter(p => p.freeTier).map((p, i) => ({ ...p, id: `default-${i}`, apiKey: '', requestsUsed: 0, lastReset: new Date().toISOString().split('T')[0] }));

  const messages: AIMessage[] = [
    {
      role: 'system',
      content:
        'You are a risk-of-bias assessor. Given a study abstract and a RoB domain, suggest a rating: "Low", "Some concerns", or "High". Respond with ONLY a JSON object: {"rating": "...", "reason": "brief justification"}',
    },
    { role: 'user', content: `Domain: ${domain}\nAbstract: ${abstract}` },
  ];

  const response = await callAI(useProviders[0], messages);
  try {
    const parsed = JSON.parse(response.content);
    return { rating: parsed.rating || 'Low', reason: parsed.reason || '' };
  } catch {
    return { rating: 'Low', reason: '' };
  }
}

/** Interpret meta-analysis results in plain language. */
export async function interpretResults(results: {
  pooled: { effect: number; ci_lower: number; ci_upper: number; p: number };
  heterogeneity: { i2: number; tau2: number; q_p: number };
  measure: string;
}): Promise<string> {
  const providers = getActiveProviders();
  const useProviders = providers.length > 0 ? providers : DEFAULT_PROVIDERS.filter(p => p.freeTier).map((p, i) => ({ ...p, id: `default-${i}`, apiKey: '', requestsUsed: 0, lastReset: new Date().toISOString().split('T')[0] }));

  const messages: AIMessage[] = [
    {
      role: 'system',
      content:
        'You are a biostatistician. Interpret the meta-analysis results in plain language suitable for a systematic review manuscript. Summarize the pooled effect, heterogeneity, and statistical significance in 2-3 sentences.',
    },
    {
      role: 'user',
      content: `Results (${results.measure}):\n- Pooled effect: ${results.pooled.effect} (95% CI: ${results.pooled.ci_lower}–${results.pooled.ci_upper}), p=${results.pooled.p}\n- I² = ${results.heterogeneity.i2}%, τ² = ${results.heterogeneity.tau2}, Q p-value = ${results.heterogeneity.q_p}`,
    },
  ];

  const response = await callAI(useProviders[0], messages);
  return response.content.trim();
}

/** Draft a manuscript section for a systematic review. */
export async function draftManuscriptSection(
  project: { title?: string; pico: { population: string; intervention: string; comparator: string; outcomes: string }; results?: unknown },
  section: 'introduction' | 'methods' | 'results' | 'discussion'
): Promise<string> {
  const providers = getActiveProviders();
  const useProviders = providers.length > 0 ? providers : DEFAULT_PROVIDERS.filter(p => p.freeTier).map((p, i) => ({ ...p, id: `default-${i}`, apiKey: '', requestsUsed: 0, lastReset: new Date().toISOString().split('T')[0] }));

  const sectionPrompts: Record<string, string> = {
    introduction: 'Draft the Introduction section. State the rationale, gap in knowledge, and objective using PICO. 150-200 words.',
    methods: 'Draft the Methods section. Describe the search strategy, inclusion/exclusion criteria, and synthesis approach. 200-300 words.',
    results: 'Draft the Results section. Summarize the study selection, characteristics, and key findings. 200-300 words.',
    discussion: 'Draft the Discussion section. Interpret findings, compare with prior work, note limitations, and state conclusions. 200-300 words.',
  };

  const messages: AIMessage[] = [
    {
      role: 'system',
      content:
        'You are a scientific writer specializing in systematic reviews. Write a well-structured, academic manuscript section in Vancouver style. Return ONLY the section text, no headings or meta-commentary.',
    },
    {
      role: 'user',
      content: `Review title: ${project.title || 'Untitled'}\nPICO:\n- Population: ${project.pico.population}\n- Intervention: ${project.pico.intervention}\n- Comparator: ${project.pico.comparator}\n- Outcomes: ${project.pico.outcomes}\n\nTask: ${sectionPrompts[section]}`,
    },
  ];

  const response = await callAI(useProviders[0], messages);
  return response.content.trim();
}
