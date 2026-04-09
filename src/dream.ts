/**
 * KAIROS Dream Mode — Memory consolidation and insight extraction
 *
 * Inspired by biological memory consolidation during sleep, this module
 * processes accumulated experiences and distills them into structured knowledge.
 *
 * Features:
 * - /dream command to manually trigger consolidation
 * - Auto-trigger on session-end if sufficient new experiences
 * - LLM-powered distillation of logs → structured preferences & learnings
 * - Deduplication and organization of memory entries
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import OpenAI from 'openai';
import { loadConfig } from './config.js';
import { getMemoryDir } from './memory.js';

export interface DreamResult {
  insights: DreamInsight[];
  preferencesUpdated: number;
  duplicatesRemoved: number;
  summary: string;
}

export interface DreamInsight {
  category: 'user-preference' | 'technical-pattern' | 'project-context' | 'workflow-optimization';
  content: string;
  confidence: 'high' | 'medium' | 'low';
  source: string; // Which logs this came from
}

/**
 * Determine if dream mode should be triggered automatically.
 * Criteria:
 * - More than 50 new memory entries since last consolidation
 * - Last consolidation was more than 24 hours ago
 */
export function shouldAutoDream(): boolean {
  const memoryDir = getMemoryDir();
  if (!existsSync(memoryDir)) return false;

  const lastDreamPath = join(memoryDir, '.last-dream');
  let lastDreamTime = 0;

  if (existsSync(lastDreamPath)) {
    try {
      lastDreamTime = parseInt(readFileSync(lastDreamPath, 'utf-8'), 10);
    } catch (_) {
      /* intentionally ignored: optional dream source unreadable */
      // Invalid timestamp, treat as never dreamed
    }
  }

  const now = Date.now();
  const hoursSinceLastDream = (now - lastDreamTime) / (1000 * 60 * 60);

  // Check if more than 24 hours since last dream
  if (hoursSinceLastDream < 24) return false;

  // Count memory entries
  const files = readdirSync(memoryDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
  let entryCount = 0;

  for (const file of files) {
    try {
      const content = readFileSync(join(memoryDir, file), 'utf-8');
      // Count entries (rough heuristic: lines starting with - or ##)
      entryCount += (content.match(/^[-#]/gm) || []).length;
    } catch (_) {
      /* intentionally ignored: optional dream source unreadable */
      // Skip unreadable files
    }
  }

  return entryCount > 50;
}

/**
 * Run dream mode consolidation.
 */
export async function runDream(options: {
  verbose?: boolean;
  dryRun?: boolean;
} = {}): Promise<DreamResult> {
  const config = loadConfig();
  const memoryDir = getMemoryDir();

  if (!existsSync(memoryDir)) {
    return {
      insights: [],
      preferencesUpdated: 0,
      duplicatesRemoved: 0,
      summary: 'No memory directory found. Nothing to consolidate.',
    };
  }

  // Step 1: Load all memory files
  const memoryContent = loadAllMemories(memoryDir);

  if (memoryContent.length === 0) {
    return {
      insights: [],
      preferencesUpdated: 0,
      duplicatesRemoved: 0,
      summary: 'No memory content found.',
    };
  }

  // Step 2: Use LLM to distill insights
  const insights = await distillInsights(memoryContent, config);

  // Step 3: Deduplicate and organize
  const { preferencesUpdated, duplicatesRemoved } = options.dryRun
    ? { preferencesUpdated: 0, duplicatesRemoved: 0 }
    : consolidateMemories(insights, memoryDir);

  // Step 4: Record dream timestamp
  if (!options.dryRun) {
    writeFileSync(join(memoryDir, '.last-dream'), Date.now().toString());
  }

  const summary = generateDreamSummary(insights, preferencesUpdated, duplicatesRemoved);

  return {
    insights,
    preferencesUpdated,
    duplicatesRemoved,
    summary,
  };
}

/**
 * Load all memory files into a single text blob.
 */
function loadAllMemories(memoryDir: string): string {
  const files = readdirSync(memoryDir).filter(f =>
    (f.endsWith('.md') || f.endsWith('.txt')) && !f.startsWith('.')
  );

  const sections: string[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(memoryDir, file), 'utf-8');
      if (content.trim()) {
        sections.push(`## Source: ${file}\n\n${content}`);
      }
    } catch (_) {
      /* intentionally ignored: optional dream source unreadable */
      // Skip unreadable files
    }
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Use LLM to distill insights from memory content.
 */
async function distillInsights(memoryContent: string, config: ReturnType<typeof loadConfig>): Promise<DreamInsight[]> {
  if (!config.apiKey) {
    throw new Error('API key not configured');
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  const prompt = `You are analyzing accumulated memory logs to extract structured insights.

Memory Content:
${memoryContent.slice(0, 20000)} ${memoryContent.length > 20000 ? '\n\n[... truncated ...]' : ''}

Task: Extract and categorize insights from these memories.

Categories:
1. user-preference: User's explicit preferences, habits, or corrections
2. technical-pattern: Code patterns, architectural decisions, or technical learnings
3. project-context: Project-specific knowledge, file structure, or domain concepts
4. workflow-optimization: Process improvements, shortcuts, or efficiency tips

For each insight:
- Provide clear, actionable content
- Assign confidence level (high/medium/low)
- Note which source it came from

Output format (JSON array):
[
  {
    "category": "user-preference",
    "content": "User prefers TypeScript strict mode and explicit type annotations",
    "confidence": "high",
    "source": "user.md"
  },
  ...
]

Output ONLY the JSON array, no explanation:`;

  try {
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Lower temperature for consistent extraction
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content || '[]';

    // Extract JSON from response (might be wrapped in code blocks)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    const jsonText = jsonMatch ? jsonMatch[0] : '[]';

    const insights = JSON.parse(jsonText) as DreamInsight[];
    return insights;
  } catch (e) {
    console.error('Failed to distill insights:', (e as Error).message);
    return [];
  }
}

/**
 * Consolidate insights into memory files, removing duplicates.
 */
function consolidateMemories(insights: DreamInsight[], memoryDir: string): {
  preferencesUpdated: number;
  duplicatesRemoved: number;
} {
  let preferencesUpdated = 0;
  let duplicatesRemoved = 0;

  // Group insights by category
  const grouped = new Map<string, DreamInsight[]>();
  for (const insight of insights) {
    const category = insight.category;
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(insight);
  }

  // Write consolidated insights to category files
  for (const [category, categoryInsights] of grouped.entries()) {
    const fileName = categoryToCategoryFile(category);
    const filePath = join(memoryDir, fileName);

    // Load existing content
    let existingContent = '';
    if (existsSync(filePath)) {
      existingContent = readFileSync(filePath, 'utf-8');
    }

    // Deduplicate: only add insights that aren't already present
    const newInsights: string[] = [];
    for (const insight of categoryInsights) {
      if (!existingContent.includes(insight.content)) {
        newInsights.push(`- ${insight.content} (confidence: ${insight.confidence})`);
        preferencesUpdated++;
      } else {
        duplicatesRemoved++;
      }
    }

    // Append new insights
    if (newInsights.length > 0) {
      const timestamp = new Date().toISOString().split('T')[0];
      const newSection = `\n\n## Consolidated: ${timestamp}\n\n${newInsights.join('\n')}`;
      writeFileSync(filePath, existingContent + newSection);
    }
  }

  return { preferencesUpdated, duplicatesRemoved };
}

/**
 * Map insight category to memory file name.
 */
function categoryToCategoryFile(category: string): string {
  switch (category) {
    case 'user-preference':
      return 'user.md';
    case 'technical-pattern':
      return 'experience.md';
    case 'project-context':
      return 'project.md';
    case 'workflow-optimization':
      return 'reference.md';
    default:
      return 'feedback.md';
  }
}

/**
 * Generate human-readable dream summary.
 */
function generateDreamSummary(
  insights: DreamInsight[],
  preferencesUpdated: number,
  duplicatesRemoved: number
): string {
  const lines: string[] = [];

  lines.push('🌙 Dream Mode Consolidation Complete');
  lines.push('');
  lines.push(`✨ Extracted ${insights.length} insights from memory logs`);
  lines.push(`📝 Updated ${preferencesUpdated} preferences`);
  lines.push(`🗑️  Removed ${duplicatesRemoved} duplicate entries`);
  lines.push('');

  // Group by category
  const grouped = new Map<string, DreamInsight[]>();
  for (const insight of insights) {
    if (!grouped.has(insight.category)) {
      grouped.set(insight.category, []);
    }
    grouped.get(insight.category)!.push(insight);
  }

  lines.push('Insights by category:');
  for (const [category, categoryInsights] of grouped.entries()) {
    const highConf = categoryInsights.filter(i => i.confidence === 'high').length;
    lines.push(`  • ${category}: ${categoryInsights.length} insights (${highConf} high confidence)`);
  }

  lines.push('');
  lines.push('Memory has been consolidated and organized. 💤');

  return lines.join('\n');
}

/**
 * Format dream result for user display.
 */
export function formatDreamResult(result: DreamResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('╔═══════════════════════════════════════════════════════════════');
  lines.push('║ 🌙 KAIROS DREAM MODE — Memory Consolidation');
  lines.push('╠═══════════════════════════════════════════════════════════════');
  lines.push(`║ ${result.summary.split('\n')[0]}`);
  lines.push('╠═══════════════════════════════════════════════════════════════');

  if (result.insights.length > 0) {
    lines.push('║ TOP INSIGHTS:');
    lines.push('║');

    // Show top 5 high-confidence insights
    const topInsights = result.insights
      .filter(i => i.confidence === 'high')
      .slice(0, 5);

    for (const insight of topInsights) {
      const icon = getCategoryIcon(insight.category);
      lines.push(`║ ${icon} ${insight.content.slice(0, 55)}`);
      if (insight.content.length > 55) {
        lines.push(`║     ${insight.content.slice(55, 110)}`);
      }
      lines.push('║');
    }
  }

  lines.push('╠═══════════════════════════════════════════════════════════════');
  lines.push(`║ Statistics:`);
  lines.push(`║   • ${result.insights.length} insights extracted`);
  lines.push(`║   • ${result.preferencesUpdated} new entries added`);
  lines.push(`║   • ${result.duplicatesRemoved} duplicates removed`);
  lines.push('╚═══════════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}

/**
 * Get icon for insight category.
 */
function getCategoryIcon(category: string): string {
  switch (category) {
    case 'user-preference':
      return '👤';
    case 'technical-pattern':
      return '🔧';
    case 'project-context':
      return '📁';
    case 'workflow-optimization':
      return '⚡';
    default:
      return '💡';
  }
}
