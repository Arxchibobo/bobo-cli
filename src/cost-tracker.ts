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

// Pricing per million tokens (Claude Sonnet 4 pricing)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
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

export function estimateCost(model?: string): number {
  const pricing = PRICING[model || 'default'] || PRICING['default'];
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
