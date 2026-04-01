import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

export interface Config {
  apiKey: string;
  model: string;
  baseUrl: string;
  knowledgeDir: string;
  maxTokens: number;
}

const CONFIG_DIR = join(homedir(), '.bobo');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: Config = {
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  baseUrl: 'https://api.anthropic.com/v1',
  knowledgeDir: join(CONFIG_DIR, 'knowledge'),
  maxTokens: 4096,
};

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export function getConfigValue(key: string): string | number | undefined {
  const config = loadConfig();
  return (config as unknown as Record<string, string | number>)[key];
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig();
  if (!(key in DEFAULT_CONFIG)) {
    throw new Error(`Unknown config key: ${key}. Valid keys: ${Object.keys(DEFAULT_CONFIG).join(', ')}`);
  }
  const rec = config as unknown as Record<string, string | number>;
  if (key === 'maxTokens') {
    rec[key] = parseInt(value, 10);
  } else {
    rec[key] = value;
  }
  saveConfig(config);
}

export function listConfig(): Record<string, string | number> {
  const config = loadConfig();
  const result: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(config)) {
    if (k === 'apiKey' && typeof v === 'string' && v.length > 8) {
      result[k] = v.slice(0, 4) + '...' + v.slice(-4);
    } else {
      result[k] = v as string | number;
    }
  }
  return result;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function resolveKnowledgeDir(config: Config): string {
  const dir = config.knowledgeDir;
  if (dir.startsWith('~')) {
    return join(homedir(), dir.slice(1));
  }
  return resolve(dir);
}
