/**
 * Sub-agent runner — standalone script that runs as a child process.
 * Usage: node dist/sub-agent-runner.js <taskFile>
 * Reads task from JSON file, runs agent loop, writes result back.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { runAgent } from './agent.js';

interface SubAgentTask {
  id: string;
  task: string;
  cwd: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  result?: string;
  error?: string;
}

async function main(): Promise<void> {
  const taskFile = process.argv[2];
  if (!taskFile) {
    process.exit(1);
  }

  let taskData: SubAgentTask;
  try {
    taskData = JSON.parse(readFileSync(taskFile, 'utf-8'));
  } catch {
    process.exit(1);
  }

  // Change to task's cwd
  try {
    process.chdir(taskData.cwd);
  } catch { /* stay in current dir */ }

  try {
    const result = await runAgent(taskData.task, []);
    taskData.status = 'completed';
    taskData.result = result.response;
  } catch (e) {
    taskData.status = 'failed';
    taskData.error = (e as Error).message;
  }

  writeFileSync(taskFile, JSON.stringify(taskData, null, 2));
}

main().catch(() => process.exit(1));
