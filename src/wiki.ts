/**
 * LLM-Wiki Mode — Karpathy pattern implementation
 *
 * A self-maintaining knowledge wiki powered by LLM that:
 * - Ingests documents (files/URLs) and distills them into structured wiki pages
 * - Creates entity/concept/source pages with cross-references
 * - Answers questions by synthesizing information from wiki pages
 * - Maintains health through linting and contradiction detection
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import OpenAI from 'openai';
import { loadConfig } from './config.js';
import { executeWebTool } from './web.js';

export interface WikiConfig {
  wikiDir: string;
}

export interface WikiPage {
  type: 'entity' | 'concept' | 'source' | 'comparison' | 'analysis';
  tags: string[];
  sources: string[];
  created: string;
  updated: string;
  title: string;
  content: string;
  seeAlso: string[];
}

export interface WikiStats {
  totalPages: number;
  byType: Record<string, number>;
  totalSources: number;
  lastUpdated: string;
}

export interface IngestResult {
  sourcePage: string;
  pagesCreated: string[];
  pagesUpdated: string[];
}

export interface QueryResult {
  answer: string;
  sources: string[];
  suggestedPageTitle?: string;
}

export interface LintResult {
  issues: LintIssue[];
  orphanPages: string[];
  missingLinks: string[];
  contradictions: string[];
}

export interface LintIssue {
  page: string;
  type: 'orphan' | 'missing-link' | 'outdated' | 'contradiction';
  description: string;
}

/**
 * Initialize .bobo/wiki/ directory structure.
 */
export function initWiki(projectRoot: string): string {
  const wikiDir = join(projectRoot, '.bobo', 'wiki');

  // Create directory structure
  const dirs = [
    wikiDir,
    join(wikiDir, 'sources'),
    join(wikiDir, 'pages'),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Create initial files
  const indexPath = join(wikiDir, 'index.md');
  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, `# Wiki Index

## Entities

## Concepts

## Sources

## Analysis
`);
  }

  const logPath = join(wikiDir, 'log.md');
  if (!existsSync(logPath)) {
    writeFileSync(logPath, `# Wiki Log\n`);
  }

  const schemaPath = join(wikiDir, 'schema.md');
  if (!existsSync(schemaPath)) {
    writeFileSync(schemaPath, `# Wiki Schema

This wiki follows these conventions:

## Page Types
- **entity**: People, companies, products, projects
- **concept**: Ideas, technologies, methodologies
- **source**: Original documents, articles, papers
- **comparison**: Side-by-side analysis of multiple entities/concepts
- **analysis**: Deep-dive synthesis and insights

## Page Format
Each page has YAML frontmatter with:
- type: page type
- tags: categorization tags
- sources: source pages referenced
- created: creation date (YYYY-MM-DD)
- updated: last update date (YYYY-MM-DD)

## Linking
Use [[page-name]] for internal wiki links.
Use See Also section for related pages.
`);
  }

  return wikiDir;
}

/**
 * Ingest a source (file or URL) into the wiki.
 */
export async function ingestSource(
  source: string,
  options: { wikiDir: string; verbose?: boolean }
): Promise<IngestResult> {
  const { wikiDir, verbose } = options;

  // Step 1: Fetch/read content
  let content: string;
  let sourceName: string;

  if (source.startsWith('http://') || source.startsWith('https://')) {
    // Fetch URL
    if (verbose) console.log(`Fetching ${source}...`);
    content = executeWebTool('web_fetch', { url: source, maxChars: 10000 });
    sourceName = sanitizeFilename(new URL(source).hostname + '-' + Date.now());
  } else {
    // Read local file
    if (!existsSync(source)) {
      throw new Error(`File not found: ${source}`);
    }
    content = readFileSync(source, 'utf-8');
    sourceName = sanitizeFilename(basename(source, extname(source)));
  }

  // Step 2: Save to sources/
  const sourceFileName = `${sourceName}.md`;
  const sourcePath = join(wikiDir, 'sources', sourceFileName);
  const sourceMetadata = `---
type: source
source: ${source}
ingested: ${new Date().toISOString().split('T')[0]}
---

# ${sourceName}

${content}
`;
  writeFileSync(sourcePath, sourceMetadata);

  // Step 3: Extract information with LLM
  const config = loadConfig();
  if (!config.apiKey) {
    throw new Error('API key not configured. Run: bobo config set apiKey <key>');
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  const extractionPrompt = `You are analyzing a document to extract structured information for a wiki.

Document content:
${content.slice(0, 8000)}${content.length > 8000 ? '\n\n... (truncated)' : ''}

Task: Extract key entities, concepts, and insights.

Output format (JSON):
{
  "entities": [
    {"name": "Entity Name", "type": "person|company|product", "description": "Brief description"}
  ],
  "concepts": [
    {"name": "Concept Name", "description": "Brief explanation"}
  ],
  "summary": "2-3 sentence summary of the document",
  "keyInsights": ["Insight 1", "Insight 2"]
}

Output ONLY valid JSON:`;

  const extraction = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: 'user', content: extractionPrompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const extractionText = extraction.choices[0]?.message?.content || '{}';
  const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
  const extractionData = JSON.parse(jsonMatch ? jsonMatch[0] : '{}') as {
    entities?: Array<{ name: string; type: string; description: string }>;
    concepts?: Array<{ name: string; description: string }>;
    summary?: string;
    keyInsights?: string[];
  };

  // Step 4: Create/update pages
  const pagesCreated: string[] = [];
  const pagesUpdated: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  // Create source summary page
  const sourcePageName = `source-${sourceName}.md`;
  const sourcePagePath = join(wikiDir, 'pages', sourcePageName);
  const sourcePageContent = `---
type: source
tags: [source]
sources: []
created: ${today}
updated: ${today}
---

# ${sourceName}

**Source:** ${source}

## Summary

${extractionData.summary || 'No summary available.'}

## Key Insights

${(extractionData.keyInsights || []).map(i => `- ${i}`).join('\n')}

## See Also

${(extractionData.entities || []).map(e => `- [[${slugify(e.name)}]]`).join('\n')}
${(extractionData.concepts || []).map(c => `- [[${slugify(c.name)}]]`).join('\n')}
`;
  writeFileSync(sourcePagePath, sourcePageContent);
  pagesCreated.push(sourcePageName);

  // Create/update entity pages
  for (const entity of extractionData.entities || []) {
    const slug = slugify(entity.name);
    const pageName = `${slug}.md`;
    const pagePath = join(wikiDir, 'pages', pageName);

    if (existsSync(pagePath)) {
      // Update existing page
      const existing = readFileSync(pagePath, 'utf-8');
      const updatedContent = updatePageWithNewInfo(existing, entity.description, sourcePageName, today);
      writeFileSync(pagePath, updatedContent);
      pagesUpdated.push(pageName);
    } else {
      // Create new page
      const pageContent = `---
type: entity
tags: [${entity.type}]
sources: [${sourcePageName}]
created: ${today}
updated: ${today}
---

# ${entity.name}

${entity.description}

## References

- [[${sourcePageName.replace('.md', '')}]]

## See Also
`;
      writeFileSync(pagePath, pageContent);
      pagesCreated.push(pageName);
    }
  }

  // Create/update concept pages
  for (const concept of extractionData.concepts || []) {
    const slug = slugify(concept.name);
    const pageName = `${slug}.md`;
    const pagePath = join(wikiDir, 'pages', pageName);

    if (existsSync(pagePath)) {
      const existing = readFileSync(pagePath, 'utf-8');
      const updatedContent = updatePageWithNewInfo(existing, concept.description, sourcePageName, today);
      writeFileSync(pagePath, updatedContent);
      pagesUpdated.push(pageName);
    } else {
      const pageContent = `---
type: concept
tags: [concept]
sources: [${sourcePageName}]
created: ${today}
updated: ${today}
---

# ${concept.name}

${concept.description}

## References

- [[${sourcePageName.replace('.md', '')}]]

## See Also
`;
      writeFileSync(pagePath, pageContent);
      pagesCreated.push(pageName);
    }
  }

  // Step 5: Update index.md
  await rebuildIndex(wikiDir);

  // Step 6: Append to log.md
  const logPath = join(wikiDir, 'log.md');
  const logEntry = `
## [${today}] ingest | ${sourceName}
Source: ${source}
Pages created: ${pagesCreated.join(', ')}
Pages updated: ${pagesUpdated.join(', ')}
`;
  const existingLog = existsSync(logPath) ? readFileSync(logPath, 'utf-8') : '# Wiki Log\n';
  writeFileSync(logPath, existingLog + logEntry);

  return {
    sourcePage: sourcePageName,
    pagesCreated,
    pagesUpdated,
  };
}

/**
 * Query the wiki with LLM synthesis.
 */
export async function queryWiki(
  question: string,
  options: { wikiDir: string; verbose?: boolean }
): Promise<QueryResult> {
  const { wikiDir, verbose } = options;

  // Step 1: Find relevant pages by searching index
  const indexPath = join(wikiDir, 'index.md');
  if (!existsSync(indexPath)) {
    throw new Error('Wiki not initialized. Run: bobo wiki init');
  }

  const indexContent = readFileSync(indexPath, 'utf-8');

  // Simple keyword matching (could be enhanced with embeddings)
  const keywords = question.toLowerCase().split(/\s+/);
  const relevantPages = findRelevantPages(wikiDir, keywords);

  if (relevantPages.length === 0) {
    return {
      answer: 'No relevant information found in the wiki. Consider ingesting more sources.',
      sources: [],
    };
  }

  // Step 2: Read relevant pages
  if (verbose) console.log(`Found ${relevantPages.length} relevant pages...`);
  const pageContents = relevantPages.slice(0, 5).map(page => {
    const content = readFileSync(join(wikiDir, 'pages', page), 'utf-8');
    return `## [[${page.replace('.md', '')}]]\n\n${content}`;
  }).join('\n\n---\n\n');

  // Step 3: LLM synthesis
  const config = loadConfig();
  if (!config.apiKey) {
    throw new Error('API key not configured');
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  const synthesisPrompt = `You are answering a question using information from a knowledge wiki.

Question: ${question}

Wiki pages:
${pageContents.slice(0, 6000)}${pageContents.length > 6000 ? '\n\n... (truncated)' : ''}

Task: Provide a clear, accurate answer based on the wiki content. Cite page names using [[page-name]] notation.

If the answer would be valuable for future reference, suggest a wiki page title to save it as.

Format:
ANSWER: [your answer]
SOURCES: [[page1]], [[page2]], ...
SUGGESTED_PAGE: [page title or "none"]`;

  const synthesis = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: 'user', content: synthesisPrompt }],
    temperature: 0.4,
    max_tokens: 1500,
  });

  const response = synthesis.choices[0]?.message?.content || '';

  // Parse response
  const answerMatch = response.match(/ANSWER:\s*([\s\S]*?)(?=SOURCES:|$)/i);
  const sourcesMatch = response.match(/SOURCES:\s*(.*?)(?=SUGGESTED_PAGE:|$)/i);
  const suggestedMatch = response.match(/SUGGESTED_PAGE:\s*(.*?)$/i);

  const answer = answerMatch ? answerMatch[1].trim() : response;
  const sources = sourcesMatch
    ? sourcesMatch[1].match(/\[\[([^\]]+)\]\]/g)?.map(s => s.replace(/[\[\]]/g, '')) || []
    : [];
  const suggestedPageTitle = suggestedMatch && suggestedMatch[1].trim().toLowerCase() !== 'none'
    ? suggestedMatch[1].trim()
    : undefined;

  return {
    answer,
    sources,
    suggestedPageTitle,
  };
}

/**
 * Run health checks on the wiki.
 */
export async function lintWiki(wikiDir: string): Promise<LintResult> {
  const pagesDir = join(wikiDir, 'pages');
  if (!existsSync(pagesDir)) {
    return { issues: [], orphanPages: [], missingLinks: [], contradictions: [] };
  }

  const pages = readdirSync(pagesDir).filter(f => f.endsWith('.md'));

  // Find orphan pages (not referenced by index or other pages)
  const orphanPages: string[] = [];
  const allPageContents = pages.map(p => readFileSync(join(pagesDir, p), 'utf-8')).join('\n');

  for (const page of pages) {
    const pageName = page.replace('.md', '');
    if (!allPageContents.includes(`[[${pageName}]]`) && !allPageContents.includes(page)) {
      orphanPages.push(page);
    }
  }

  // Find broken links
  const missingLinks: string[] = [];
  const linkPattern = /\[\[([^\]]+)\]\]/g;
  for (const page of pages) {
    const content = readFileSync(join(pagesDir, page), 'utf-8');
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      const linkedPage = match[1];
      if (!pages.includes(`${linkedPage}.md`) && !linkedPage.startsWith('source-')) {
        missingLinks.push(`${page} → ${linkedPage}`);
      }
    }
  }

  const issues: LintIssue[] = [];

  for (const orphan of orphanPages) {
    issues.push({
      page: orphan,
      type: 'orphan',
      description: 'Page is not referenced by any other page',
    });
  }

  for (const missing of missingLinks) {
    const [page, target] = missing.split(' → ');
    issues.push({
      page: page!,
      type: 'missing-link',
      description: `Links to non-existent page: ${target}`,
    });
  }

  return {
    issues,
    orphanPages,
    missingLinks,
    contradictions: [], // TODO: LLM-based contradiction detection
  };
}

/**
 * Rebuild index.md from all pages.
 */
export async function rebuildIndex(wikiDir: string): Promise<void> {
  const pagesDir = join(wikiDir, 'pages');
  if (!existsSync(pagesDir)) return;

  const pages = readdirSync(pagesDir).filter(f => f.endsWith('.md'));

  const byType: Record<string, Array<{ name: string; title: string; summary: string }>> = {
    entity: [],
    concept: [],
    source: [],
    comparison: [],
    analysis: [],
  };

  for (const page of pages) {
    const content = readFileSync(join(pagesDir, page), 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) continue;

    const frontmatter = parseFrontmatter(frontmatterMatch[1]);
    const typeValue = frontmatter.type;
    const type = (Array.isArray(typeValue) ? typeValue[0] : typeValue) || 'concept';

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : page.replace('.md', '');

    const firstParagraph = content
      .replace(/^---[\s\S]*?---/, '')
      .replace(/^#.*$/gm, '')
      .trim()
      .split('\n\n')[0] || '';

    const summary = firstParagraph.slice(0, 100).replace(/\n/g, ' ');

    if (byType[type]) {
      byType[type].push({ name: page.replace('.md', ''), title, summary });
    }
  }

  const indexLines = ['# Wiki Index\n'];

  const sections = [
    ['Entities', 'entity'],
    ['Concepts', 'concept'],
    ['Sources', 'source'],
    ['Comparisons', 'comparison'],
    ['Analysis', 'analysis'],
  ];

  for (const [sectionTitle, type] of sections) {
    if (byType[type].length > 0) {
      indexLines.push(`## ${sectionTitle}\n`);
      for (const item of byType[type]) {
        indexLines.push(`- [${item.title}](pages/${item.name}.md) — ${item.summary}`);
      }
      indexLines.push('');
    }
  }

  writeFileSync(join(wikiDir, 'index.md'), indexLines.join('\n'));
}

/**
 * Search wiki pages by keyword.
 */
export function searchWiki(keyword: string, wikiDir: string): Array<{ page: string; matches: string[] }> {
  const pagesDir = join(wikiDir, 'pages');
  if (!existsSync(pagesDir)) return [];

  const pages = readdirSync(pagesDir).filter(f => f.endsWith('.md'));
  const results: Array<{ page: string; matches: string[] }> = [];

  const searchTerm = keyword.toLowerCase();

  for (const page of pages) {
    const content = readFileSync(join(pagesDir, page), 'utf-8');
    if (content.toLowerCase().includes(searchTerm)) {
      const lines = content.split('\n');
      const matches = lines
        .filter(line => line.toLowerCase().includes(searchTerm))
        .slice(0, 3);
      results.push({ page, matches });
    }
  }

  return results;
}

/**
 * Get wiki statistics.
 */
export function getWikiStats(wikiDir: string): WikiStats {
  const pagesDir = join(wikiDir, 'pages');
  const sourcesDir = join(wikiDir, 'sources');

  if (!existsSync(pagesDir)) {
    return {
      totalPages: 0,
      byType: {},
      totalSources: 0,
      lastUpdated: 'never',
    };
  }

  const pages = readdirSync(pagesDir).filter(f => f.endsWith('.md'));
  const sources = existsSync(sourcesDir) ? readdirSync(sourcesDir).filter(f => f.endsWith('.md')) : [];

  const byType: Record<string, number> = {};
  let latestUpdate = 0;

  for (const page of pages) {
    const content = readFileSync(join(pagesDir, page), 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      const frontmatter = parseFrontmatter(frontmatterMatch[1]);
      const typeValue = frontmatter.type;
      const type = (Array.isArray(typeValue) ? typeValue[0] : typeValue) || 'unknown';
      byType[type] = (byType[type] || 0) + 1;

      if (frontmatter.updated) {
        const updatedValue = frontmatter.updated;
        const updatedStr = Array.isArray(updatedValue) ? updatedValue[0] : updatedValue;
        const updateTime = new Date(updatedStr).getTime();
        if (updateTime > latestUpdate) latestUpdate = updateTime;
      }
    }

    const stat = statSync(join(pagesDir, page));
    if (stat.mtimeMs > latestUpdate) latestUpdate = stat.mtimeMs;
  }

  return {
    totalPages: pages.length,
    byType,
    totalSources: sources.length,
    lastUpdated: latestUpdate > 0 ? new Date(latestUpdate).toISOString().split('T')[0] : 'never',
  };
}

/**
 * Get recent log entries.
 */
export function getRecentLogs(wikiDir: string, count: number = 10): string[] {
  const logPath = join(wikiDir, 'log.md');
  if (!existsSync(logPath)) return [];

  const content = readFileSync(logPath, 'utf-8');
  const entries = content.split(/^## /m).filter(e => e.trim()).slice(-count);

  return entries.map(e => '## ' + e.trim());
}

// ─── Helper Functions ────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseFrontmatter(yaml: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const line of yaml.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const key = match[1];
      const value = match[2];

      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        result[key] = value
          .slice(1, -1)
          .split(',')
          .map(s => s.trim().replace(/^['"]|['"]$/g, ''));
      } else {
        result[key] = value.trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }

  return result;
}

function findRelevantPages(wikiDir: string, keywords: string[]): string[] {
  const pagesDir = join(wikiDir, 'pages');
  if (!existsSync(pagesDir)) return [];

  const pages = readdirSync(pagesDir).filter(f => f.endsWith('.md'));
  const scored: Array<{ page: string; score: number }> = [];

  for (const page of pages) {
    const content = readFileSync(join(pagesDir, page), 'utf-8').toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      const occurrences = (content.match(new RegExp(keyword, 'g')) || []).length;
      score += occurrences;
    }

    if (score > 0) {
      scored.push({ page, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.page);
}

function updatePageWithNewInfo(
  existingContent: string,
  newInfo: string,
  sourcePage: string,
  today: string
): string {
  // Update frontmatter updated field
  const updatedContent = existingContent.replace(
    /updated: \d{4}-\d{2}-\d{2}/,
    `updated: ${today}`
  );

  // Add to sources array if not already present
  let finalContent = updatedContent;
  if (!finalContent.includes(sourcePage)) {
    finalContent = finalContent.replace(
      /sources: \[(.*?)\]/,
      (match, sources) => {
        const sourceList = sources.split(',').map((s: string) => s.trim()).filter((s: string) => s);
        sourceList.push(sourcePage);
        return `sources: [${sourceList.join(', ')}]`;
      }
    );
  }

  // Add new info before "## References" section if it doesn't already exist
  if (!finalContent.includes(newInfo.slice(0, 50))) {
    const referencesIndex = finalContent.indexOf('## References');
    if (referencesIndex > 0) {
      finalContent = finalContent.slice(0, referencesIndex) +
        `\n### Additional Information\n\n${newInfo}\n\n` +
        finalContent.slice(referencesIndex);
    }
  }

  return finalContent;
}
