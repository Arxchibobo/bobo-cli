/**
 * Context compressor — three-tier compression strategy.
 * Solves: "compact 依赖宿主"
 *
 * Three compression tiers:
 * - Tier 1 Microcompact: Replace old tool results with [Tool result cleared]
 * - Tier 2 Auto-compact: 87% threshold with circuit breaker (stops after 3 consecutive failures)
 * - Tier 3 Full compact: LLM-generated summary (TEXT ONLY, strict)
 */

import type { ChatCompletionMessageParam } from 'openai/resources/index.js';

const TOKEN_PER_CHAR_EN = 0.25;  // ~4 chars/token
const TOKEN_PER_CHAR_ZH = 0.5;   // ~2 chars/token
const TIER_1_THRESHOLD = 0.60;   // 60% - start microcompact
const TIER_2_THRESHOLD = 0.87;   // 87% - trigger auto-compact
const TIER_3_THRESHOLD = 0.95;   // 95% - force full compact
const MAX_CONTEXT_TOKENS = 128000; // Approximate max context window
const CIRCUIT_BREAKER_LIMIT = 3;   // Max consecutive failures before stopping

// Circuit breaker state
let consecutiveCompactFailures = 0;

/**
 * Estimate token count for a text string.
 */
export function estimateTokensForText(text: string): number {
  let cjk = 0, latin = 0;
  for (const char of text) {
    if (char.charCodeAt(0) > 0x2E80) cjk++;
    else latin++;
  }
  return Math.ceil(cjk * TOKEN_PER_CHAR_ZH + latin * TOKEN_PER_CHAR_EN);
}

/**
 * Estimate token count for a message array.
 */
export function estimateTokens(messages: ChatCompletionMessageParam[]): number {
  let total = 0;
  for (const msg of messages) {
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    total += estimateTokensForText(text);
    total += 4; // message overhead
  }
  return total;
}

/**
 * Check if we should auto-compact.
 */
export function shouldCompact(messages: ChatCompletionMessageParam[], threshold: number = 80000): boolean {
  return estimateTokens(messages) > threshold;
}

/**
 * Determine which compression tier to use based on context usage.
 */
export function getCompressionTier(messages: ChatCompletionMessageParam[]): {
  tier: 1 | 2 | 3 | null;
  usage: number;
  threshold: number;
} {
  const tokens = estimateTokens(messages);
  const usage = tokens / MAX_CONTEXT_TOKENS;

  if (usage >= TIER_3_THRESHOLD) {
    return { tier: 3, usage, threshold: TIER_3_THRESHOLD };
  }

  if (usage >= TIER_2_THRESHOLD) {
    // Check circuit breaker
    if (consecutiveCompactFailures >= CIRCUIT_BREAKER_LIMIT) {
      return { tier: null, usage, threshold: TIER_2_THRESHOLD }; // Circuit breaker tripped
    }
    return { tier: 2, usage, threshold: TIER_2_THRESHOLD };
  }

  if (usage >= TIER_1_THRESHOLD) {
    return { tier: 1, usage, threshold: TIER_1_THRESHOLD };
  }

  return { tier: null, usage, threshold: 0 };
}

/**
 * Reset circuit breaker on successful compact.
 */
export function resetCircuitBreaker(): void {
  consecutiveCompactFailures = 0;
}

/**
 * Increment circuit breaker on failed compact.
 */
export function incrementCircuitBreaker(): void {
  consecutiveCompactFailures++;
}

/**
 * Get circuit breaker status.
 */
export function getCircuitBreakerStatus(): { failures: number; tripped: boolean } {
  return {
    failures: consecutiveCompactFailures,
    tripped: consecutiveCompactFailures >= CIRCUIT_BREAKER_LIMIT,
  };
}

/**
 * Build a compact summary request — returns the prompt to send to the LLM.
 * The caller should send this to the API and use the response as new history.
 */
export function buildCompactPrompt(messages: ChatCompletionMessageParam[]): string {
  // Extract key info
  const userMessages: string[] = [];
  const assistantActions: string[] = [];
  const toolResults: string[] = [];

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : '';
    if (msg.role === 'user' && content) {
      userMessages.push(content.slice(0, 500));
    } else if (msg.role === 'assistant' && content) {
      assistantActions.push(content.slice(0, 300));
    } else if (msg.role === 'tool' && content) {
      toolResults.push(content.slice(0, 200));
    }
  }

  return `Summarize this conversation into a structured context block for continuing work.
Include:
1. Original user request/intent
2. Key technical concepts discovered
3. Files read/modified (with paths)
4. Errors encountered and how they were fixed
5. Current working state
6. All explicit user preferences/corrections
7. Pending tasks / next steps

User messages (${userMessages.length}):
${userMessages.slice(-10).join('\n---\n')}

Assistant actions (${assistantActions.length}):
${assistantActions.slice(-8).join('\n---\n')}

Tool results (${toolResults.length}):
${toolResults.slice(-5).join('\n---\n')}

Output a concise summary (under 2000 tokens) that preserves all critical context.`;
}

/**
 * Tier 1: Microcompact — clear old tool results.
 * Replaces tool result content with [Tool result cleared] for messages older than keepRecent.
 */
export function microcompact(
  messages: ChatCompletionMessageParam[],
  keepRecent: number = 10,
): ChatCompletionMessageParam[] {
  if (messages.length <= keepRecent) return messages;

  const result: ChatCompletionMessageParam[] = [];
  const clearBefore = messages.length - keepRecent;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (i < clearBefore && msg.role === 'tool') {
      // Clear old tool results
      result.push({
        ...msg,
        content: '[Tool result cleared]',
      });
    } else {
      result.push(msg);
    }
  }

  return result;
}

/**
 * Tier 2: Auto-compact — keep system + recent messages + summary.
 * This is triggered at 87% context usage.
 */
export function autocompact(
  messages: ChatCompletionMessageParam[],
  keepRecent: number = 8,
): ChatCompletionMessageParam[] {
  if (messages.length <= keepRecent + 1) return messages;

  // Keep system message
  const system = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  // Keep last N messages
  const recent = nonSystem.slice(-keepRecent);

  // Summarize the dropped messages
  const dropped = nonSystem.slice(0, -keepRecent);
  const userCount = dropped.filter(m => m.role === 'user').length;
  const toolCount = dropped.filter(m => m.role === 'tool').length;
  const assistantCount = dropped.filter(m => m.role === 'assistant').length;

  // Build summary of dropped messages
  const summaryParts: string[] = [
    `[Auto-compacted: ${dropped.length} messages summarized]`,
    `• ${userCount} user messages`,
    `• ${assistantCount} assistant responses`,
    `• ${toolCount} tool calls`,
  ];

  // Extract file operations
  const fileOps: string[] = [];
  for (const msg of dropped) {
    if (msg.role === 'tool' && typeof msg.content === 'string') {
      if (msg.content.includes('Written ') || msg.content.includes('Edited ')) {
        fileOps.push(`  • ${msg.content.split('\n')[0]}`);
      }
    }
  }

  if (fileOps.length > 0) {
    summaryParts.push('', 'File operations:', ...fileOps.slice(-5)); // Last 5 ops
  }

  const summaryMessage: ChatCompletionMessageParam = {
    role: 'user',
    content: summaryParts.join('\n'),
  };

  const result: ChatCompletionMessageParam[] = [];
  if (system) result.push(system);
  result.push(summaryMessage);
  result.push(...recent);

  return result;
}

/**
 * Tier 3: Full compact — LLM-generated summary (TEXT ONLY).
 * This requires an LLM call and returns a prompt for the LLM to generate summary.
 * The caller should execute this and use the result to replace history.
 */
export function buildFullCompactPrompt(messages: ChatCompletionMessageParam[]): string {
  // Extract key info
  const userMessages: string[] = [];
  const assistantActions: string[] = [];
  const toolResults: string[] = [];
  const fileOperations: string[] = [];

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : '';

    if (msg.role === 'user' && content) {
      userMessages.push(content.slice(0, 500));
    } else if (msg.role === 'assistant' && content) {
      assistantActions.push(content.slice(0, 300));
    } else if (msg.role === 'tool' && content) {
      toolResults.push(content.slice(0, 200));
      // Extract file operations
      if (content.includes('Written ') || content.includes('Edited ')) {
        fileOperations.push(content.split('\n')[0]);
      }
    }
  }

  return `CRITICAL: Generate a TEXT-ONLY summary of this conversation for context continuation.

Requirements:
1. Output PLAIN TEXT only — no markdown, no code blocks, no formatting
2. Include ALL critical information needed to continue work
3. Maximum 2000 tokens
4. Structure: Intent → Context → Actions → State → Next Steps

User messages (${userMessages.length}):
${userMessages.slice(-15).join('\n---\n')}

Assistant actions (${assistantActions.length}):
${assistantActions.slice(-10).join('\n---\n')}

Tool results (${toolResults.length}):
${toolResults.slice(-8).join('\n---\n')}

File operations (${fileOperations.length}):
${fileOperations.slice(-10).join('\n')}

Generate summary now (TEXT ONLY, no formatting):`;
}

/**
 * Legacy: Compress history by keeping system prompt + recent messages + injecting summary.
 * This is the "offline" version that doesn't call the LLM.
 */
export function compressHistory(
  messages: ChatCompletionMessageParam[],
  keepRecent: number = 6,
): ChatCompletionMessageParam[] {
  // Use autocompact by default
  return autocompact(messages, keepRecent);
}

/**
 * Get compact status info.
 */
export function getCompactStatus(messages: ChatCompletionMessageParam[]): {
  tokens: number;
  messages: number;
  shouldCompact: boolean;
  urgency: 'low' | 'medium' | 'high' | 'critical';
} {
  const tokens = estimateTokens(messages);
  const msgCount = messages.length;

  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (tokens > 120000) urgency = 'critical';
  else if (tokens > 100000) urgency = 'high';
  else if (tokens > 80000) urgency = 'medium';

  return {
    tokens,
    messages: msgCount,
    shouldCompact: tokens > 80000,
    urgency,
  };
}
