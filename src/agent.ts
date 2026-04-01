import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionAssistantMessageParam,
} from 'openai/resources/index.js';
import { loadConfig } from './config.js';
import { loadKnowledge } from './knowledge.js';
import { loadMemory } from './memory.js';
import { loadSkillPrompts } from './skills.js';
import { loadProjectKnowledge } from './project.js';
import { toolDefinitions, executeTool } from './tools/index.js';
import { printStreaming, printToolCall, printToolResult, printError, printLine } from './ui.js';

export interface AgentOptions {
  onText?: (text: string) => void;
  signal?: AbortSignal;
}

export async function runAgent(
  userMessage: string,
  history: ChatCompletionMessageParam[],
  options: AgentOptions = {},
): Promise<{ response: string; history: ChatCompletionMessageParam[] }> {
  const config = loadConfig();

  if (!config.apiKey) {
    throw new Error('API key not configured. Run: bobo config set apiKey <your-key>');
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  // Build system prompt with all context layers (order matters)
  const extraParts: string[] = [];

  // Layer 1: Active skills (behavior rules — highest priority after knowledge)
  const skillPrompts = loadSkillPrompts();
  if (skillPrompts) extraParts.push(skillPrompts);

  // Layer 2: Persistent memory (data — lower priority than rules)
  const memory = loadMemory();
  if (memory) extraParts.push(`# 你的记忆\n\n${memory}`);

  // Layer 3: Project context (local project config + auto-detected files)
  const projectKnowledge = loadProjectKnowledge();
  if (projectKnowledge) extraParts.push(`# 项目上下文\n\n${projectKnowledge}`);

  // Layer 4: Environment + context decay warning
  const turnCount = history.filter(m => m.role === 'user').length;
  let envInfo = `# Environment\n\nWorking directory: ${process.cwd()}\nConversation turns: ${turnCount}`;
  if (turnCount >= 10) {
    envInfo += '\n\n⚠️ Context Decay Warning: 对话已超过 10 轮，编辑文件前必须重新读取确认内容。不要信任你对文件的记忆。';
  }
  extraParts.push(envInfo);

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

    try {
      const stream = await client.chat.completions.create({
        model: config.model,
        messages,
        tools: toolDefinitions,
        max_tokens: config.maxTokens,
        stream: true,
      });

      let assistantContent = '';
      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

      for await (const chunk of stream) {
        if (options.signal?.aborted) {
          throw new Error('Aborted');
        }

        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          assistantContent += delta.content;
          fullResponse += delta.content;
          printStreaming(delta.content);
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
        if (assistantContent) printLine();
        break;
      }

      if (assistantContent) printLine();

      for (const tc of toolCalls.values()) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.arguments);
        } catch {
          args = {};
        }

        printToolCall(tc.name, tc.arguments);
        const result = executeTool(tc.name, args);
        printToolResult(result);

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }
    } catch (e) {
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
