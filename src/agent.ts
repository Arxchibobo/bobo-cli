import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionAssistantMessageParam,
} from 'openai/resources/index.js';
import { loadConfig } from './config.js';
import { loadKnowledge } from './knowledge.js';
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

  const systemPrompt = loadKnowledge();

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  let fullResponse = '';
  const maxIterations = 20; // safety limit for tool calling loops

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

        // Handle text content
        if (delta.content) {
          assistantContent += delta.content;
          fullResponse += delta.content;
          printStreaming(delta.content);
        }

        // Handle tool calls
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

      // Build assistant message
      const assistantMsg: ChatCompletionAssistantMessageParam = { role: 'assistant', content: assistantContent || null };

      if (toolCalls.size > 0) {
        assistantMsg.tool_calls = Array.from(toolCalls.values()).map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        }));
      }

      messages.push(assistantMsg);

      // If no tool calls, we're done
      if (toolCalls.size === 0) {
        if (assistantContent) printLine(); // newline after streaming
        break;
      }

      // Execute tool calls
      if (assistantContent) printLine(); // newline before tool output

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

      // Continue the loop to let the model process tool results

    } catch (e) {
      if ((e as Error).message === 'Aborted') throw e;
      printError(`API Error: ${(e as Error).message}`);
      throw e;
    }
  }

  // Update history (without system message)
  const newHistory: ChatCompletionMessageParam[] = [
    ...history,
    { role: 'user', content: userMessage },
    ...messages.slice(history.length + 2), // skip system + old history + new user msg
  ];

  return { response: fullResponse, history: newHistory };
}
