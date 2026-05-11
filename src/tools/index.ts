import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
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
import { safeResolvePath, validateShellCommand, runGit, SafetyError } from './safety.js';
import type { ChatCompletionTool } from 'openai/resources/index.js';

const READ_FILE_DEFAULT_LIMIT = 500;

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

export function executeTool(name: string, args: Record<string, unknown>): string | Promise<string> {
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

function resolveCwdArg(arg: unknown): string {
  if (arg === undefined || arg === null || arg === '') return process.cwd();
  return safeResolvePath(arg);
}

function readFile(args: Record<string, unknown>): string {
  let filePath: string;
  try {
    filePath = safeResolvePath(args.path);
  } catch (e) {
    return (e as SafetyError).message;
  }

  // Validate offset / limit before touching the filesystem.
  const rawOffset = args.offset;
  let offset = 1;
  if (rawOffset !== undefined && rawOffset !== null) {
    if (typeof rawOffset !== 'number' || !Number.isInteger(rawOffset) || rawOffset < 1) {
      return `Invalid offset: ${String(rawOffset)} (must be a positive integer)`;
    }
    offset = rawOffset;
  }

  const rawLimit = args.limit;
  let limit = READ_FILE_DEFAULT_LIMIT;
  if (rawLimit !== undefined && rawLimit !== null) {
    if (typeof rawLimit !== 'number' || !Number.isInteger(rawLimit) || rawLimit <= 0) {
      return `Invalid limit: ${String(rawLimit)} (must be a positive integer)`;
    }
    limit = rawLimit;
  }

  // Single try/catch instead of existsSync+statSync+readFileSync (TOCTOU).
  let content: string;
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) return `Path is a directory: ${filePath}`;
    content = readFileSync(filePath, 'utf-8');
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'ENOENT') return `File not found: ${filePath}`;
    return `Read error: ${err.message ?? String(e)}`;
  }

  const lines = content.split('\n');
  const startIdx = offset - 1;
  if (startIdx >= lines.length) {
    return `Offset ${offset} is past end of file (${lines.length} lines)`;
  }
  const slice = lines.slice(startIdx, startIdx + limit);
  const body = slice.map((line, i) => `${startIdx + i + 1} | ${line}`).join('\n');

  const remaining = lines.length - (startIdx + slice.length);
  if (remaining > 0) {
    return `${body}\n\n... (${remaining} more lines, use offset=${startIdx + slice.length + 1} to continue)`;
  }
  return body;
}

function writeFile(args: Record<string, unknown>): string {
  let filePath: string;
  try {
    filePath = safeResolvePath(args.path);
  } catch (e) {
    return (e as SafetyError).message;
  }
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, args.content as string);
  return `Written ${(args.content as string).length} bytes to ${filePath}`;
}

function editFile(args: Record<string, unknown>): string {
  let filePath: string;
  try {
    filePath = safeResolvePath(args.path);
  } catch (e) {
    return (e as SafetyError).message;
  }
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

  let regex: RegExp;
  try {
    regex = new RegExp(grepPattern, 'i');
  } catch (e) {
    return `Invalid grep regex: ${(e as Error).message}`;
  }

  const results: string[] = [];
  for (const file of files) {
    if (results.length >= maxResults) break;
    let abs: string;
    try {
      abs = safeResolvePath(file);
    } catch (_) {
      continue; // glob produced a path outside cwd — skip
    }
    try {
      const content = readFileSync(abs, 'utf-8');
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
  let dirPath: string;
  try {
    dirPath = args.path ? safeResolvePath(args.path) : process.cwd();
  } catch (e) {
    return (e as SafetyError).message;
  }
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
  let command: string;
  let cwd: string;
  try {
    command = validateShellCommand(args.command);
    cwd = resolveCwdArg(args.cwd);
  } catch (e) {
    return `shell blocked: ${(e as SafetyError).message}`;
  }
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

const REF_RE = /^[A-Za-z0-9._\-/@{}+~^:]+$/;
function safeRef(name: unknown, label: string): string {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`Missing ${label}`);
  }
  if (!REF_RE.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`);
  }
  return name;
}

function gitStatus(args: Record<string, unknown>): string {
  let cwd: string;
  try {
    cwd = resolveCwdArg(args.cwd);
  } catch (e) {
    return (e as SafetyError).message;
  }
  const status = runGit(['status', '--short'], { cwd, timeout: 5000 });
  const branch = runGit(['branch', '--show-current'], { cwd, timeout: 5000 });
  if (!status.ok && !branch.ok) {
    return `Not a git repo or git error: ${status.output}`;
  }
  return `Branch: ${branch.output}\n${status.output || '(clean)'}`;
}

function gitDiff(args: Record<string, unknown>): string {
  let cwd: string;
  try {
    cwd = resolveCwdArg(args.cwd);
  } catch (e) {
    return (e as SafetyError).message;
  }
  const argv = ['diff'];
  if (args.staged) argv.push('--staged');
  if (args.ref !== undefined) {
    try {
      argv.push(safeRef(args.ref, 'ref'));
    } catch (e) {
      return (e as Error).message;
    }
  }
  argv.push('--stat');
  const result = runGit(argv, { cwd, timeout: 10000 });
  if (!result.ok) return `Git diff error: ${result.output}`;
  return result.output || '(no changes)';
}

function gitLog(args: Record<string, unknown>): string {
  let cwd: string;
  try {
    cwd = resolveCwdArg(args.cwd);
  } catch (e) {
    return (e as SafetyError).message;
  }
  const rawCount = (args.count as number) || 10;
  if (!Number.isInteger(rawCount) || rawCount <= 0 || rawCount > 1000) {
    return `Invalid count: ${rawCount}`;
  }
  const oneline = args.oneline !== false;
  const format = oneline ? '--oneline' : '--format=%h %s (%ar) <%an>';
  const result = runGit(['log', format, `-${rawCount}`], { cwd, timeout: 5000 });
  if (!result.ok) return `Git log error: ${result.output}`;
  return result.output || '(no commits)';
}

function gitCommit(args: Record<string, unknown>): string {
  let cwd: string;
  try {
    cwd = resolveCwdArg(args.cwd);
  } catch (e) {
    return (e as SafetyError).message;
  }
  const message = args.message as string;
  if (typeof message !== 'string' || message.length === 0) {
    return 'Missing commit message';
  }
  const addAll = args.addAll !== false;

  if (addAll) {
    const addResult = runGit(['add', '-A'], { cwd, timeout: 5000 });
    if (!addResult.ok) return `Git add error: ${addResult.output}`;
  }
  const commit = runGit(['commit', '-m', message], { cwd, timeout: 10000 });
  if (!commit.ok) return `Git commit error: ${commit.output}`;
  return commit.output;
}

function gitPush(args: Record<string, unknown>): string {
  let cwd: string;
  try {
    cwd = resolveCwdArg(args.cwd);
  } catch (e) {
    return (e as SafetyError).message;
  }
  let remote = 'origin';
  if (args.remote !== undefined) {
    try {
      remote = safeRef(args.remote, 'remote');
    } catch (e) {
      return (e as Error).message;
    }
  }
  let branch: string | undefined;
  if (args.branch !== undefined) {
    try {
      branch = safeRef(args.branch, 'branch');
    } catch (e) {
      return (e as Error).message;
    }
  }
  const argv = branch ? ['push', remote, branch] : ['push', remote];
  const result = runGit(argv, { cwd, timeout: 30000 });
  if (result.ok) return result.output || 'Push successful';
  // git push prints success messages to stderr; treat output containing "->"
  // as informational rather than an error.
  if (result.output.includes('->')) return result.output;
  return `Git push error: ${result.output}`;
}
