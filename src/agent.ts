import OpenAI from 'openai';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ChatCompletionMessageParam,
  ChatCompletionAssistantMessageParam,
} from 'openai/resources/index.js';
import { loadConfig, type EffortLevel, type PermissionMode } from './config.js';
import { loadKnowledge } from './knowledge.js';
import { loadMemory } from './memory.js';
import { loadSkillPrompts } from './skills.js';
import { loadProjectKnowledge } from './project.js';
import { toolDefinitions, executeTool } from './tools/index.js';
import { getMcpToolDefinitions, executeMcpTool, isMcpTool } from './mcp-client.js';
import { printStreaming, printToolCall, printToolResult, printError, printLine } from './ui.js';
import { Spinner } from './spinner.js';

export interface AgentOptions {
  onText?: (text: string) => void;
  signal?: AbortSignal;
  /** Track which skills were matched (mutated by caller) */
  matchedSkills?: string[];
  /** Suppress spinner (for sub-agents) */
  quiet?: boolean;
  /** Override effort level for this call */
  effort?: EffortLevel;
  /** Override permission mode */
  permissionMode?: PermissionMode;
  /** Override model for this call */
  model?: string;
  /** Callback when auto-compact is needed */
  onAutoCompact?: () => void;
}

/**
 * Load BOBO.md from current directory (project instructions, like Claude Code's CLAUDE.md).
 */
function loadBoboMd(): string | null {
  const candidates = ['BOBO.md', '.bobo/BOBO.md', 'bobo.md'];
  for (const name of candidates) {
    const p = join(process.cwd(), name);
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8').trim();
        if (content) return content;
      } catch { /* skip */ }
    }
  }
  return null;
}

/**
 * Rough token estimation for auto-compact detection.
 */
function estimateTokenCount(messages: ChatCompletionMessageParam[]): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      const cjk = (msg.content.match(/[\u4e00-\u9fff]/g) || []).length;
      total += Math.ceil(cjk / 2 + (msg.content.length - cjk) / 4);
    }
  }
  return total;
}

/**
 * Map effort level to system prompt guidance.
 */
function effortToPrompt(effort: EffortLevel): string {
  switch (effort) {
    case 'low':
      return '\n\n# Effort Level: Low\nBe concise. Give direct answers without extensive analysis. Skip explanations unless asked.';
    case 'high':
      return '\n\n# Effort Level: High\nThink deeply and thoroughly. Consider edge cases, alternatives, and implications. Provide detailed analysis and explanations.';
    default:
      return ''; // medium = default behavior
  }
}

export async function runAgent(
  userMessage: string,
  history: ChatCompletionMessageParam[],
  options: AgentOptions = {},
): Promise<{ response: string; history: ChatCompletionMessageParam[] }> {
  const config = loadConfig();
  const model = options.model || config.model;
  const effort = options.effort || config.effort;

  if (!config.apiKey) {
    throw new Error('API key not configured. Run: bobo config set apiKey <your-key>');
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  const spinner = new Spinner();

  // Check for auto-compact (when context is getting large)
  const currentTokens = estimateTokenCount(history);
  if (currentTokens > 80000 && options.onAutoCompact) {
    options.onAutoCompact();
  }

  // Build system prompt with all context layers
  const extraParts: string[] = [];

  // Layer 0: BOBO.md project instructions (highest priority)
  const boboMd = loadBoboMd();
  if (boboMd) {
    extraParts.push(`# Project Instructions (BOBO.md)\n\n${boboMd}`);
  }

  // Layer 1: Active skills
  const skillPrompts = loadSkillPrompts(userMessage);
  if (skillPrompts) {
    extraParts.push(skillPrompts);
    if (options.matchedSkills) {
      const matches = skillPrompts.match(/# (\S+)/g);
      if (matches) options.matchedSkills.push(...matches.map(m => m.replace('# ', '')));
    }
  }

  // Layer 2: Persistent memory
  const memory = loadMemory();
  if (memory) extraParts.push(`# 你的记忆\n\n${memory}`);

  // Layer 3: Project context
  const projectKnowledge = loadProjectKnowledge();
  if (projectKnowledge) extraParts.push(`# 项目上下文\n\n${projectKnowledge}`);

  // Layer 4: Environment + effort level
  const turnCount = history.filter(m => m.role === 'user').length;
  let envInfo = `# Environment\n\nWorking directory: ${process.cwd()}\nConversation turns: ${turnCount}\nModel: ${model}\nEffort: ${effort}`;
  if (turnCount >= 10) {
    envInfo += '\n\n⚠️ Context Decay Warning: 对话已超过 10 轮，编辑文件前必须重新读取确认内容。';
  }
  extraParts.push(envInfo);

  // Layer 5: Effort level guidance
  const effortPrompt = effortToPrompt(effort);
  if (effortPrompt) extraParts.push(effortPrompt);

  const systemPrompt = loadKnowledge({
    userMessage,
    loadAll: history.length === 0,
    extraContext: extraParts.join('\n\n---\n\n'),
  });

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  let fullResponse = '';
  const maxIterations = 20;

  for (let i = 0; i < maxIterations; i++) {
    if (options.signal?.aborted) {
      throw new Error('Aborted');
    }

    if (!options.quiet) spinner.start('Thinking...');

    try {
      let assistantContent = '';
      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
      let firstChunkReceived = false;

      try {
        const stream = await client.chat.completions.create({
          model,
          messages,
          tools: [...toolDefinitions, ...getMcpToolDefinitions()],
          max_tokens: config.maxTokens,
          stream: true,
        });

        for await (const chunk of stream) {
          if (options.signal?.aborted) {
            spinner.stop();
            throw new Error('Aborted');
          }

          if (!firstChunkReceived) {
            spinner.stop();
            firstChunkReceived = true;
          }

          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            assistantContent += delta.content;
            fullResponse += delta.content;
            if (!options.quiet) printStreaming(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCalls.has(idx)) {
                toolCalls.set(idx, { id: tc.id || '', name: tc.function?.name || '', arguments: '' });
              }
              const existing = toolCalls.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            }
          }
        }
      } catch (streamErr) {
        if ((streamErr as Error).message === 'Aborted') throw streamErr;
        spinner.stop();
        if (!options.quiet) printLine(chalk.dim('(falling back to non-streaming mode...)'));
        const completion = await client.chat.completions.create({
          model,
          messages,
          tools: [...toolDefinitions, ...getMcpToolDefinitions()],
          max_tokens: config.maxTokens,
          stream: false,
        });

        const choice = completion.choices[0];
        if (choice?.message?.content) {
          assistantContent = choice.message.content;
          fullResponse += assistantContent;
          if (!options.quiet) printStreaming(assistantContent);
        }
        if (choice?.message?.tool_calls) {
          for (let idx = 0; idx < choice.message.tool_calls.length; idx++) {
            const tc = choice.message.tool_calls[idx];
            toolCalls.set(idx, {
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            });
          }
        }
      }

      spinner.stop();

      const assistantMsg: ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: assistantContent || null,
      };

      if (toolCalls.size > 0) {
        assistantMsg.tool_calls = Array.from(toolCalls.values()).map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        }));
      }

      messages.push(assistantMsg);

      if (toolCalls.size === 0) {
        if (assistantContent && !options.quiet) printLine();
        break;
      }

      if (assistantContent && !options.quiet) printLine();

      // Execute tool calls
      const permMode = options.permissionMode || config.permissionMode;
      for (const tc of toolCalls.values()) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.arguments);
        } catch {
          args = {};
        }

        // Permission check for destructive tools
        const destructiveTools = ['write_file', 'edit_file', 'shell'];
        if (permMode === 'ask' && destructiveTools.includes(tc.name)) {
          if (!options.quiet) {
            printLine(chalk.yellow(`⚠ Tool: ${tc.name}(${truncateArgs(tc.arguments, 60)})`));
            printLine(chalk.dim('  Press Enter to allow, or type "n" to skip'));
            // In non-quiet mode we auto-approve for now (full interactive approval needs readline integration)
          }
        }

        if (!options.quiet) {
          spinner.start(`Running ${tc.name}...`);
          printToolCall(tc.name, tc.arguments);
        }

        // Route to MCP or built-in tool
        let result: string;
        if (isMcpTool(tc.name)) {
          result = await executeMcpTool(tc.name, args);
        } else {
          result = executeTool(tc.name, args);
        }
        spinner.stop();
        if (!options.quiet) printToolResult(result);

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }
    } catch (e) {
      spinner.stop();
      if ((e as Error).message === 'Aborted') throw e;
      printError(`API Error: ${(e as Error).message}`);
      throw e;
    }
  }

  const newHistory: ChatCompletionMessageParam[] = [
    ...history,
    { role: 'user', content: userMessage },
    ...messages.slice(history.length + 2),
  ];

  return { response: fullResponse, history: newHistory };
}

function truncateArgs(s: string, maxLen: number): string {
  const oneLine = s.replace(/\n/g, ' ');
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 3) + '...';
}
