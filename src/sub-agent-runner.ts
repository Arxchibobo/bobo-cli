/**
 * Sub-agent runner — standalone script that runs as a child process.
 * Usage: node dist/sub-agent-runner.js <taskFile>
 * Reads task from JSON file, runs agent loop, writes result back.
 * Enhanced with role-based tool filtering and prompt injection.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { runAgent } from './agent.js';
import { runVerification, formatVerificationResult } from './verification-agent.js';
import type { AgentRole } from './sub-agents.js';
import { getRolePromptInjection } from './sub-agents.js';

interface SubAgentTask {
  id: string;
  task: string;
  cwd: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  result?: string;
  error?: string;
  role?: AgentRole;
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
    const role = taskData.role || 'worker';

    if (role === 'verify') {
      // Special handling for verification agents
      const verificationResult = await runVerification(taskData.task, '', { cwd: taskData.cwd });
      taskData.status = verificationResult.verdict === 'FAIL' ? 'failed' : 'completed';
      taskData.result = formatVerificationResult(verificationResult);
    } else {
      // Inject role-specific prompt
      const rolePrompt = getRolePromptInjection(role);
      const enhancedTask = rolePrompt ? `${rolePrompt}\n\n---\n\n${taskData.task}` : taskData.task;

      const result = await runAgent(enhancedTask, [], { quiet: true });
      taskData.status = 'completed';
      taskData.result = result.response;
    }
  } catch (e) {
    taskData.status = 'failed';
    taskData.error = (e as Error).message;
  }

  writeFileSync(taskFile, JSON.stringify(taskData, null, 2));
}

main().catch(() => process.exit(1));
