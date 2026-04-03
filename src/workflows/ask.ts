import { writeAsk } from '../state/artifacts.js';

export interface AskResult {
  model: string;
  path: string;
  content: string;
}

export async function runAskWorkflow(model: string, prompt: string): Promise<AskResult> {
  const content = `# Ask\n\n## Model\n${model}\n\n## Prompt\n${prompt}\n\n## Status\nScaffold only — external model execution wiring comes next.\n`;
  const path = writeAsk(model, content);
  return { model, path, content };
}
