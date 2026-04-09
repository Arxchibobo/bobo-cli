import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { glob } from 'glob';
import { saveMemory, searchMemory } from '../memory.js';
import { plannerToolDefinitions, executePlannerTool, isPlannerTool } from '../planner.js';
import { webToolDefinitions, executeWebTool, isWebTool } from '../web.js';
import { runHooks } from '../hooks.js';
import { advancedToolDefinitions, isAdvancedTool, executeAdvancedTool } from './advanced.js';
import { processToolDefinitions, isProcessTool, executeProcessTool } from './process-manager.js';
import { gitAdvancedToolDefinitions, isGitAdvancedTool, executeGitAdvancedTool } from './git-advanced.js';
import { browserToolDefinitions, isBrowserTool, executeBrowserTool } from './browser.js';
import { claudeCodeToolDefinitions, isClaudeCodeTool, executeClaudeCodeTool, isClaudeCodeAvailable } from './claude-code.js';
import type { ChatCompletionTool } from 'openai/resources/index.js';

// ─── Core Tool Definitions ───────────────────────────────────

const coreToolDefinitions: ChatCompletionTool[] = [
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
  // ─── Memory Tools ──────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'save_memory',
      description: 'Save important information to persistent memory. Categories: user (preferences), feedback (corrections), project (active tasks), reference (knowledge), experience (lessons learned).',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['user', 'feedback', 'project', 'reference', 'experience'],
            description: 'Memory category',
          },
          content: { type: 'string', description: 'What to remember' },
        },
        required: ['category', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_memory',
      description: 'Search persistent memory for relevant past information, preferences, or learnings.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
  // ─── Git Tools ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Get git status of the current repository.',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Repository path (default: CWD)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Show git diff (staged, unstaged, or between refs).',
      parameters: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'Git ref to diff against (e.g. HEAD~1, main)' },
          staged: { type: 'boolean', description: 'Show staged changes only' },
          cwd: { type: 'string', description: 'Repository path (default: CWD)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_log',
      description: 'Show recent git log entries.',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Number of entries (default: 10)' },
          oneline: { type: 'boolean', description: 'One-line format (default: true)' },
          cwd: { type: 'string', description: 'Repository path (default: CWD)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Stage all changes and commit with a message. Use after making file edits.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message' },
          addAll: { type: 'boolean', description: 'Run git add -A before commit (default: true)' },
          cwd: { type: 'string', description: 'Repository path (default: CWD)' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_push',
      description: 'Push commits to remote repository.',
      parameters: {
        type: 'object',
        properties: {
          remote: { type: 'string', description: 'Remote name (default: origin)' },
          branch: { type: 'string', description: 'Branch name (default: current branch)' },
          cwd: { type: 'string', description: 'Repository path (default: CWD)' },
        },
        required: [],
      },
    },
  },
];

// ─── Combined Tool Definitions ───────────────────────────────

export const toolDefinitions: ChatCompletionTool[] = [
  ...coreToolDefinitions,
  ...advancedToolDefinitions,
  ...processToolDefinitions,
  ...gitAdvancedToolDefinitions,
  ...browserToolDefinitions,
  ...(isClaudeCodeAvailable() ? claudeCodeToolDefinitions : []),
  ...plannerToolDefinitions,
  ...webToolDefinitions,
];

// ─── Unified Tool Execution ──────────────────────────────────

export function executeTool(name: string, args: Record<string, unknown>): string {
  try {
    // Check delegated tools first
    if (isPlannerTool(name)) return executePlannerTool(name, args);
    if (isWebTool(name)) return executeWebTool(name, args);
    if (isProcessTool(name)) return executeProcessTool(name, args);
    if (isGitAdvancedTool(name)) return executeGitAdvancedTool(name, args);
    if (isClaudeCodeTool(name)) return executeClaudeCodeTool(name, args);
    // Note: advanced tools and browser tools are async, handled in agent.ts

    // Core tools
    switch (name) {
      case 'read_file': return readFile(args);
      case 'write_file': {
        runHooks('pre-edit', { BOBO_FILE: args.path as string || '' });
        const result = writeFile(args);
        runHooks('post-edit', { BOBO_FILE: args.path as string || '' });
        return result;
      }
      case 'edit_file': {
        runHooks('pre-edit', { BOBO_FILE: args.path as string || '' });
        const result = editFile(args);
        runHooks('post-edit', { BOBO_FILE: args.path as string || '' });
        return result;
      }
      case 'search_files': return searchFiles(args);
      case 'list_directory': return listDirectory(args);
      case 'shell': {
        runHooks('pre-shell', { BOBO_COMMAND: (args.command as string) || '' });
        const result = shellExec(args);
        runHooks('post-shell', { BOBO_COMMAND: (args.command as string) || '' });
        return result;
      }
      case 'save_memory': return saveMemoryTool(args);
      case 'search_memory': return searchMemoryTool(args);
      case 'git_status': return gitStatus(args);
      case 'git_diff': return gitDiff(args);
      case 'git_log': return gitLog(args);
      case 'git_commit': {
        runHooks('pre-commit', { BOBO_COMMIT_MSG: (args.message as string) || '' });
        const result = gitCommit(args);
        runHooks('post-commit', { BOBO_COMMIT_MSG: (args.message as string) || '' });
        return result;
      }
      case 'git_push': return gitPush(args);
      default: return `Error: Unknown tool "${name}"`;
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ─── Core Tool Implementations ───────────────────────────────

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
  const count = content.split(oldText).length - 1;
  if (count === 0) {
    return `oldText not found in file. Make sure it matches exactly (including whitespace).`;
  }
  if (count > 1) {
    return `oldText found ${count} times in file. Provide more surrounding context to make the match unique.`;
  }
  const idx = content.indexOf(oldText);
  const updated = content.slice(0, idx) + newText + content.slice(idx + oldText.length);
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
    } catch (_) { /* intentionally ignored: skip unreadable files */ }
  }
  return results.length > 0 ? results.join('\n') : `No matches for "${grepPattern}" in ${files.length} files`;
}

function listDirectory(args: Record<string, unknown>): string {
  const dirPath = resolvePath((args.path as string) || '.');
  if (!existsSync(dirPath)) return `Directory not found: ${dirPath}`;
  try {
    // Cross-platform: use Node.js fs instead of shell commands
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const lines = entries.map(e => {
      const type = e.isDirectory() ? 'd' : e.isSymbolicLink() ? 'l' : '-';
      const name = e.name;
      // Skip stat for directories to save syscalls
      if (e.isDirectory()) {
        return `${type}           -                     ${name}/`;
      }
      try {
        const stats = statSync(join(dirPath, name));
        const size = stats.size.toString().padStart(10);
        const mtime = stats.mtime.toISOString().slice(0, 19).replace('T', ' ');
        return `${type}  ${size}  ${mtime}  ${name}`;
      } catch (_) {
        /* intentionally ignored: stat may fail for broken symlinks or permission issues */
        return `${type}           -                     ${name}`;
      }
    });
    return lines.length > 0 ? lines.join('\n') : '(empty directory)';
  } catch (e) {
    return `Error listing directory: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function shellExec(args: Record<string, unknown>): string {
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
    const err = e as { stdout?: string; stderr?: string; status?: number };
    const stdout = err.stdout || '';
    const stderr = err.stderr || '';
    const code = err.status ?? 1;
    return `Exit code: ${code}\n${stdout}\n${stderr}`.trim();
  }
}

// ─── Memory Tool Implementations ─────────────────────────────

type MemoryEntry = { category: 'user' | 'feedback' | 'project' | 'reference' | 'experience'; content: string; timestamp: string };

function saveMemoryTool(args: Record<string, unknown>): string {
  const now = new Date();
  const timestamp = now.toISOString().split('T')[0] + ' ' + now.toTimeString().split(' ')[0];
  return saveMemory({
    category: args.category as MemoryEntry['category'],
    content: args.content as string,
    timestamp,
  });
}

function searchMemoryTool(args: Record<string, unknown>): string {
  return searchMemory(args.query as string);
}

// ─── Git Tool Implementations ────────────────────────────────

function gitStatus(args: Record<string, unknown>): string {
  const cwd = args.cwd ? resolvePath(args.cwd as string) : process.cwd();
  try {
    const status = execSync('git status --short', { cwd, encoding: 'utf-8', timeout: 5000 });
    const branch = execSync('git branch --show-current', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
    return `Branch: ${branch}\n${status.trim() || '(clean)'}`;
  } catch (e) {
    return `Not a git repo or git error: ${(e as Error).message}`;
  }
}

function gitDiff(args: Record<string, unknown>): string {
  const cwd = args.cwd ? resolvePath(args.cwd as string) : process.cwd();
  const ref = args.ref as string | undefined;
  const staged = args.staged as boolean | undefined;

  let cmd = 'git diff';
  if (staged) cmd += ' --staged';
  if (ref) cmd += ` ${ref}`;
  cmd += ' --stat';

  try {
    const stat = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 10000 });
    return stat.trim() || '(no changes)';
  } catch (e) {
    return `Git diff error: ${(e as Error).message}`;
  }
}

function gitLog(args: Record<string, unknown>): string {
  const cwd = args.cwd ? resolvePath(args.cwd as string) : process.cwd();
  const count = (args.count as number) || 10;
  const oneline = args.oneline !== false;

  const format = oneline ? '--oneline' : '--format=%h %s (%ar) <%an>';

  try {
    const log = execSync(`git log ${format} -${count}`, { cwd, encoding: 'utf-8', timeout: 5000 });
    return log.trim() || '(no commits)';
  } catch (e) {
    return `Git log error: ${(e as Error).message}`;
  }
}

function gitCommit(args: Record<string, unknown>): string {
  const cwd = args.cwd ? resolvePath(args.cwd as string) : process.cwd();
  const message = args.message as string;
  const addAll = args.addAll !== false;

  try {
    if (addAll) {
      execFileSync('git', ['add', '-A'], { cwd, encoding: 'utf-8', timeout: 5000 });
    }
    const result = execFileSync('git', ['commit', '-m', message], {
      cwd,
      encoding: 'utf-8',
      timeout: 10000,
    });
    return result.trim();
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    return `Git commit error: ${err.stdout || err.stderr || (e as Error).message}`.trim();
  }
}

function gitPush(args: Record<string, unknown>): string {
  const cwd = args.cwd ? resolvePath(args.cwd as string) : process.cwd();
  const remote = (args.remote as string) || 'origin';
  const branch = args.branch as string | undefined;

  try {
    const gitArgs = branch ? ['push', remote, branch] : ['push', remote];
    const result = execFileSync('git', gitArgs, { cwd, encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] });
    return result.trim() || 'Push successful';
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    // git push outputs to stderr on success
    const output = (err.stderr || '') + (err.stdout || '');
    if (output.includes('->')) return output.trim();
    return `Git push error: ${output || (e as Error).message}`.trim();
  }
}
