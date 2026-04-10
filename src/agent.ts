import OpenAI from 'openai';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ChatCompletionMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
} from 'openai/resources/index.js';
import { loadConfig, type EffortLevel, type PermissionMode } from './config.js';
import { loadKnowledge } from './knowledge.js';
import { loadMemory } from './memory.js';
import { routeMessage, loadMatchedSkillPrompts, buildRouteIndex } from './skill-router.js';
import { loadProjectKnowledge } from './project.js';
import { isClaudeCodeAvailable } from './tools/claude-code.js';
import { toolDefinitions, executeTool } from './tools/index.js';
import { isAdvancedTool, executeAdvancedTool } from './tools/advanced.js';
import { isBrowserTool, executeBrowserTool } from './tools/browser.js';
import { getMcpToolDefinitions, executeMcpTool, isMcpTool } from './mcp-client.js';
import { printStreaming, printToolCall, printToolResult, printError, printLine } from './ui.js';
import { recordUsage, getStats } from './cost-tracker.js';
import { Spinner } from './spinner.js';
import { estimateTokens } from './compactor.js';
import { executeToolWithGovernance, getToolMetadata } from './tool-governance.js';

// ─── OpenAI Client Cache ─────────────────────────────────────
let cachedClient: OpenAI | null = null;
let cachedClientKey = '';

function getClient(apiKey: string, baseUrl: string): OpenAI {
  const key = `${apiKey}:${baseUrl}`;
  if (cachedClient && cachedClientKey === key) return cachedClient;
  cachedClient = new OpenAI({ apiKey, baseURL: baseUrl });
  cachedClientKey = key;
  return cachedClient;
}

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
  /** Image attachments for multimodal input */
  images?: Array<{ base64: string; mediaType: string }>;
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
      } catch (_) { /* intentionally ignored: BOBO.md is optional */ }
    }
  }
  return null;
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

  const client = getClient(config.apiKey, config.baseUrl);

  const callStartTime = Date.now();
  const spinner = new Spinner();

  // Check for auto-compact (when context is getting large)
  const currentTokens = estimateTokens(history);
  if (currentTokens > 80000 && options.onAutoCompact) {
    options.onAutoCompact();
  }

  // Build system prompt with STATIC/DYNAMIC separation for cache optimization
  const staticParts: string[] = [];  // Cacheable: identity, rules, base knowledge
  const dynamicParts: string[] = []; // Non-cacheable: session state, memory, context

  // === STATIC SECTION (Cacheable) ===

  // Load base knowledge (identity + rules)
  const baseKnowledge = loadKnowledge({
    userMessage,
    loadAll: history.length === 0,
    extraContext: '', // No dynamic context yet
  });
  staticParts.push(baseKnowledge);

  // Layer 0: BOBO.md project instructions (static per project)
  const boboMd = loadBoboMd();
  if (boboMd) {
    staticParts.push(`# Project Instructions (BOBO.md)\n\n${boboMd}`);
  }

  // Layer 1: Skill routing (varies per message, but definitions are static)
  const skillMatches = routeMessage(userMessage);
  const { prompt: routedSkillPrompts, loaded: loadedSkills } = loadMatchedSkillPrompts(skillMatches);
  if (routedSkillPrompts) {
    staticParts.push(routedSkillPrompts);
    if (options.matchedSkills) {
      options.matchedSkills.push(...loadedSkills);
    }
  }

  // === DYNAMIC BOUNDARY MARKER ===
  const dynamicBoundary = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '⚡ DYNAMIC CONTEXT BOUNDARY — Content below changes frequently\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  // === DYNAMIC SECTION (Non-cacheable) ===

  // Layer 2: Persistent memory (changes with learning)
  const memory = loadMemory();
  if (memory) dynamicParts.push(`# 你的记忆\n\n${memory}`);

  // Layer 3: Project context (can change as project evolves)
  const projectKnowledge = loadProjectKnowledge();
  if (projectKnowledge) dynamicParts.push(`# 项目上下文\n\n${projectKnowledge}`);

  // Layer 4: Environment + session state
  const turnCount = history.filter(m => m.role === 'user').length;
  let envInfo = `# Environment\n\nWorking directory: ${process.cwd()}\nConversation turns: ${turnCount}\nModel: ${model}\nEffort: ${effort}`;
  if (isClaudeCodeAvailable()) {
    envInfo += '\n\nClaude Code: ✅ available — use claude_code tool for heavy refactors, multi-file changes, test suites, or autonomous long tasks. Keep simple edits in your own tools.';
  }
  if (turnCount >= 10) {
    envInfo += '\n\n⚠️ Context Decay Warning: 对话已超过 10 轮，编辑文件前必须重新读取确认内容。';
  }
  dynamicParts.push(envInfo);

  // Layer 5: Effort level guidance (changes with effort setting)
  const effortPrompt = effortToPrompt(effort);
  if (effortPrompt) dynamicParts.push(effortPrompt);

  // Combine static and dynamic sections
  const systemPrompt = [
    ...staticParts,
    dynamicBoundary,
    ...dynamicParts,
  ].join('\n\n---\n\n');

  // Build user message content (text-only or multimodal)
  const userContent: string | ChatCompletionContentPart[] = options.images?.length
    ? [
        ...options.images.map(img => ({
          type: 'image_url' as const,
          image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
        })),
        { type: 'text' as const, text: userMessage },
      ]
    : userMessage;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userContent },
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
          stream_options: { include_usage: true },
        });

        let streamUsage: { prompt_tokens?: number; completion_tokens?: number } | null = null;

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

          // Capture usage from final streaming chunk
          if (chunk.usage) {
            streamUsage = chunk.usage;
          }
        }

        // Record streaming usage after loop ends
        if (streamUsage) {
          recordUsage(
            streamUsage.prompt_tokens || 0,
            streamUsage.completion_tokens || 0,
            toolCalls.size
          );
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
        // Record usage
        if (completion.usage) {
          recordUsage(
            completion.usage.prompt_tokens || 0,
            completion.usage.completion_tokens || 0,
            choice?.message?.tool_calls?.length || 0
          );
        }
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
        } catch (_) {
          /* intentionally ignored: malformed JSON defaults to empty args */
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

        // Route to MCP, advanced, browser, or built-in tool
        // MCP and browser tools bypass governance (they have own security)
        let result: string;
        if (isMcpTool(tc.name)) {
          result = await executeMcpTool(tc.name, args);
          spinner.stop();
          if (!options.quiet) printToolResult(result);
        } else if (isBrowserTool(tc.name)) {
          result = await executeBrowserTool(tc.name, args);
          spinner.stop();
          if (!options.quiet) printToolResult(result);
        } else {
          // Built-in and advanced tools go through governance pipeline
          const govResult = await executeToolWithGovernance(
            tc.name,
            args,
            async (name, params) => {
              if (isAdvancedTool(name)) {
                return await executeAdvancedTool(name, params);
              } else {
                return executeTool(name, params);
              }
            }
          );
          spinner.stop();

          if (govResult.blocked) {
            result = `⛔ Tool blocked: ${govResult.blockReason || govResult.error}`;
          } else if (!govResult.success) {
            result = `❌ Tool failed: ${govResult.error}`;
          } else {
            result = govResult.output || '';
          }
          if (!options.quiet) printToolResult(result);
        }

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

  // Ring terminal bell if response took >5s (notify user)
  if (Date.now() - callStartTime > 5000 && !options.quiet) {
    process.stderr.write('\x07'); // BEL character
  }

  return { response: fullResponse, history: newHistory };
}

function truncateArgs(s: string, maxLen: number): string {
  const oneLine = s.replace(/\n/g, ' ');
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 3) + '...';
}
