/**
 * Provider presets — quick switch between AI providers.
 * Bobo CLI uses OpenAI-compatible API, so any provider works.
 */

export interface ProviderPreset {
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  envKey?: string; // Environment variable for API key
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'],
    envKey: 'ANTHROPIC_API_KEY',
  },
  {
    name: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini', 'gpt-4-turbo'],
    envKey: 'OPENAI_API_KEY',
  },
  {
    name: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    envKey: 'DEEPSEEK_API_KEY',
  },
  {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    envKey: 'GROQ_API_KEY',
  },
  {
    name: 'together',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    envKey: 'TOGETHER_API_KEY',
  },
  {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4-20250514',
    models: ['anthropic/claude-sonnet-4-20250514', 'openai/gpt-4o', 'google/gemini-2.5-pro'],
    envKey: 'OPENROUTER_API_KEY',
  },
  {
    name: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.3',
    models: ['llama3.3', 'codellama', 'mistral', 'deepseek-coder-v2'],
  },
];

export function getPreset(name: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find(p => p.name.toLowerCase() === name.toLowerCase());
}

export function listPresets(): string {
  return PROVIDER_PRESETS.map(p =>
    `  ${p.name.padEnd(12)} ${p.baseUrl}\n${''.padEnd(14)}Models: ${p.models.slice(0, 3).join(', ')}`
  ).join('\n');
}
