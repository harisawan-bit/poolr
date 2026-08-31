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
