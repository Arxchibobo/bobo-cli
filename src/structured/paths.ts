import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function getStructuredKnowledgePath(): string {
  const bundled = join(import.meta.dirname, '..', 'knowledge');
  if (existsSync(join(bundled, 'index.json'))) {
    return bundled;
  }
  return join(process.cwd(), 'knowledge');
}

export function getStructuredConfigDir(): string {
  return join(homedir(), '.bobo');
}
