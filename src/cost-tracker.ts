/**
 * Cost tracker — track API usage and cost per session.
 * Solves: Claude Code shows cost; we should too.
 */

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  apiCalls: number;
  toolCalls: number;
  startedAt: number;
}

// Pricing per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  // Claude models
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },

  // OpenAI models
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'o1-preview': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },

  // DeepSeek models
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },

  // Groq models
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },

  // Fallback
  'default': { input: 3.0, output: 15.0 },
};

let stats: UsageStats = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  apiCalls: 0,
  toolCalls: 0,
  startedAt: Date.now(),
};

export function resetStats(): void {
  stats = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    apiCalls: 0,
    toolCalls: 0,
    startedAt: Date.now(),
  };
}

export function recordUsage(input: number, output: number, tools: number = 0): void {
  stats.inputTokens += input;
  stats.outputTokens += output;
  stats.totalTokens += input + output;
  stats.apiCalls += 1;
  stats.toolCalls += tools;
}

export function getStats(): UsageStats {
  return { ...stats };
}

/**
 * Get pricing for a model with fuzzy matching fallback.
 */
function getPricing(model?: string): { input: number; output: number } {
  if (!model) return PRICING['default'];

  // Exact match
  if (PRICING[model]) return PRICING[model];

  // Fuzzy match: try partial matches
  const modelLower = model.toLowerCase();
  for (const [key, pricing] of Object.entries(PRICING)) {
    if (key === 'default') continue;
    if (modelLower.includes(key) || key.includes(modelLower)) {
      return pricing;
    }
  }

  // No match, use default
  return PRICING['default'];
}

export function estimateCost(model?: string): number {
  const pricing = getPricing(model);
  const inputCost = (stats.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (stats.outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export function formatCostReport(model?: string): string {
  const cost = estimateCost(model);
  const elapsed = Math.round((Date.now() - stats.startedAt) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return [
    `Tokens:  ${stats.inputTokens.toLocaleString()} in / ${stats.outputTokens.toLocaleString()} out`,
    `Total:   ${stats.totalTokens.toLocaleString()} tokens`,
    `Calls:   ${stats.apiCalls} API / ${stats.toolCalls} tools`,
    `Cost:    ~$${cost.toFixed(4)}`,
    `Time:    ${minutes}m ${seconds}s`,
  ].join('\n');
}
