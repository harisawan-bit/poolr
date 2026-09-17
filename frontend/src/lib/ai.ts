// AI provider configuration with OAuth + Dynamic models

export interface AIModel {
  id: string;
  name: string;
  contextWindow?: number;
  inputTypes?: string[];
  outputTypes?: string[];
  pricing?: { prompt?: number; completion?: number };
}

export interface AIProvider {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  models: AIModel[];
  dailyLimit: number;
  requestsUsed: number;
  lastReset: string;
  maxConcurrent: number;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  connected: boolean;
  oauthSupported: boolean;
  oauthConnected: boolean;
  oauthToken?: string;
  oauthExpiry?: string;
  lastModelRefresh?: string;
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

export const PROVIDER_TEMPLATES: Record<string, {
  name: string;
  provider: string;
  baseUrl: string;
  defaultModel: string;
  oauthSupported: boolean;
  oauthUrl?: string;
  modelsEndpoint: string;
}> = {
  openrouter: { name: 'OpenRouter', provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'auto', oauthSupported: false, modelsEndpoint: '/models' },
  openai: { name: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', oauthSupported: false, modelsEndpoint: '/models' },
  anthropic: { name: 'Anthropic', provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-haiku-20240307', oauthSupported: false, modelsEndpoint: '/models' },
  gemini: { name: 'Google Gemini', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-1.5-flash', oauthSupported: true, oauthUrl: 'https://accounts.google.com/o/oauth2/v2/auth', modelsEndpoint: '/models' },
  mistral: { name: 'Mistral', provider: 'mistral', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-7b-instruct', oauthSupported: false, modelsEndpoint: '/models' },
  deepseek: { name: 'DeepSeek', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', oauthSupported: false, modelsEndpoint: '/models' },
  xai: { name: 'xAI (Grok)', provider: 'xai', baseUrl: 'https://api.x.ai/v1', defaultModel: 'grok-beta', oauthSupported: false, modelsEndpoint: '/models' },
  cohere: { name: 'Cohere', provider: 'cohere', baseUrl: 'https://api.cohere.com/v1', defaultModel: 'command-r-plus', oauthSupported: false, modelsEndpoint: '/models' },
  groq: { name: 'Groq', provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', oauthSupported: false, modelsEndpoint: '/models' },
  custom: { name: 'Custom (Ollama)', provider: 'custom', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.2', oauthSupported: false, modelsEndpoint: '/models' },
};

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
  if (!provider) {
    throw new Error('No AI provider available. Please configure an AI provider in Settings.');
  }
  if (!provider.apiKey && provider.provider !== 'custom') {
    throw new Error(`API key required for ${provider.name}. Please configure your API key in Settings.`);
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: provider.temperature,
      max_tokens: provider.maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status}): ${res.statusText}`);
  const data = await res.json();
  trackRequest(provider.id);
  return {
    providerId: provider.id,
    providerName: provider.name,
    model: provider.model,
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage,
  };
}

export async function callAIMultiProvider(providers: AIProvider[], messages: AIMessage[]): Promise<AIResponse[]> {
  const results = await Promise.allSettled(providers.map(p => callAI(p, messages)));
  return results
    .filter((r): r is PromiseFulfilledResult<AIResponse> => r.status === 'fulfilled')
    .map(r => r.value);
}

// Dynamic model refresh
export async function refreshModels(provider: AIProvider): Promise<AIModel[]> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

    const template = PROVIDER_TEMPLATES[provider.provider];
    if (!template) return [];

    const res = await fetch(`${provider.baseUrl}${template.modelsEndpoint}`, { headers });
    if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`);

    const data = await res.json();
    const models: AIModel[] = (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      contextWindow: m.context_length || m.contextWindow,
      inputTypes: m.architecture?.input_modalities,
      outputTypes: m.architecture?.output_modalities,
      pricing: m.pricing ? {
        prompt: parseFloat(m.pricing.prompt) || 0,
        completion: parseFloat(m.pricing.completion) || 0,
      } : undefined,
    }));

    // Update provider with new models
    const providers = loadProviders();
    const p = providers.find(x => x.id === provider.id);
    if (p) {
      p.models = models;
      p.lastModelRefresh = new Date().toISOString();
      saveProviders(providers);
    }

    return models;
  } catch (e) {
    console.warn('Failed to refresh models:', e);
    return [];
  }
}

// OAuth flow
export function initiateOAuth(provider: string): void {
  const template = PROVIDER_TEMPLATES[provider];
  if (!template?.oauthSupported || !template.oauthUrl) return;

  const params = new URLSearchParams({
    client_id: getOAuthClientId(provider),
    redirect_uri: `${window.location.origin}/oauth/callback`,
    response_type: 'code',
    scope: getOAuthScopes(provider),
    state: provider,
  });

  window.location.href = `${template.oauthUrl}?${params.toString()}`;
}

function getOAuthClientId(provider: string): string {
  const ids: Record<string, string> = {
    gemini: '163013848787-e38o0dsuvs6tuob4doshm88s6vitls39.apps.googleusercontent.com',
  };
  return ids[provider] || '';
}

function getOAuthScopes(provider: string): string {
  const scopes: Record<string, string> = {
    gemini: 'https://www.googleapis.com/auth/generative-language.retriever',
  };
  return scopes[provider] || '';
}

// AI helper functions (PICO, search, RoB, etc.)
export async function suggestPICO(
  question: string
): Promise<{ population: string; intervention: string; comparator: string; outcomes: string }> {
  const providers = getActiveProviders();


  const messages: AIMessage[] = [
    {
      role: 'system',
      content:
        'You are a systematic review methodologist. Given a research question, extract the PICO elements. Respond with ONLY a JSON object in this exact format: {"population": "...", "intervention": "...", "comparator": "...", "outcomes": "..."}. Be specific and concise.',
    },
    { role: 'user', content: `Research question: ${question}` },
  ];

  const response = await callAI(providers[0], messages);
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

  const response = await callAI(providers[0], messages);
  return response.content.trim();
}

/** Suggest a risk-of-bias rating for a domain given study abstract and domain name. */
export async function suggestRoB(
  abstract: string,
  domain: string
): Promise<{ rating: string; reason: string }> {
  const providers = getActiveProviders();


  const messages: AIMessage[] = [
    {
      role: 'system',
      content:
        'You are a risk-of-bias assessor. Given a study abstract and a RoB domain, suggest a rating: "Low", "Some concerns", or "High". Respond with ONLY a JSON object: {"rating": "...", "reason": "brief justification"}',
    },
    { role: 'user', content: `Domain: ${domain}\nAbstract: ${abstract}` },
  ];

  const response = await callAI(providers[0], messages);
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

  const response = await callAI(providers[0], messages);
  return response.content.trim();
}

/** Draft a manuscript section for a systematic review. */
export async function draftManuscriptSection(
  project: { title?: string; pico: { population: string; intervention: string; comparator: string; outcomes: string }; results?: unknown },
  section: 'introduction' | 'methods' | 'results' | 'discussion'
): Promise<string> {
  const providers = getActiveProviders();


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

  const response = await callAI(providers[0], messages);
  return response.content.trim();
}
