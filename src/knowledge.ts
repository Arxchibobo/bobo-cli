import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, resolveKnowledgeDir } from './config.js';

export function loadKnowledge(): string {
  const config = loadConfig();
  const knowledgeDir = resolveKnowledgeDir(config);

  // Try user knowledge dir first, then bundled
  const bundledDir = join(import.meta.dirname, '..', 'knowledge');

  const systemPrompt = loadFile(knowledgeDir, 'system.md') || loadFile(bundledDir, 'system.md') || '';
  const rules = loadFile(knowledgeDir, 'rules.md') || loadFile(bundledDir, 'rules.md') || '';

  const parts: string[] = [];
  if (systemPrompt) parts.push(systemPrompt);
  if (rules) parts.push(rules);

  // Also load any custom .md files in knowledge dir
  return parts.join('\n\n---\n\n');
}

function loadFile(dir: string, name: string): string | null {
  const path = join(dir, name);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8').trim();
  }
  return null;
}
