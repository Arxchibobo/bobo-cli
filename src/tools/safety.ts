/**
 * Shared safety layer for tool execution.
 *
 * Single source of truth for:
 *   - Path containment (cross-platform, no string-prefix hacks)
 *   - Shell command pattern blocklist
 *   - Git invocation via execFile (never via shell)
 *
 * Every tool that touches the filesystem or the shell MUST go through
 * one of these functions. The previous design enumerated tool names in
 * a switch statement, which silently failed-open whenever a new sibling
 * tool (multi_edit, batch_write, bg_start, ...) was added.
 */

import { resolve, relative, isAbsolute } from 'node:path';
import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';

export class SafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafetyError';
  }
}

export interface ValidatePathOptions {
  /** Base directory to enforce containment under. Defaults to process.cwd(). */
  base?: string;
  /** Allow paths outside `base` (escape hatch — use sparingly). */
  allowOutside?: boolean;
}

export interface ValidatePathResult {
  /** Absolute, normalized path. */
  resolved: string;
}

/**
 * Validate and resolve a user-supplied path. Throws SafetyError on rejection.
 *
 * Cross-platform containment: uses `path.relative(base, resolved)` and
 * checks that the relative path neither starts with `..` (escapes upward)
 * nor is absolute (different drive on Windows, or unrelated root on POSIX).
 * This works correctly for `C:\…`, `\\server\share`, and POSIX `/etc/…`
 * — all of which the previous `startsWith('/')` heuristic missed.
 */
export function validatePath(p: unknown, opts: ValidatePathOptions = {}): ValidatePathResult {
  if (typeof p !== 'string') {
    throw new SafetyError('Path must be a string');
  }
  if (p.length === 0) {
    throw new SafetyError('Path is empty');
  }
  if (p.includes('\0')) {
    throw new SafetyError('Path contains null bytes');
  }

  const base = resolve(opts.base ?? process.cwd());
  const resolved = resolve(base, p);

  if (opts.allowOutside) {
    return { resolved };
  }

  // Containment check that works on POSIX, Windows, and UNC paths.
  if (resolved !== base) {
    const rel = relative(base, resolved);
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
      throw new SafetyError(`Path escapes working directory: ${p}`);
    }
  }

  return { resolved };
}

/**
 * Convenience wrapper that returns the resolved path string directly,
 * matching the shape of the old `resolvePath()` helper that callers used.
 * Throws SafetyError on rejection (callers should catch and convert to
 * a tool error string).
 */
export function safeResolvePath(p: unknown, opts: ValidatePathOptions = {}): string {
  return validatePath(p, opts).resolved;
}

// ─── Shell command validation ────────────────────────────────

interface DangerousPattern {
  pattern: RegExp;
  reason: string;
}

const DANGEROUS_SHELL_PATTERNS: DangerousPattern[] = [
  { pattern: /rm\s+-rf\s+\/(?:\s|$)/, reason: 'rm -rf / blocked' },
  { pattern: /rm\s+-rf\s+~/, reason: 'rm -rf ~ blocked' },
  { pattern: /rm\s+-rf\s+\$HOME/, reason: 'rm -rf $HOME blocked' },
  { pattern: /mkfs/, reason: 'mkfs blocked' },
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: 'Fork bomb blocked' },
  { pattern: /curl\s.*\|\s*(bash|sh|zsh)/, reason: 'Pipe-to-shell blocked' },
  { pattern: /wget\s.*\|\s*(bash|sh|zsh)/, reason: 'Pipe-to-shell blocked' },
  { pattern: /curl\s.*\|\s*sudo/, reason: 'Pipe-to-sudo blocked' },
  { pattern: /wget\s.*\|\s*sudo/, reason: 'Pipe-to-sudo blocked' },
  { pattern: /chmod\s+777/, reason: 'chmod 777 blocked' },
  { pattern: /dd\s+if=/, reason: 'dd blocked (disk destruction risk)' },
  { pattern: />\s*\/dev\/sd[a-z]/, reason: 'Direct disk write blocked' },
  { pattern: /\bshutdown\b/, reason: 'shutdown blocked' },
  { pattern: /\breboot\b/, reason: 'reboot blocked' },
  { pattern: /\bhalt\b/, reason: 'halt blocked' },
  { pattern: /\bpkill\b/, reason: 'pkill blocked' },
  { pattern: /\bkillall\b/, reason: 'killall blocked' },
];

/**
 * Reject obviously destructive shell commands. Throws SafetyError on rejection.
 * Note: this is a pattern blocklist, not a sandbox — anything that runs a
 * shell can ultimately be subverted. Keep it tight, but rely on it as
 * defence-in-depth, not a security boundary.
 */
export function validateShellCommand(cmd: unknown): string {
  if (typeof cmd !== 'string') {
    throw new SafetyError('Command must be a string');
  }
  if (cmd.length === 0) {
    throw new SafetyError('Command is empty');
  }
  for (const { pattern, reason } of DANGEROUS_SHELL_PATTERNS) {
    if (pattern.test(cmd)) {
      throw new SafetyError(`Dangerous command blocked: ${reason}`);
    }
  }
  return cmd;
}

// ─── Git invocation ──────────────────────────────────────────

export interface RunGitOptions {
  cwd?: string;
  /** Milliseconds before the child is killed. Default 15 000. */
  timeout?: number;
  /** Stdin to pipe to git (used by `git apply` etc). */
  input?: string | Buffer;
}

export interface RunGitResult {
  ok: boolean;
  /** Combined stdout (if ok) or merged stderr+stdout (if not ok). */
  output: string;
  /** Exit code (only meaningful when ok=false). */
  status?: number;
}

/**
 * Invoke `git` with an arg array — never via the shell, never with string
 * interpolation. Captures stdout/stderr and returns a uniform result shape.
 */
export function runGit(args: string[], opts: RunGitOptions = {}): RunGitResult {
  const execOpts: ExecFileSyncOptions = {
    cwd: opts.cwd ?? process.cwd(),
    encoding: 'utf-8',
    timeout: opts.timeout ?? 15000,
    stdio: ['pipe', 'pipe', 'pipe'],
  };
  if (opts.input !== undefined) {
    execOpts.input = opts.input;
  }

  try {
    const out = execFileSync('git', args, execOpts);
    const text = typeof out === 'string' ? out : out.toString('utf-8');
    return { ok: true, output: text.trim() };
  } catch (e: unknown) {
    const err = e as { stdout?: string | Buffer; stderr?: string | Buffer; status?: number; message?: string };
    const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf-8') ?? '';
    const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf-8') ?? '';
    const merged = `${stderr}\n${stdout}`.trim();
    return {
      ok: false,
      output: merged || (err.message ?? 'git failed'),
      status: err.status,
    };
  }
}

// ─── Generic execFile wrapper ────────────────────────────────

/**
 * Invoke an external program with an arg array (no shell). Use this in
 * place of `execSync(\`prog ${arg}\`)` to avoid command injection.
 */
export function runProgram(
  program: string,
  args: string[],
  opts: ExecFileSyncOptions = {},
): RunGitResult {
  const merged: ExecFileSyncOptions = {
    encoding: 'utf-8',
    timeout: 15000,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  };
  try {
    const out = execFileSync(program, args, merged);
    const text = typeof out === 'string' ? out : out.toString('utf-8');
    return { ok: true, output: text.trim() };
  } catch (e: unknown) {
    const err = e as { stdout?: string | Buffer; stderr?: string | Buffer; status?: number; message?: string };
    const stdout = typeof err.stdout === 'string' ? err.stdout : err.stdout?.toString('utf-8') ?? '';
    const stderr = typeof err.stderr === 'string' ? err.stderr : err.stderr?.toString('utf-8') ?? '';
    const out = `${stderr}\n${stdout}`.trim();
    return {
      ok: false,
      output: out || (err.message ?? `${program} failed`),
      status: err.status,
    };
  }
}
