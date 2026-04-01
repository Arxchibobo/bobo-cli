import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { glob } from 'glob';
import type { ChatCompletionTool } from 'openai/resources/index.js';

// ─── Tool Definitions (OpenAI format) ────────────────────────

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file. Returns the file content as a string.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file (relative to CWD or absolute)' },
          offset: { type: 'number', description: 'Line number to start reading from (1-indexed)' },
          limit: { type: 'number', description: 'Max number of lines to read' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file. Creates parent directories if needed. Overwrites existing files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace exact text in a file. oldText must match exactly.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          oldText: { type: 'string', description: 'Exact text to find' },
          newText: { type: 'string', description: 'Replacement text' },
        },
        required: ['path', 'oldText', 'newText'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for files matching a glob pattern, optionally grep for content.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g. "src/**/*.ts")' },
          grep: { type: 'string', description: 'Optional regex to search in file contents' },
          maxResults: { type: 'number', description: 'Max results to return (default 20)' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and directories in a given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (default: CWD)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'shell',
      description: 'Execute a shell command. Returns stdout and stderr.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
          cwd: { type: 'string', description: 'Working directory (default: CWD)' },
          timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
        },
        required: ['command'],
      },
    },
  },
];

// ─── Tool Execution ──────────────────────────────────────────

export function executeTool(name: string, args: Record<string, unknown>): string {
  try {
    switch (name) {
      case 'read_file': return readFile(args);
      case 'write_file': return writeFile(args);
      case 'edit_file': return editFile(args);
      case 'search_files': return searchFiles(args);
      case 'list_directory': return listDirectory(args);
      case 'shell': return shell(args);
      default: return `Error: Unknown tool "${name}"`;
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function resolvePath(p: string): string {
  return resolve(process.cwd(), p);
}

function readFile(args: Record<string, unknown>): string {
  const filePath = resolvePath(args.path as string);
  if (!existsSync(filePath)) return `File not found: ${filePath}`;
  const stat = statSync(filePath);
  if (stat.isDirectory()) return `Path is a directory: ${filePath}`;

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const offset = ((args.offset as number) || 1) - 1;
  const limit = (args.limit as number) || lines.length;
  const slice = lines.slice(offset, offset + limit);
  return slice.map((line, i) => `${offset + i + 1} | ${line}`).join('\n');
}

function writeFile(args: Record<string, unknown>): string {
  const filePath = resolvePath(args.path as string);
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, args.content as string);
  return `Written ${(args.content as string).length} bytes to ${filePath}`;
}

function editFile(args: Record<string, unknown>): string {
  const filePath = resolvePath(args.path as string);
  if (!existsSync(filePath)) return `File not found: ${filePath}`;
  const content = readFileSync(filePath, 'utf-8');
  const oldText = args.oldText as string;
  const newText = args.newText as string;
  if (!content.includes(oldText)) {
    return `oldText not found in file. Make sure it matches exactly (including whitespace).`;
  }
  const updated = content.replace(oldText, newText);
  writeFileSync(filePath, updated);
  return `Edited ${filePath}`;
}

function searchFiles(args: Record<string, unknown>): string {
  const pattern = args.pattern as string;
  const grepPattern = args.grep as string | undefined;
  const maxResults = (args.maxResults as number) || 20;

  const files = glob.sync(pattern, { cwd: process.cwd(), nodir: true });
  if (files.length === 0) return `No files match pattern: ${pattern}`;

  if (!grepPattern) {
    return files.slice(0, maxResults).join('\n');
  }

  const regex = new RegExp(grepPattern, 'i');
  const results: string[] = [];
  for (const file of files) {
    if (results.length >= maxResults) break;
    try {
      const content = readFileSync(resolvePath(file), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push(`${file}:${i + 1}: ${lines[i].trim()}`);
          if (results.length >= maxResults) break;
        }
      }
    } catch { /* skip unreadable */ }
  }
  return results.length > 0 ? results.join('\n') : `No matches for "${grepPattern}" in ${files.length} files`;
}

function listDirectory(args: Record<string, unknown>): string {
  const dirPath = resolvePath((args.path as string) || '.');
  if (!existsSync(dirPath)) return `Directory not found: ${dirPath}`;
  try {
    const result = execSync(`ls -la "${dirPath}"`, { encoding: 'utf-8', timeout: 5000 });
    return result.trim();
  } catch (e) {
    return `Error listing directory: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function shell(args: Record<string, unknown>): string {
  const command = args.command as string;
  const cwd = args.cwd ? resolvePath(args.cwd as string) : process.cwd();
  const timeout = ((args.timeout as number) || 30) * 1000;

  try {
    const result = execSync(command, {
      cwd,
      encoding: 'utf-8',
      timeout,
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim() || '(no output)';
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number; message?: string };
    const stdout = err.stdout || '';
    const stderr = err.stderr || '';
    const code = err.status ?? 1;
    return `Exit code: ${code}\n${stdout}\n${stderr}`.trim();
  }
}
