import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config.js';

const MEMORY_FILE = 'memory.md';
const MEMORY_DIR = 'memory';
const LEARNINGS_DIR = '.learnings';
const MAX_MEMORY_SIZE = 5 * 1024; // 5KB

export interface MemoryEntry {
  category: 'user' | 'feedback' | 'project' | 'reference' | 'experience';
  content: string;
  timestamp: string;
}

/**
 * Get paths for memory storage
 */
function getMemoryPaths() {
  const configDir = getConfigDir();
  return {
    memoryFile: join(configDir, MEMORY_FILE),
    memoryDir: join(configDir, MEMORY_DIR),
    learningsDir: join(configDir, LEARNINGS_DIR),
    correctionsFile: join(configDir, LEARNINGS_DIR, 'corrections.md'),
    changelogFile: join(configDir, LEARNINGS_DIR, 'changelog.md'),
  };
}

/**
 * Ensure memory directories exist
 */
function ensureMemoryDirs(): void {
  const paths = getMemoryPaths();
  for (const dir of [paths.memoryDir, paths.learningsDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Load memory.md content for system prompt injection
 */
export function loadMemory(): string | null {
  const { memoryFile } = getMemoryPaths();
  if (!existsSync(memoryFile)) return null;
  const content = readFileSync(memoryFile, 'utf-8').trim();
  return content || null;
}

/**
 * Save a memory entry
 */
export function saveMemory(entry: MemoryEntry): string {
  ensureMemoryDirs();
  const { memoryFile } = getMemoryPaths();

  let content = '';
  if (existsSync(memoryFile)) {
    content = readFileSync(memoryFile, 'utf-8');
  } else {
    content = getMemoryTemplate();
  }

  const sectionMap: Record<string, string> = {
    user: '## 🔒 用户偏好',
    feedback: '## 🔄 纠正记录',
    project: '## 📋 活跃任务',
    reference: '## 📝 业务经验',
    experience: '## 📝 业务经验',
  };

  const section = sectionMap[entry.category] || '## 📝 业务经验';
  const line = `- [${entry.timestamp}] ${entry.content}`;

  // Find the section and append
  const sectionIdx = content.indexOf(section);
  if (sectionIdx !== -1) {
    // Find next section or end
    const nextSectionIdx = content.indexOf('\n## ', sectionIdx + section.length);
    const insertAt = nextSectionIdx !== -1 ? nextSectionIdx : content.length;
    content = content.slice(0, insertAt).trimEnd() + '\n' + line + '\n' + content.slice(insertAt);
  } else {
    // Append section at end
    content = content.trimEnd() + '\n\n' + section + '\n' + line + '\n';
  }

  // Check size and slim if needed
  if (Buffer.byteLength(content, 'utf-8') > MAX_MEMORY_SIZE) {
    content = slimMemory(content);
  }

  writeFileSync(memoryFile, content);

  // Also log to daily file
  logDaily(entry);

  return `Memory saved: [${entry.category}] ${entry.content.slice(0, 50)}...`;
}

/**
 * Search memory for relevant entries
 */
export function searchMemory(query: string): string {
  const { memoryFile, memoryDir } = getMemoryPaths();
  const results: string[] = [];
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(k => k.length > 1);

  // Search main memory
  if (existsSync(memoryFile)) {
    const content = readFileSync(memoryFile, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (keywords.some(kw => lineLower.includes(kw))) {
        // Include surrounding context
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 2);
        results.push(`[memory.md:${i + 1}] ${lines.slice(start, end).join('\n')}`);
      }
    }
  }

  // Search daily logs (last 7 days)
  if (existsSync(memoryDir)) {
    const files = readdirSync(memoryDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .slice(-7);

    for (const file of files) {
      const content = readFileSync(join(memoryDir, file), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase();
        if (keywords.some(kw => lineLower.includes(kw))) {
          results.push(`[${file}:${i + 1}] ${lines[i]}`);
        }
      }
    }
  }

  if (results.length === 0) {
    return `No memory entries found for: "${query}"`;
  }

  return results.slice(0, 10).join('\n\n');
}

/**
 * Log to daily memory file
 */
function logDaily(entry: MemoryEntry): void {
  const { memoryDir } = getMemoryPaths();
  const date = entry.timestamp.split(' ')[0] || new Date().toISOString().split('T')[0];
  const dailyFile = join(memoryDir, `${date}.md`);

  let content = '';
  if (existsSync(dailyFile)) {
    content = readFileSync(dailyFile, 'utf-8');
  } else {
    content = `# ${date} Daily Log\n`;
  }

  content += `\n- [${entry.timestamp}] [${entry.category}] ${entry.content}`;
  writeFileSync(dailyFile, content);
}

/**
 * Slim memory when it exceeds size limit
 */
function slimMemory(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inPermanentSection = false;

  for (const line of lines) {
    // Permanent sections - keep everything
    if (line.includes('🔒') || line.includes('💼')) {
      inPermanentSection = true;
      result.push(line);
      continue;
    }

    // New section starts
    if (line.startsWith('## ')) {
      inPermanentSection = false;
      result.push(line);
      continue;
    }

    if (inPermanentSection) {
      result.push(line);
      continue;
    }

    // For non-permanent sections, keep recent entries (last 10 per section)
    result.push(line);
  }

  return result.join('\n');
}

/**
 * Get the default memory template
 */
function getMemoryTemplate(): string {
  return `# Memory - 大波比

## 🔒 用户偏好（永久保留）

## 💼 角色定位（永久保留）

## 📝 业务经验（长期保留）

## 📋 活跃任务（完成后删）

## 🔄 纠正记录（≤10条）

## 💬 对话摘要（7天后精简）
`;
}
