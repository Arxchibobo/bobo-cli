/**
 * Sub-agent management — spawn, list, show background agents.
 */

import { fork, type ChildProcess } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfigDir } from './config.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MAX_CONCURRENT = 3;

interface SubAgentTask {
  id: string;
  task: string;
  cwd: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  result?: string;
  error?: string;
  pid?: number;
}

// Track running processes in memory
const runningAgents: Map<string, ChildProcess> = new Map();

function getAgentsDir(): string {
  return join(getConfigDir(), 'agents');
}

function ensureAgentsDir(): void {
  const dir = getAgentsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Spawn a new sub-agent to run a task in the background.
 */
export function spawnSubAgent(task: string): { id: string; error?: string } {
  ensureAgentsDir();

  // Check concurrent limit
  const running = listSubAgents().filter(a => a.status === 'running');
  if (running.length >= MAX_CONCURRENT) {
    return { id: '', error: `Max ${MAX_CONCURRENT} concurrent sub-agents. Wait for one to finish or check /agents.` };
  }

  const id = `agent-${Date.now().toString(36)}`;
  const taskFile = join(getAgentsDir(), `${id}.json`);

  const taskData: SubAgentTask = {
    id,
    task,
    cwd: process.cwd(),
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  writeFileSync(taskFile, JSON.stringify(taskData, null, 2));

  // Fork the sub-agent runner
  const runnerPath = join(__dirname, 'sub-agent-runner.js');
  try {
    const child = fork(runnerPath, [taskFile], {
      stdio: 'ignore',
      detached: true,
    });

    taskData.pid = child.pid;
    writeFileSync(taskFile, JSON.stringify(taskData, null, 2));

    child.on('exit', (code) => {
      runningAgents.delete(id);
      // Re-read to get result
      try {
        const updated: SubAgentTask = JSON.parse(readFileSync(taskFile, 'utf-8'));
        if (updated.status === 'running') {
          updated.status = code === 0 ? 'completed' : 'failed';
          updated.completedAt = new Date().toISOString();
          if (code !== 0 && !updated.error) updated.error = `Exited with code ${code}`;
          writeFileSync(taskFile, JSON.stringify(updated, null, 2));
        }
      } catch { /* file may be already updated */ }
    });

    child.unref();
    runningAgents.set(id, child);

    return { id };
  } catch (e) {
    taskData.status = 'failed';
    taskData.error = (e as Error).message;
    writeFileSync(taskFile, JSON.stringify(taskData, null, 2));
    return { id, error: (e as Error).message };
  }
}

/**
 * List all sub-agents (recent first).
 */
export function listSubAgents(limit = 20): SubAgentTask[] {
  ensureAgentsDir();
  const dir = getAgentsDir();

  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit)
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf-8')) as SubAgentTask;
      } catch {
        return null;
      }
    })
    .filter((a): a is SubAgentTask => a !== null);
}

/**
 * Get a specific sub-agent by ID.
 */
export function getSubAgent(id: string): SubAgentTask | null {
  const path = join(getAgentsDir(), `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}
