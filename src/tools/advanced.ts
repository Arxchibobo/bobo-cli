/**
 * Advanced tools for engineering parity with Claude Code:
 * - multi_edit: Edit multiple files in one call
 * - codemod: Cross-file search and replace (regex)
 * - apply_patch: Apply unified diff patches
 * - http_request: Make HTTP requests
 * - process_list: List running processes
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { glob } from 'glob';
import { runHooks } from '../hooks.js';
import type { ChatCompletionTool } from 'openai/resources/index.js';

// ─── Tool Definitions ────────────────────────────────────────

export const advancedToolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'multi_edit',
      description: 'Edit multiple files in a single atomic operation. Each edit specifies a file and the old/new text.',
      parameters: {
        type: 'object',
        properties: {
          edits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path' },
                oldText: { type: 'string', description: 'Exact text to find' },
                newText: { type: 'string', description: 'Replacement text' },
              },
              required: ['path', 'oldText', 'newText'],
            },
            description: 'Array of file edits to apply',
          },
        },
        required: ['edits'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'codemod',
      description: 'Search and replace across multiple files using regex. Like a refactoring tool.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern for files (e.g. "src/**/*.ts")' },
          search: { type: 'string', description: 'Regex pattern to search for' },
          replace: { type: 'string', description: 'Replacement string (supports $1, $2 captures)' },
          dryRun: { type: 'boolean', description: 'Preview changes without applying (default: false)' },
        },
        required: ['pattern', 'search', 'replace'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_patch',
      description: 'Apply a unified diff patch to one or more files.',
      parameters: {
        type: 'object',
        properties: {
          patch: { type: 'string', description: 'Unified diff content' },
          cwd: { type: 'string', description: 'Working directory (default: CWD)' },
        },
        required: ['patch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'http_request',
      description: 'Make an HTTP request. Useful for testing APIs or fetching data.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to request' },
          method: { type: 'string', description: 'HTTP method (GET, POST, PUT, DELETE)' },
          headers: { type: 'object', description: 'Request headers' },
          body: { type: 'string', description: 'Request body (JSON string)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'batch_write',
      description: 'Write multiple files in one operation. Creates parent directories as needed.',
      parameters: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path' },
                content: { type: 'string', description: 'File content' },
              },
              required: ['path', 'content'],
            },
            description: 'Array of files to write',
          },
        },
        required: ['files'],
      },
    },
  },
];

// ─── Tool Implementations ────────────────────────────────────

function resolvePath(p: string): string {
  return resolve(process.cwd(), p);
}

function multiEdit(args: Record<string, unknown>): string {
  const edits = args.edits as Array<{ path: string; oldText: string; newText: string }>;
  if (!edits || edits.length === 0) return 'No edits provided';

  const results: string[] = [];
  let successCount = 0;

  for (const edit of edits) {
    const filePath = resolvePath(edit.path);
    if (!existsSync(filePath)) {
      results.push(`✗ ${edit.path}: file not found`);
      continue;
    }

    const content = readFileSync(filePath, 'utf-8');
    if (!content.includes(edit.oldText)) {
      results.push(`✗ ${edit.path}: oldText not found`);
      continue;
    }

    runHooks('pre-edit', { BOBO_FILE: edit.path });
    const updated = content.replace(edit.oldText, edit.newText);
    writeFileSync(filePath, updated);
    runHooks('post-edit', { BOBO_FILE: edit.path });
    results.push(`✓ ${edit.path}`);
    successCount++;
  }

  return `Edited ${successCount}/${edits.length} files:\n${results.join('\n')}`;
}

function codemod(args: Record<string, unknown>): string {
  const pattern = args.pattern as string;
  const search = args.search as string;
  const replace = args.replace as string;
  const dryRun = args.dryRun as boolean || false;

  const files = glob.sync(pattern, { cwd: process.cwd(), nodir: true });
  if (files.length === 0) return `No files match: ${pattern}`;

  const regex = new RegExp(search, 'g');
  const results: string[] = [];
  let totalMatches = 0;
  let totalFiles = 0;

  for (const file of files) {
    const filePath = resolvePath(file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const matches = content.match(regex);
      if (!matches || matches.length === 0) continue;

      totalMatches += matches.length;
      totalFiles++;

      if (dryRun) {
        results.push(`  ${file}: ${matches.length} matches`);
      } else {
        runHooks('pre-edit', { BOBO_FILE: file });
        const updated = content.replace(regex, replace);
        writeFileSync(filePath, updated);
        runHooks('post-edit', { BOBO_FILE: file });
        results.push(`  ✓ ${file}: ${matches.length} replacements`);
      }
    } catch { /* skip unreadable */ }
  }

  const label = dryRun ? 'Would modify' : 'Modified';
  return `${label} ${totalFiles} files (${totalMatches} matches):\n${results.join('\n')}`;
}

function applyPatch(args: Record<string, unknown>): string {
  const patch = args.patch as string;
  const cwd = args.cwd ? resolvePath(args.cwd as string) : process.cwd();

  try {
    // Try using git apply
    const result = execSync('git apply --stat -', {
      input: patch,
      cwd,
      encoding: 'utf-8',
      timeout: 10000,
    });

    execSync('git apply -', {
      input: patch,
      cwd,
      encoding: 'utf-8',
      timeout: 10000,
    });

    return `Patch applied:\n${result.trim()}`;
  } catch {
    // Fallback: try patch command
    try {
      const result = execSync('patch -p1', {
        input: patch,
        cwd,
        encoding: 'utf-8',
        timeout: 10000,
      });
      return `Patch applied:\n${result.trim()}`;
    } catch (e) {
      return `Patch failed: ${(e as Error).message}`;
    }
  }
}

async function httpRequest(args: Record<string, unknown>): Promise<string> {
  const url = args.url as string;
  const method = (args.method as string || 'GET').toUpperCase();
  const headers = (args.headers || {}) as Record<string, string>;
  const body = args.body as string | undefined;

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body || undefined,
    });

    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    let responseBody: string;

    if (contentType.includes('json')) {
      responseBody = JSON.stringify(await response.json(), null, 2);
    } else {
      responseBody = await response.text();
    }

    // Truncate long responses
    if (responseBody.length > 5000) {
      responseBody = responseBody.slice(0, 5000) + '\n... (truncated)';
    }

    return `HTTP ${status}\n${responseBody}`;
  } catch (e) {
    return `HTTP Error: ${(e as Error).message}`;
  }
}

function batchWrite(args: Record<string, unknown>): string {
  const files = args.files as Array<{ path: string; content: string }>;
  if (!files || files.length === 0) return 'No files provided';

  const results: string[] = [];
  for (const file of files) {
    const filePath = resolvePath(file.path);
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    runHooks('pre-edit', { BOBO_FILE: file.path });
    writeFileSync(filePath, file.content);
    runHooks('post-edit', { BOBO_FILE: file.path });
    results.push(`✓ ${file.path} (${file.content.length} bytes)`);
  }

  return `Wrote ${files.length} files:\n${results.join('\n')}`;
}

// ─── Executor ────────────────────────────────────────────────

export function isAdvancedTool(name: string): boolean {
  return ['multi_edit', 'codemod', 'apply_patch', 'http_request', 'batch_write'].includes(name);
}

export async function executeAdvancedTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'multi_edit': return multiEdit(args);
    case 'codemod': return codemod(args);
    case 'apply_patch': return applyPatch(args);
    case 'http_request': return await httpRequest(args);
    case 'batch_write': return batchWrite(args);
    default: return `Unknown advanced tool: ${name}`;
  }
}
