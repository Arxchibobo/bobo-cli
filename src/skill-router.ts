/**
 * Skill Router — intelligent content-based skill triggering.
 *
 * Architecture:
 * 1. Each skill declares triggers (keywords, patterns, intents)
 * 2. On every user message, the router scores all skills
 * 3. Top-scoring skills get their prompts injected into context
 * 4. Skills can be: always-on (kernel), triggered, or manual
 *
 * Trigger types:
 * - keywords: exact word matches (fast)
 * - patterns: regex patterns (flexible)
 * - intents: semantic categories (broad)
 * - fileTypes: triggered by file extensions in CWD or message
 *
 * Skill tiers:
 * - kernel: always active (memory, verification, compression)
 * - auto: triggered by content match
 * - manual: only enabled explicitly by user
 */

import { readFileSync, existsSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { getConfigDir } from './config.js';

// ─── Types ───────────────────────────────────────────────────

export interface SkillTrigger {
  /** Exact keyword matches (case-insensitive) */
  keywords?: string[];
  /** Regex patterns to match against user message */
  patterns?: string[];
  /** Semantic intent categories */
  intents?: SkillIntent[];
  /** File extension triggers (e.g. ".ts", ".py") */
  fileTypes?: string[];
  /** Negative keywords — if present, skip this skill */
  excludeKeywords?: string[];
}

export type SkillIntent =
  | 'code-write' | 'code-review' | 'code-debug' | 'code-refactor'
  | 'search' | 'research' | 'analysis'
  | 'image-gen' | 'video-gen' | 'audio-gen'
  | 'web-scrape' | 'web-browse'
  | 'git-pr' | 'git-workflow'
  | 'deploy' | 'ci-cd'
  | 'seo' | 'marketing'
  | 'design' | 'ui-ux'
  | 'data-query' | 'data-viz'
  | 'writing' | 'translation'
  | 'security' | 'audit'
  | 'planning' | 'architecture'
  | 'memory' | 'learning'
  | 'api-call' | 'integration';

export type SkillTier = 'kernel' | 'auto' | 'manual';

export interface SkillRoute {
  name: string;
  description: string;
  tier: SkillTier;
  trigger: SkillTrigger;
  /** Path to SKILL.md or inline prompt */
  promptSource: 'inline' | 'file';
  prompt?: string;
  promptFile?: string;
  /** Max tokens this skill's prompt should consume */
  maxTokens?: number;
  /** Priority (higher = loaded first when budget is tight) */
  priority?: number;
}

interface SkillMatch {
  route: SkillRoute;
  score: number;
  matchedBy: string[];
}

// ─── Intent Detection ────────────────────────────────────────

const INTENT_PATTERNS: Record<SkillIntent, RegExp[]> = {
  'code-write': [/写代码|write code|implement|实现|create.*function|创建.*模块|新增.*功能/i],
  'code-review': [/review|审查|code review|check.*code|看.*代码/i],
  'code-debug': [/debug|调试|bug|error|报错|fix|修复|为什么.*不|doesn't work/i],
  'code-refactor': [/refactor|重构|优化.*代码|clean.*up|整理/i],
  'search': [/搜索|search|找|look.*for|查找|grep/i],
  'research': [/调研|research|了解|分析|investigate|study/i],
  'analysis': [/分析|analyze|statistics|统计|数据/i],
  'image-gen': [/生图|画|image|图片|generate.*image|生成.*图|draw|设计.*图/i],
  'video-gen': [/视频|video|动画|animation|clip|短片/i],
  'audio-gen': [/音频|audio|音乐|music|声音|tts|语音/i],
  'web-scrape': [/爬虫|scrape|crawl|抓取|爬取|抓.*页面/i],
  'web-browse': [/打开.*网页|browse|浏览|open.*url|访问.*网站/i],
  'git-pr': [/pr|pull request|merge request|提PR|合并请求/i],
  'git-workflow': [/branch|分支|commit|push|rebase|cherry.*pick|stash/i],
  'deploy': [/部署|deploy|发布|release|上线/i],
  'ci-cd': [/ci|cd|pipeline|github actions|workflow/i],
  'seo': [/seo|关键词|keyword|排名|ranking|竞品.*词/i],
  'marketing': [/营销|marketing|推广|广告|campaign|选品/i],
  'design': [/设计|design|ui|ux|界面|layout|原型/i],
  'ui-ux': [/组件|component|样式|style|css|tailwind|前端/i],
  'data-query': [/sql|query|数据库|database|查询|mysql|postgres/i],
  'data-viz': [/图表|chart|visualization|可视化|dashboard/i],
  'writing': [/写|write|文章|article|文案|copy|内容/i],
  'translation': [/翻译|translate|中英|英中/i],
  'security': [/安全|security|漏洞|vulnerability|审计|audit/i],
  'audit': [/检查|check|验证|verify|audit|review/i],
  'planning': [/计划|plan|规划|方案|strategy|架构/i],
  'architecture': [/架构|architecture|系统设计|设计模式|pattern/i],
  'memory': [/记住|remember|记忆|memory|recall/i],
  'learning': [/学习|learn|教程|tutorial|解释|explain/i],
  'api-call': [/api|接口|endpoint|request|调用/i],
  'integration': [/集成|integrate|对接|connect|接入/i],
};

function detectIntents(message: string): SkillIntent[] {
  const detected: SkillIntent[] = [];
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.some(p => p.test(message))) {
      detected.push(intent as SkillIntent);
    }
  }
  return detected;
}

// ─── Router Registry ─────────────────────────────────────────

let routeRegistry: SkillRoute[] = [];
let routeIndexBuilt = false;

/**
 * Build the route index from skills directory.
 * Parses SKILL.md files for trigger metadata.
 */
export function buildRouteIndex(): void {
  routeRegistry = [];
  const skillsDir = join(getConfigDir(), 'skills');

  if (!existsSync(skillsDir)) {
    routeIndexBuilt = true;
    return;
  }

  for (const entry of readdirSync(skillsDir)) {
    const fullPath = join(skillsDir, entry);
    try {
      if (!statSync(fullPath).isDirectory()) continue;
    } catch (_) { /* intentionally ignored: unreadable skill file */ continue; }

    const skillFile = join(fullPath, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    const content = readFileSync(skillFile, 'utf-8');
    const route = parseSkillRoute(entry, content, skillFile);
    if (route) routeRegistry.push(route);
  }

  // Sort by priority (higher first)
  routeRegistry.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  routeIndexBuilt = true;
}

/**
 * Parse a SKILL.md into a SkillRoute.
 * Extracts triggers from frontmatter-style comments or content analysis.
 */
function parseSkillRoute(name: string, content: string, filePath: string): SkillRoute | null {
  // Extract description
  let description = '';
  const descMatch = content.match(/^description:\s*(.+)/m)
    || content.match(/^#\s+.+\n+([^#\n][^\n]{10,})/m);
  if (descMatch) description = descMatch[1].trim().slice(0, 150);

  // Extract tier from content
  let tier: SkillTier = 'auto';
  if (/tier:\s*kernel/i.test(content) || /常驻|always.?on|always.?active/i.test(content)) {
    tier = 'kernel';
  } else if (/tier:\s*manual/i.test(content)) {
    tier = 'manual';
  }

  // Extract keywords from content
  const keywords: string[] = [];
  const keywordMatch = content.match(/(?:keywords?|triggers?|触发词|关键词):\s*(.+)/i);
  if (keywordMatch) {
    keywords.push(...keywordMatch[1].split(/[,，、|]/).map(k => k.trim().toLowerCase()).filter(Boolean));
  }

  // Auto-extract keywords from skill name
  const nameWords = name.replace(/[-_]/g, ' ').split(' ').filter(w => w.length > 2);
  keywords.push(...nameWords.map(w => w.toLowerCase()));

  // Extract patterns
  const patterns: string[] = [];
  const patternMatch = content.match(/(?:patterns?|正则):\s*(.+)/i);
  if (patternMatch) {
    patterns.push(...patternMatch[1].split(/[,，]/).map(p => p.trim()).filter(Boolean));
  }

  // Auto-detect intents from description + content
  const intents: SkillIntent[] = [];
  const combinedText = `${name} ${description} ${content.slice(0, 500)}`;
  for (const [intent, pats] of Object.entries(INTENT_PATTERNS)) {
    if (pats.some(p => p.test(combinedText))) {
      intents.push(intent as SkillIntent);
    }
  }

  // Extract file types
  const fileTypes: string[] = [];
  const fileTypeMatch = content.match(/(?:file.?types?|文件类型):\s*(.+)/i);
  if (fileTypeMatch) {
    fileTypes.push(...fileTypeMatch[1].split(/[,，]/).map(t => t.trim()).filter(Boolean));
  }

  // Priority
  let priority = 50; // default
  if (tier === 'kernel') priority = 100;
  const priorityMatch = content.match(/priority:\s*(\d+)/i);
  if (priorityMatch) priority = parseInt(priorityMatch[1], 10);

  return {
    name,
    description,
    tier,
    trigger: {
      keywords: keywords.length > 0 ? keywords : undefined,
      patterns: patterns.length > 0 ? patterns : undefined,
      intents: intents.length > 0 ? intents : undefined,
      fileTypes: fileTypes.length > 0 ? fileTypes : undefined,
    },
    promptSource: 'file',
    promptFile: filePath,
    priority,
  };
}

// ─── Routing Engine ──────────────────────────────────────────

/**
 * Route a user message to matching skills.
 * Returns scored matches, sorted by relevance.
 */
export function routeMessage(
  message: string,
  options?: {
    maxSkills?: number;
    tokenBudget?: number;
    cwdFiles?: string[];
  }
): SkillMatch[] {
  if (!routeIndexBuilt) buildRouteIndex();

  const maxSkills = options?.maxSkills || 5;
  const messageLower = message.toLowerCase();
  const messageIntents = detectIntents(message);

  // Detect file types in CWD
  const cwdExtensions = new Set(
    (options?.cwdFiles || []).map(f => extname(f).toLowerCase())
  );

  const matches: SkillMatch[] = [];

  for (const route of routeRegistry) {
    // Kernel skills always match
    if (route.tier === 'kernel') {
      matches.push({ route, score: 100, matchedBy: ['kernel (always-on)'] });
      continue;
    }

    // Manual skills skip auto-routing
    if (route.tier === 'manual') continue;

    let score = 0;
    const matchedBy: string[] = [];

    // Keyword matching (highest signal)
    if (route.trigger.keywords) {
      for (const kw of route.trigger.keywords) {
        if (messageLower.includes(kw)) {
          score += 30;
          matchedBy.push(`keyword: "${kw}"`);
        }
      }
    }

    // Exclude keywords
    if (route.trigger.excludeKeywords) {
      for (const kw of route.trigger.excludeKeywords) {
        if (messageLower.includes(kw)) {
          score = -100;
          break;
        }
      }
    }

    // Pattern matching
    if (route.trigger.patterns && score >= 0) {
      for (const pat of route.trigger.patterns) {
        try {
          if (new RegExp(pat, 'i').test(message)) {
            score += 25;
            matchedBy.push(`pattern: ${pat}`);
          }
        } catch (_) { /* intentionally ignored: invalid regex pattern */ }
      }
    }

    // Intent matching
    if (route.trigger.intents && score >= 0) {
      for (const intent of route.trigger.intents) {
        if (messageIntents.includes(intent)) {
          score += 20;
          matchedBy.push(`intent: ${intent}`);
        }
      }
    }

    // File type matching
    if (route.trigger.fileTypes && score >= 0) {
      for (const ft of route.trigger.fileTypes) {
        if (cwdExtensions.has(ft)) {
          score += 10;
          matchedBy.push(`fileType: ${ft}`);
        }
      }
    }

    if (score > 0) {
      // Apply priority as a tiebreaker
      score += (route.priority || 0) / 100;
      matches.push({ route, score, matchedBy });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, maxSkills);
}

/**
 * Load matched skill prompts within a token budget.
 * Returns the combined prompt string.
 */
export function loadMatchedSkillPrompts(
  matches: SkillMatch[],
  tokenBudget: number = 8000
): { prompt: string; loaded: string[]; skipped: string[] } {
  const loaded: string[] = [];
  const skipped: string[] = [];
  const parts: string[] = [];
  let usedTokens = 0;

  for (const match of matches) {
    const { route } = match;
    let content = '';

    if (route.promptSource === 'inline' && route.prompt) {
      content = route.prompt;
    } else if (route.promptSource === 'file' && route.promptFile && existsSync(route.promptFile)) {
      content = readFileSync(route.promptFile, 'utf-8');
    }

    if (!content) {
      skipped.push(route.name);
      continue;
    }

    // Estimate tokens (~4 chars/token English, ~2 chars/token Chinese)
    const estimatedTokens = Math.ceil(content.length / 3);

    if (usedTokens + estimatedTokens > tokenBudget && loaded.length > 0) {
      // Budget exceeded — truncate or skip
      if (route.tier === 'kernel') {
        // Kernel skills always loaded, even over budget
        const truncated = content.slice(0, tokenBudget * 2);
        parts.push(`## Skill: ${route.name}\n\n${truncated}`);
        loaded.push(route.name);
        usedTokens += Math.ceil(truncated.length / 3);
      } else {
        skipped.push(route.name);
      }
      continue;
    }

    parts.push(`## Skill: ${route.name}\n\n${content}`);
    loaded.push(route.name);
    usedTokens += estimatedTokens;
  }

  const prompt = parts.length > 0
    ? `\n\n---\n\n# Active Skills (${loaded.length} loaded)\n\n${parts.join('\n\n---\n\n')}`
    : '';

  return { prompt, loaded, skipped };
}

/**
 * Get router stats for debugging.
 */
export function getRouterStats(): {
  totalSkills: number;
  kernel: number;
  auto: number;
  manual: number;
  intents: number;
} {
  if (!routeIndexBuilt) buildRouteIndex();

  return {
    totalSkills: routeRegistry.length,
    kernel: routeRegistry.filter(r => r.tier === 'kernel').length,
    auto: routeRegistry.filter(r => r.tier === 'auto').length,
    manual: routeRegistry.filter(r => r.tier === 'manual').length,
    intents: Object.keys(INTENT_PATTERNS).length,
  };
}

/**
 * Export the full registry for debugging.
 */
export function getRouteRegistry(): SkillRoute[] {
  if (!routeIndexBuilt) buildRouteIndex();
  return [...routeRegistry];
}

/**
 * Generate a routing report for a message (for debugging).
 */
export function debugRoute(message: string): string {
  const matches = routeMessage(message);
  const intents = detectIntents(message);

  const lines: string[] = [
    `Message: "${message.slice(0, 100)}"`,
    `Detected intents: ${intents.join(', ') || '(none)'}`,
    `Matches (${matches.length}):`,
  ];

  for (const m of matches) {
    lines.push(`  ${m.route.name} (score: ${m.score.toFixed(1)}, tier: ${m.route.tier})`);
    lines.push(`    matched by: ${m.matchedBy.join(', ')}`);
  }

  if (matches.length === 0) {
    lines.push('  (no skills matched)');
  }

  return lines.join('\n');
}
