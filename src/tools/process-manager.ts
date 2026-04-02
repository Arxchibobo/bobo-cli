/**
 * Background process manager — persistent processes that survive tool calls.
 * Solves: "没有真正的终端访问" + "工具调用是请求式的"
 *
 * Manages long-running processes (dev servers, watchers, builds)
 * with output capture, health checks, and graceful shutdown.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { ChatCompletionTool } from 'openai/resources/index.js';

interface ManagedProcess {
  id: string;
  command: string;
  process: ChildProcess;
  startedAt: number;
  output: string[];      // Ring buffer of recent output lines
  exitCode: number | null;
  cwd: string;
}

const MAX_OUTPUT_LINES = 200;
const processes = new Map<string, ManagedProcess>();
let nextId = 1;

// ─── Tool Definitions ────────────────────────────────────────

export const processToolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'bg_start',
      description: 'Start a background process (dev server, watcher, build). Process persists across tool calls. Returns process ID.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to run' },
          cwd: { type: 'string', description: 'Working directory (default: CWD)' },
          label: { type: 'string', description: 'Human-readable label (e.g. "dev-server")' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bg_output',
      description: 'Get recent output from a background process. Use to check if a dev server has started, see build errors, etc.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Process ID' },
          lines: { type: 'number', description: 'Number of recent lines (default: 30)' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bg_list',
      description: 'List all running background processes with status.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bg_stop',
      description: 'Stop a background process.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Process ID' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bg_input',
      description: 'Send input/stdin to a running background process.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Process ID' },
          text: { type: 'string', description: 'Text to send to stdin' },
        },
        required: ['id', 'text'],
      },
    },
  },
];

// ─── Implementations ─────────────────────────────────────────

function bgStart(args: Record<string, unknown>): string {
  const command = args.command as string;
  const cwd = args.cwd as string || process.cwd();
  const label = args.label as string || `proc-${nextId}`;

  const id = `bg-${nextId++}`;

  const child = spawn(command, [], {
    cwd,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  });

  const managed: ManagedProcess = {
    id,
    command: label !== `proc-${nextId - 1}` ? `${label} (${command})` : command,
    process: child,
    startedAt: Date.now(),
    output: [],
    exitCode: null,
    cwd,
  };

  const appendOutput = (data: Buffer) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        managed.output.push(line);
        if (managed.output.length > MAX_OUTPUT_LINES) {
          managed.output.shift();
        }
      }
    }
  };

  child.stdout?.on('data', appendOutput);
  child.stderr?.on('data', appendOutput);

  child.on('close', (code) => {
    managed.exitCode = code;
  });

  child.on('error', (err) => {
    managed.output.push(`[ERROR] ${err.message}`);
    managed.exitCode = -1;
  });

  processes.set(id, managed);
  return `Started background process: ${id}\nCommand: ${command}\nCWD: ${cwd}\n\nUse bg_output("${id}") to check output.`;
}

function bgOutput(args: Record<string, unknown>): string {
  const id = args.id as string;
  const lines = (args.lines as number) || 30;

  const proc = processes.get(id);
  if (!proc) return `Process "${id}" not found. Use bg_list to see active processes.`;

  const isRunning = proc.exitCode === null;
  const elapsed = Math.round((Date.now() - proc.startedAt) / 1000);

  const recentLines = proc.output.slice(-lines);
  const header = `Process: ${id} (${isRunning ? 'RUNNING' : `EXITED ${proc.exitCode}`}) [${elapsed}s]\n`;

  if (recentLines.length === 0) {
    return header + '(no output yet)';
  }

  return header + recentLines.join('\n');
}

function bgList(): string {
  if (processes.size === 0) return 'No background processes running.';

  const lines: string[] = ['Background Processes:'];
  for (const [id, proc] of processes) {
    const isRunning = proc.exitCode === null;
    const elapsed = Math.round((Date.now() - proc.startedAt) / 1000);
    const status = isRunning ? '● RUNNING' : `✗ EXITED(${proc.exitCode})`;
    lines.push(`  ${id}: ${status} [${elapsed}s] ${proc.command.slice(0, 60)}`);
  }
  return lines.join('\n');
}

function bgStop(args: Record<string, unknown>): string {
  const id = args.id as string;
  const proc = processes.get(id);
  if (!proc) return `Process "${id}" not found.`;

  if (proc.exitCode === null) {
    proc.process.kill('SIGTERM');
    // Force kill after 3s
    setTimeout(() => {
      try { proc.process.kill('SIGKILL'); } catch { /* already dead */ }
    }, 3000);
  }

  const lastOutput = proc.output.slice(-5).join('\n');
  processes.delete(id);
  return `Stopped ${id}.\nLast output:\n${lastOutput}`;
}

function bgInput(args: Record<string, unknown>): string {
  const id = args.id as string;
  const text = args.text as string;
  const proc = processes.get(id);
  if (!proc) return `Process "${id}" not found.`;
  if (proc.exitCode !== null) return `Process "${id}" has already exited.`;

  proc.process.stdin?.write(text + '\n');
  return `Sent to ${id}: ${text}`;
}

// ─── Executor ────────────────────────────────────────────────

export function isProcessTool(name: string): boolean {
  return ['bg_start', 'bg_output', 'bg_list', 'bg_stop', 'bg_input'].includes(name);
}

export function executeProcessTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'bg_start': return bgStart(args);
    case 'bg_output': return bgOutput(args);
    case 'bg_list': return bgList();
    case 'bg_stop': return bgStop(args);
    case 'bg_input': return bgInput(args);
    default: return `Unknown process tool: ${name}`;
  }
}

/**
 * Kill all background processes. Called on exit.
 */
export function killAllProcesses(): void {
  for (const [, proc] of processes) {
    if (proc.exitCode === null) {
      try { proc.process.kill('SIGTERM'); } catch { /* ignore */ }
    }
  }
  processes.clear();
}
