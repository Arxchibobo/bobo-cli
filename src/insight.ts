/**
 * /insight — Session analytics and stats.
 */

import chalk from 'chalk';
import type { ChatCompletionMessageParam } from 'openai/resources/index.js';

interface InsightStats {
  duration: string;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolMessages: number;
  estimatedTokens: number;
  toolCalls: Record<string, number>;
  matchedSkills: string[];
}

/**
 * Rough token estimation: ~4 chars/token for English, ~2 for Chinese.
 */
function estimateTokens(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const otherChars = text.length - cjkChars;
  return Math.ceil(cjkChars / 2 + otherChars / 4);
}

export function generateInsight(
  history: ChatCompletionMessageParam[],
  sessionStartTime: number,
  matchedSkills: string[],
): string {
  const now = Date.now();
  const durationMs = now - sessionStartTime;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  let totalTokens = 0;
  let userCount = 0;
  let assistantCount = 0;
  let toolCount = 0;
  const toolCalls: Record<string, number> = {};

  for (const msg of history) {
    if (msg.role === 'user') {
      userCount++;
      if (typeof msg.content === 'string') totalTokens += estimateTokens(msg.content);
    } else if (msg.role === 'assistant') {
      assistantCount++;
      if (typeof msg.content === 'string') totalTokens += estimateTokens(msg.content);
      // Count tool calls
      const assistantMsg = msg as { tool_calls?: Array<{ function: { name: string } }> };
      if (assistantMsg.tool_calls) {
        for (const tc of assistantMsg.tool_calls) {
          const name = tc.function.name;
          toolCalls[name] = (toolCalls[name] || 0) + 1;
        }
      }
    } else if (msg.role === 'tool') {
      toolCount++;
      if (typeof msg.content === 'string') totalTokens += estimateTokens(msg.content);
    }
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.cyan.bold('📊 Session Insight'));
  lines.push(chalk.dim('─'.repeat(50)));
  lines.push('');
  lines.push(`  ${chalk.dim('Duration:')}     ${minutes}m ${seconds}s`);
  lines.push(`  ${chalk.dim('Messages:')}     ${history.length} total (${userCount} user / ${assistantCount} assistant / ${toolCount} tool)`);
  lines.push(`  ${chalk.dim('Est. Tokens:')}  ~${totalTokens.toLocaleString()}`);
  lines.push('');

  if (Object.keys(toolCalls).length > 0) {
    lines.push(chalk.dim('  Tool Usage:'));
    const sorted = Object.entries(toolCalls).sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sorted) {
      const bar = '█'.repeat(Math.min(count, 20));
      lines.push(`    ${chalk.white(name.padEnd(20))} ${chalk.cyan(bar)} ${count}`);
    }
    lines.push('');
  }

  if (matchedSkills.length > 0) {
    lines.push(chalk.dim('  Matched Skills:'));
    for (const s of matchedSkills) {
      lines.push(`    ${chalk.green('●')} ${s}`);
    }
    lines.push('');
  } else {
    lines.push(chalk.dim('  No skills matched this session.'));
    lines.push('');
  }

  lines.push(chalk.dim('─'.repeat(50)));
  return lines.join('\n');
}
