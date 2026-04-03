/**
 * Skill Loader — 多层加载 + 三段分类
 * 
 * 优先级: project > user > builtin
 * 后加载覆盖先加载（同名 skill）
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { StructuredSkill, SkillCategory } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * 从目录加载 skills
 */
function loadSkillsFromDir(dir: string, source: 'builtin' | 'user' | 'project'): StructuredSkill[] {
  if (!existsSync(dir)) return [];

  const skills: StructuredSkill[] = [];

  for (const category of ['execution', 'enhancement', 'guarantee'] as SkillCategory[]) {
    const categoryDir = join(dir, category);
    if (!existsSync(categoryDir)) continue;

    for (const entry of readdirSync(categoryDir)) {
      const fullPath = join(categoryDir, entry);
      try {
        if (!statSync(fullPath).isDirectory() && !entry.endsWith('.md')) continue;
      } catch { continue; }

      // Support both directory-with-SKILL.md and plain .md file
      let content: string;
      let name: string;

      if (entry.endsWith('.md')) {
        content = readFileSync(fullPath, 'utf-8');
        name = entry.replace(/\.md$/, '');
      } else {
        const skillFile = join(fullPath, 'SKILL.md');
        if (!existsSync(skillFile)) continue;
        content = readFileSync(skillFile, 'utf-8');
        name = entry;
      }

      const description = extractDescription(content);
      const triggers = extractTriggers(content);

      skills.push({
        name,
        category,
        description,
        enabled: true,
        source,
        triggers,
        prompt: content,
      });
    }
  }

  // Also load flat skills (no category subdirectory)
  for (const entry of readdirSync(dir)) {
    if (['execution', 'enhancement', 'guarantee'].includes(entry)) continue;

    const fullPath = join(dir, entry);
    try {
      if (!statSync(fullPath).isDirectory()) continue;
    } catch { continue; }

    const skillFile = join(fullPath, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    const content = readFileSync(skillFile, 'utf-8');
    const category = inferCategory(content, entry);
    const description = extractDescription(content);
    const triggers = extractTriggers(content);

    skills.push({
      name: entry,
      category,
      description,
      enabled: true,
      source,
      triggers,
      prompt: content,
    });
  }

  return skills;
}

/**
 * 推断 skill 分类
 */
function inferCategory(content: string, name: string): SkillCategory {
  const lower = content.toLowerCase() + ' ' + name.toLowerCase();
  if (lower.includes('verification') || lower.includes('guarantee') || lower.includes('persist') || lower.includes('loop')) {
    return 'guarantee';
  }
  if (lower.includes('enhance') || lower.includes('parallel') || lower.includes('advanced') || lower.includes('git-')) {
    return 'enhancement';
  }
  return 'execution';
}

/**
 * 从 SKILL.md 提取描述
 */
function extractDescription(content: string): string {
  const fmMatch = content.match(/^description:\s*(.+)/m);
  if (fmMatch) return fmMatch[1].trim().replace(/^["']|["']$/g, '').slice(0, 120);

  const h1Match = content.match(/^#\s+.+\n+([^#\n][^\n]{10,})/m);
  if (h1Match) return h1Match[1].trim().slice(0, 120);

  return 'Skill';
}

/**
 * 从 SKILL.md 提取触发词
 */
function extractTriggers(content: string): string[] {
  const triggerMatch = content.match(/triggers?:\s*\[([^\]]+)\]/i);
  if (triggerMatch) {
    return triggerMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
  }
  return [];
}

/**
 * 加载所有层级 skill，按优先级合并
 * project > user > builtin
 */
export function loadAllSkills(): StructuredSkill[] {
  const builtinDir = join(__dirname, '..', '..', 'bundled-skills');
  const userDir = join(homedir(), '.bobo', 'skills');
  const projectDir = join(process.cwd(), '.bobo', 'skills');

  const builtin = loadSkillsFromDir(builtinDir, 'builtin');
  const user = loadSkillsFromDir(userDir, 'user');
  const project = loadSkillsFromDir(projectDir, 'project');

  return mergeSkills([builtin, user, project]);
}

/**
 * 合并多层 skill，后层覆盖前层
 */
function mergeSkills(layers: StructuredSkill[][]): StructuredSkill[] {
  const map = new Map<string, StructuredSkill>();
  for (const layer of layers) {
    for (const skill of layer) {
      map.set(skill.name, skill);
    }
  }
  return Array.from(map.values());
}
