/**
 * Claude Code Bridge — invoke Claude Code as a tool from Bobo CLI.
 *
 * Architecture:
 * - Bobo CLI decides WHAT to do (skill routing, planning, memory)
 * - Claude Code does the HEAVY LIFTING (large refactors, long chains, testing)
 * - Results flow back to Bobo CLI for tracking and memory
 *
 * Delegation rules:
 * - Simple edits → Bobo's own tools
 * - Complex multi-file refactors → Claude Code
 * - Long-running tasks → Claude Code
 * - Tasks needing browser/visual → Claude Code
 * - Skill routing / planning → Bobo keeps
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { ChatCompletionTool } from 'openai/resources/index.js';
import { runProgram, safeResolvePath, SafetyError } from './safety.js';

// ─── Safety constants ────────────────────────────────────────

/** Env var bobo sets when delegating, so a nested bobo agent can detect recursion. */
const DELEGATION_ENV = 'BOBO_DELEGATION_DEPTH';
/** Maximum nested delegation depth. 0 = top-level bobo, 1 = bobo → claude → bobo allowed once. */
const MAX_DELEGATION_DEPTH = 1;
/** Output truncated past this many chars before being returned to the LLM. */
const MAX_OUTPUT_CHARS = 60_000;
/** Exec hard limit — execFile rejects past this. Larger than MAX_OUTPUT_CHARS to give us slack to truncate. */
const EXEC_MAX_BUFFER = 5 * 1024 * 1024;

const MODEL_RE = /^[A-Za-z0-9._-]+$/;
const ALLOWED_TOOLS_RE = /^[A-Za-z0-9_,]+$/;
const SESSION_ID_RE = /^cc-\d+$/;

function getDelegationDepth(): number {
  const raw = process.env[DELEGATION_ENV];
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function nextDelegationEnv(): Record<string, string> {
  return { [DELEGATION_ENV]: String(getDelegationDepth() + 1) };
}

function truncateOutput(s: string): string {
  if (s.length <= MAX_OUTPUT_CHARS) return s;
  const head = s.slice(0, MAX_OUTPUT_CHARS);
  const dropped = s.length - MAX_OUTPUT_CHARS;
  return `${head}\n\n... (truncated ${dropped} chars; raise --max-output or split the task)`;
}

function validateModel(v: unknown): string | undefined {
  if (v === undefined || v === '' || v === null) return undefined;
  if (typeof v !== 'string') throw new SafetyError('model must be a string');
  if (!MODEL_RE.test(v)) throw new SafetyError(`model contains disallowed chars: ${v}`);
  return v;
}

function validateAllowedTools(v: unknown): string | undefined {
  if (v === undefined || v === '' || v === null) return undefined;
  if (typeof v !== 'string') throw new SafetyError('allowedTools must be a string');
  if (!ALLOWED_TOOLS_RE.test(v)) throw new SafetyError(`allowedTools must be comma-separated identifiers: ${v}`);
  return v;
}

// ─── Tool Definitions ────────────────────────────────────────

export const claudeCodeToolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'claude_code',
      description: `Delegate a task to Claude Code (the Anthropic CLI coding agent). Use for:
- Large multi-file refactors (10+ files)
- Complex test writing and debugging
- Long-running autonomous coding tasks
- Tasks that need deep codebase understanding
- When Bobo's own tools are insufficient

Claude Code runs in --print mode and returns the result.
Do NOT use for simple single-file edits — use edit_file instead.`,
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Task description for Claude Code' },
          cwd: { type: 'string', description: 'Working directory (default: CWD)' },
          model: { type: 'string', description: 'Model override (default: claude-sonnet-4-20250514)' },
          allowedTools: {
            type: 'string',
            description: 'Comma-separated tool filter (e.g. "Edit,Write,Bash")',
          },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'claude_code_session',
      description: `Start a persistent Claude Code session for multi-turn complex work.
Returns a session ID. Use claude_code_send to continue the conversation.
Use for iterative development that needs multiple rounds.`,
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Initial task for the session' },
          cwd: { type: 'string', description: 'Working directory' },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'claude_code_send',
      description: 'Send a follow-up message to a persistent Claude Code session.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session ID from claude_code_session' },
          message: { type: 'string', description: 'Follow-up message' },
        },
        required: ['sessionId', 'message'],
      },
    },
  },
];

// ─── Claude Code Detection ───────────────────────────────────

let claudeCodePath: string | null = null;

function findClaudeCode(): string | null {
  if (claudeCodePath !== null) return claudeCodePath || null;

  // Cross-platform PATH lookup via execFile (NOT shell interpolation).
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  for (const cmd of ['claude', 'claude-code']) {
    const result = runProgram(lookup, [cmd], { timeout: 3000 });
    if (result.ok && result.output.trim().length > 0) {
      claudeCodePath = cmd;
      return cmd;
    }
  }
  claudeCodePath = '';
  return null;
}

export function isClaudeCodeAvailable(): boolean {
  return !!findClaudeCode();
}

// ─── Session Management ──────────────────────────────────────

interface ClaudeSession {
  id: string;
  process: ChildProcess;
  output: string[];
  startedAt: number;
}

const sessions = new Map<string, ClaudeSession>();
let sessionCounter = 1;

// ─── Implementations ─────────────────────────────────────────

function claudeCodeRun(args: Record<string, unknown>): string {
  const cmd = findClaudeCode();
  if (!cmd) {
    return 'Claude Code not found. Install it: npm install -g @anthropic-ai/claude-code';
  }

  // Recursion guard — refuse to delegate if we are already deep in a delegation chain.
  if (getDelegationDepth() >= MAX_DELEGATION_DEPTH) {
    return `claude_code blocked: delegation depth ${getDelegationDepth()} reached (max ${MAX_DELEGATION_DEPTH}). Refusing to nest further.`;
  }

  const task = args.task;
  if (typeof task !== 'string' || task.length === 0) {
    return 'claude_code blocked: task must be a non-empty string';
  }

  let cwd: string;
  let model: string | undefined;
  let allowedTools: string | undefined;
  try {
    cwd = args.cwd ? safeResolvePath(args.cwd) : process.cwd();
    model = validateModel(args.model);
    allowedTools = validateAllowedTools(args.allowedTools);
  } catch (e) {
    return `claude_code blocked: ${(e as SafetyError).message}`;
  }

  // Argv array — never a shell string. Task goes through stdin via execFile's `input`
  // option so it can contain quotes, backticks, $(), and other shell metachars safely.
  const argv: string[] = ['--print'];
  if (model) argv.push('--model', model);
  if (allowedTools) argv.push('--allowedTools', allowedTools);
  argv.push(task);

  const result = runProgram(cmd, argv, {
    cwd,
    timeout: 300_000,
    maxBuffer: EXEC_MAX_BUFFER,
    env: { ...process.env, ...nextDelegationEnv() },
  });

  if (!result.ok) {
    const body = truncateOutput(result.output || `exit ${result.status ?? 'unknown'}`);
    return `Claude Code error (exit ${result.status ?? 'unknown'}):\n${body}`;
  }
  return truncateOutput(result.output) || '(no output)';
}

function claudeCodeSession(args: Record<string, unknown>): string {
  const cmd = findClaudeCode();
  if (!cmd) {
    return 'Claude Code not found. Install it: npm install -g @anthropic-ai/claude-code';
  }

  if (getDelegationDepth() >= MAX_DELEGATION_DEPTH) {
    return `claude_code_session blocked: delegation depth ${getDelegationDepth()} reached (max ${MAX_DELEGATION_DEPTH}).`;
  }

  const task = args.task;
  if (typeof task !== 'string' || task.length === 0) {
    return 'claude_code_session blocked: task must be a non-empty string';
  }

  let cwd: string;
  try {
    cwd = args.cwd ? safeResolvePath(args.cwd) : process.cwd();
  } catch (e) {
    return `claude_code_session blocked: ${(e as SafetyError).message}`;
  }

  const id = `cc-${sessionCounter++}`;

  // shell:false — claude is invoked directly via PATH, no shell interpolation.
  const child = spawn(cmd, ['--verbose'], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env, ...nextDelegationEnv() },
  });

  const session: ClaudeSession = {
    id,
    process: child,
    output: [],
    startedAt: Date.now(),
  };

  const appendOutput = (data: Buffer) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        session.output.push(line);
        if (session.output.length > 500) session.output.shift();
      }
    }
  };

  child.stdout?.on('data', appendOutput);
  child.stderr?.on('data', appendOutput);

  child.stdin?.write(task + '\n');

  sessions.set(id, session);
  return `Claude Code session started: ${id}\nSent initial task. Use claude_code_send("${id}", "message") to continue.`;
}

async function claudeCodeSend(args: Record<string, unknown>): Promise<string> {
  const sessionId = args.sessionId;
  const message = args.message;

  if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
    return `Invalid sessionId: must match ${SESSION_ID_RE.source}`;
  }
  if (typeof message !== 'string' || message.length === 0) {
    return 'message must be a non-empty string';
  }

  const session = sessions.get(sessionId);
  if (!session) return `Session "${sessionId}" not found.`;

  session.process.stdin?.write(message + '\n');

  await new Promise<void>((resolve) => setTimeout(resolve, 3000));
  const recent = session.output.slice(-30).join('\n');
  return truncateOutput(recent) || '(waiting for response...)';
}

// ─── Executor ────────────────────────────────────────────────

export function isClaudeCodeTool(name: string): boolean {
  return ['claude_code', 'claude_code_session', 'claude_code_send'].includes(name);
}

export function executeClaudeCodeTool(name: string, args: Record<string, unknown>): string | Promise<string> {
  switch (name) {
    case 'claude_code': return claudeCodeRun(args);
    case 'claude_code_session': return claudeCodeSession(args);
    case 'claude_code_send': return claudeCodeSend(args);
    default: return `Unknown tool: ${name}`;
  }
}

// ─── Delegation Intelligence ─────────────────────────────────

export interface DelegationDecision {
  target: 'bobo' | 'claude-code';
  reason: string;
  confidence: number;
}

/**
 * Decide whether a task should be handled by Bobo or delegated to Claude Code.
 */
export function shouldDelegate(taskDescription: string): DelegationDecision {
  const lower = taskDescription.toLowerCase();

  // Claude Code indicators (heavy engineering tasks)
  const ccIndicators = [
    { pattern: /refactor|重构/i, weight: 0.4 },
    { pattern: /test|测试|spec|写.*测试|测试.*套件/i, weight: 0.4 },
    { pattern: /migrate|迁移/i, weight: 0.5 },
    { pattern: /全部|所有文件|整个项目|entire|whole project/i, weight: 0.5 },
    { pattern: /debug.*complex|复杂.*调试/i, weight: 0.4 },
    { pattern: /performance|性能优化/i, weight: 0.3 },
    { pattern: /从头.*写|write.*from scratch|scaffold|搭建.*项目|create.*project/i, weight: 0.5 },
    { pattern: /ci\/?cd|pipeline|部署|deploy/i, weight: 0.3 },
    { pattern: /\d{2,}\s*(files?|个文件)/i, weight: 0.5 }, // "20 files"
    { pattern: /完整.*套件|full.*suite|comprehensive/i, weight: 0.4 },
    { pattern: /大规模|large.?scale|批量.*改/i, weight: 0.4 },
  ];

  // Bobo indicators (planning, skills, routing tasks)
  const boboIndicators = [
    { pattern: /解释|explain|分析|analyze/i, weight: 0.4 },
    { pattern: /记住|remember|记忆/i, weight: 0.5 },
    { pattern: /计划|plan|方案|strategy/i, weight: 0.4 },
    { pattern: /搜索|search|查找/i, weight: 0.3 },
    { pattern: /简单|single file|一个文件/i, weight: 0.4 },
    { pattern: /skill|技能|路由/i, weight: 0.5 },
    { pattern: /seo|关键词|keyword/i, weight: 0.4 },
    { pattern: /总结|summarize|汇报/i, weight: 0.4 },
  ];

  let ccScore = 0;
  let boboScore = 0;
  const reasons: string[] = [];

  for (const ind of ccIndicators) {
    if (ind.pattern.test(lower)) {
      ccScore += ind.weight;
      reasons.push(`CC: ${ind.pattern.source}`);
    }
  }

  for (const ind of boboIndicators) {
    if (ind.pattern.test(lower)) {
      boboScore += ind.weight;
      reasons.push(`Bobo: ${ind.pattern.source}`);
    }
  }

  // If Claude Code isn't even available, always use Bobo
  if (!isClaudeCodeAvailable()) {
    return { target: 'bobo', reason: 'Claude Code not installed', confidence: 1.0 };
  }

  if (ccScore > boboScore && ccScore > 0.3) {
    return {
      target: 'claude-code',
      reason: reasons.filter(r => r.startsWith('CC')).join(', '),
      confidence: Math.min(ccScore, 1.0),
    };
  }

  return {
    target: 'bobo',
    reason: reasons.filter(r => r.startsWith('Bobo')).join(', ') || 'default',
    confidence: Math.max(boboScore, 0.5),
  };
}

/**
 * Cleanup all Claude Code sessions.
 */
export function cleanupClaudeSessions(): void {
  for (const [, session] of sessions) {
    try { session.process.kill(); } catch (_) { /* intentionally ignored: process already dead */ }
  }
  sessions.clear();
}
