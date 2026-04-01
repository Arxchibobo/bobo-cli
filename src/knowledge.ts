import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, resolveKnowledgeDir } from './config.js';

// Files that are always loaded into system prompt
const ALWAYS_LOAD = ['system.md', 'rules.md', 'agent-directives.md'];

// Files loaded on-demand based on task context
const ON_DEMAND = ['engineering.md', 'error-catalog.md', 'verification.md', 'task-router.md', 'dream.md', 'advanced-patterns.md'];

// Keywords that trigger on-demand loading
const TRIGGER_MAP: Record<string, string[]> = {
  'engineering.md': ['规划', '计划', '任务', '步骤', '复杂', 'plan', 'task', 'debug', '搜索', 'search'],
  'error-catalog.md': ['错误', 'error', 'bug', '调试', 'debug', '报错', 'fail', '修复', 'fix'],
  'verification.md': ['测试', 'test', '验证', 'verify', '检查', 'check', '确认'],
  'task-router.md': ['路由', 'route', '分类', '策略', 'strategy', '怎么做', '哪种', '方案'],
  'dream.md': ['记忆', 'memory', '整理', 'dream', '回顾', '瘦身', 'compact'],
  'advanced-patterns.md': ['架构', 'architecture', '子代理', 'agent', '并行', 'parallel', 'compact', '压缩', '记忆类型', 'coordinator', '分工', '委派', 'delegate'], // Only loaded programmatically
};

export interface KnowledgeOptions {
  /** User message to analyze for on-demand loading */
  userMessage?: string;
  /** Force load all knowledge files */
  loadAll?: boolean;
  /** Additional context (e.g., memory) to append */
  extraContext?: string;
}

export function loadKnowledge(options: KnowledgeOptions = {}): string {
  const config = loadConfig();
  const knowledgeDir = resolveKnowledgeDir(config);
  const bundledDir = join(import.meta.dirname, '..', 'knowledge');

  const parts: string[] = [];

  // Always load core files
  for (const file of ALWAYS_LOAD) {
    const content = loadFile(knowledgeDir, file) || loadFile(bundledDir, file);
    if (content) parts.push(content);
  }

  // On-demand loading based on user message or loadAll flag
  if (options.loadAll) {
    for (const file of ON_DEMAND) {
      const content = loadFile(knowledgeDir, file) || loadFile(bundledDir, file);
      if (content) parts.push(content);
    }
  } else if (options.userMessage) {
    const msg = options.userMessage.toLowerCase();
    for (const [file, keywords] of Object.entries(TRIGGER_MAP)) {
      if (keywords.length > 0 && keywords.some(kw => msg.includes(kw))) {
        const content = loadFile(knowledgeDir, file) || loadFile(bundledDir, file);
        if (content) parts.push(content);
      }
    }
  }

  // Load any custom files from user knowledge dir (not in our known list)
  const knownFiles = new Set([...ALWAYS_LOAD, ...ON_DEMAND]);
  loadCustomFiles(knowledgeDir, knownFiles, parts);

  // Append extra context (memory, project config, etc.)
  if (options.extraContext) {
    parts.push(options.extraContext);
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Load all .md files from a directory that aren't in the known set
 */
function loadCustomFiles(dir: string, knownFiles: Set<string>, parts: string[]): void {
  if (!existsSync(dir)) return;
  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.md') && !knownFiles.has(f));
    for (const file of files.sort()) {
      const content = loadFile(dir, file);
      if (content) parts.push(content);
    }
  } catch {
    // ignore read errors
  }
}

/**
 * Get a list of all available knowledge files (for debugging/info)
 */
export function listKnowledgeFiles(): { file: string; type: 'always' | 'on-demand' | 'custom'; source: 'user' | 'bundled' }[] {
  const config = loadConfig();
  const knowledgeDir = resolveKnowledgeDir(config);
  const bundledDir = join(import.meta.dirname, '..', 'knowledge');
  const knownFiles = new Set([...ALWAYS_LOAD, ...ON_DEMAND]);

  const result: { file: string; type: 'always' | 'on-demand' | 'custom'; source: 'user' | 'bundled' }[] = [];

  for (const file of ALWAYS_LOAD) {
    const source = existsSync(join(knowledgeDir, file)) ? 'user' as const : 'bundled' as const;
    result.push({ file, type: 'always', source });
  }

  for (const file of ON_DEMAND) {
    const inUser = existsSync(join(knowledgeDir, file));
    const inBundled = existsSync(join(bundledDir, file));
    if (inUser || inBundled) {
      result.push({ file, type: 'on-demand', source: inUser ? 'user' : 'bundled' });
    }
  }

  // Custom files
  if (existsSync(knowledgeDir)) {
    try {
      const files = readdirSync(knowledgeDir).filter(f => f.endsWith('.md') && !knownFiles.has(f));
      for (const file of files) {
        result.push({ file, type: 'custom', source: 'user' });
      }
    } catch { /* ignore */ }
  }

  return result;
}

function loadFile(dir: string, name: string): string | null {
  const path = join(dir, name);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8').trim();
  }
  return null;
}
