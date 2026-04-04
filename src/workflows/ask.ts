import { writeAsk } from '../state/artifacts.js';
import { getPreset } from '../providers.js';
import OpenAI from 'openai';
import { loadConfig } from '../config.js';

export interface AskResult {
  model: string;
  path: string;
  content: string;
  response?: string;
  error?: string;
}

/**
 * Real ask workflow using provider infrastructure
 *
 * Makes an actual API call to the specified provider/model
 */
export async function runAskWorkflow(model: string, prompt: string): Promise<AskResult> {
  const config = loadConfig();
  let response: string | undefined;
  let error: string | undefined;

  try {
    // Check if model is a provider preset name (e.g., "anthropic", "openai")
    const preset = getPreset(model);

    let client: OpenAI;
    let actualModel: string;

    if (preset) {
      // Using a provider preset
      const apiKey = preset.envKey ? process.env[preset.envKey] : config.apiKey;
      if (!apiKey) {
        throw new Error(`API key not found. Set ${preset.envKey || 'API key'} via environment or config.`);
      }

      client = new OpenAI({
        apiKey,
        baseURL: preset.baseUrl,
      });
      actualModel = preset.defaultModel;
    } else {
      // Assume model is a specific model name, use current configured provider
      if (!config.apiKey) {
        throw new Error('API key not configured. Run: bobo config set apiKey <your-key>');
      }

      client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
      actualModel = model;
    }

    // Make the API call
    const completion = await client.chat.completions.create({
      model: actualModel,
      messages: [
        { role: 'user', content: prompt },
      ],
      max_tokens: 16384,
    });

    response = completion.choices[0]?.message?.content || '(no response)';
  } catch (e) {
    error = (e as Error).message;
  }

  // Build content
  let content: string;

  if (error) {
    content = `# Ask\n\n## Model\n${model}\n\n## Prompt\n${prompt}\n\n## Error\n${error}\n\n## Limitation\nAPI call failed. Check your API key and model availability.\n`;
  } else {
    content = `# Ask\n\n## Model\n${model}\n\n## Prompt\n${prompt}\n\n## Response\n\n${response}\n`;
  }

  const path = writeAsk(model, content);
  return { model, path, content, response, error };
}
