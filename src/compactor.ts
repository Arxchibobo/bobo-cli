/**
 * Context compressor — self-managed compact without host dependency.
 * Solves: "compact 依赖宿主"
 *
 * Automatically compresses conversation history when it gets too long.
 * Uses the LLM itself to summarize, then replaces history with summary.
 */

import type { ChatCompletionMessageParam } from 'openai/resources/index.js';

const TOKEN_PER_CHAR_EN = 0.25;  // ~4 chars/token
const TOKEN_PER_CHAR_ZH = 0.5;   // ~2 chars/token

/**
 * Estimate token count for a message array.
 */
export function estimateTokens(messages: ChatCompletionMessageParam[]): number {
  let total = 0;
  for (const msg of messages) {
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    // Heuristic: count CJK vs Latin chars
    let cjk = 0, latin = 0;
    for (const char of text) {
      if (char.charCodeAt(0) > 0x2E80) cjk++;
      else latin++;
    }
    total += Math.ceil(cjk * TOKEN_PER_CHAR_ZH + latin * TOKEN_PER_CHAR_EN);
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
 * Compress history by keeping system prompt + recent messages + injecting summary.
 * This is the "offline" version that doesn't call the LLM.
 */
export function compressHistory(
  messages: ChatCompletionMessageParam[],
  keepRecent: number = 6,
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

  // Build summary of dropped messages
  const summaryParts: string[] = [`[Context compressed: ${dropped.length} messages (${userCount} user, ${toolCount} tool calls) summarized]`];

  // Extract file operations
  for (const msg of dropped) {
    if (msg.role === 'tool' && typeof msg.content === 'string') {
      if (msg.content.includes('Written ') || msg.content.includes('Edited ')) {
        summaryParts.push(`  • ${msg.content.split('\n')[0]}`);
      }
    }
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
