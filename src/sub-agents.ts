/**
 * Sub-agent management — spawn, list, show background agents.
 * Enhanced with role-based isolation (explore/plan/worker/verify).
 */

import { fork, type ChildProcess } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfigDir } from './config.js';
import { AGENT_CATALOG } from './agents/catalog.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MAX_CONCURRENT = 3;

/**
 * Agent role types with different permission levels.
 * - explore: Read-only exploration (read_file, list_directory, search_files, shell with restrictions)
 * - plan: Read-only planning mode (outputs task plans but cannot modify files)
 * - worker: Full tool permissions (but injected with anti-recursion prompt)
 * - verify: Uses verification-agent logic to validate work
 */
export type AgentRole = 'explore' | 'plan' | 'worker' | 'verify';

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
  role?: AgentRole; // Role-based permission level
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
 * Get allowed tools for a specific role.
 */
export function getAllowedToolsForRole(role: AgentRole): string[] {
  switch (role) {
    case 'explore':
      // Read-only tools for exploration
      return [
        'read_file',
        'list_directory',
        'search_files',
        'git_status',
        'git_diff',
        'git_log',
        'search_memory',
      ];

    case 'plan':
      // Read-only + planning tools
      return [
        'read_file',
        'list_directory',
        'search_files',
        'git_status',
        'git_diff',
        'git_log',
        'search_memory',
      ];

    case 'worker':
      // Full access (but will be injected with anti-recursion prompt)
      return ['*']; // All tools allowed

    case 'verify':
      // Verification tools
      return [
        'read_file',
        'list_directory',
        'search_files',
        'shell', // For running build/test/lint
        'git_status',
        'git_diff',
      ];

    default:
      return [];
  }
}

/**
 * Get role-specific system prompt injection.
 */
export function getRolePromptInjection(role: AgentRole): string {
  // Try to use catalog-based prompts first for richer role definitions
  const catalogRole = role === 'worker' ? 'executor' : role === 'plan' ? 'planner' : role === 'verify' ? 'verifier' : role;
  const catalogAgent = AGENT_CATALOG[catalogRole as keyof typeof AGENT_CATALOG];
  const catalogContext = catalogAgent
    ? `\n\n## Catalog Context\n- Role: ${catalogAgent.role}\n- Description: ${catalogAgent.description}\n- Use cases: ${catalogAgent.useCases.join(', ')}\n- Boundaries: ${catalogAgent.boundaries.join(', ')}`
    : '';

  switch (role) {
    case 'explore':
      return `
# Role: Explorer Agent

You are an exploration agent with READ-ONLY access. Your job is to:
- Read and analyze files
- Search for patterns and information
- Report findings clearly

You CANNOT:
- Modify any files (write_file, edit_file)
- Execute arbitrary shell commands
- Create or delete files
- Make git commits

Focus on gathering information and presenting it clearly.${catalogContext}`;

    case 'plan':
      return `
# Role: Planning Agent

You are a planning agent with READ-ONLY access. Your job is to:
- Analyze the codebase and requirements
- Create detailed task breakdowns
- Identify dependencies and risks
- Propose implementation approaches

You CANNOT:
- Modify any files
- Execute code changes
- Make commits

Output a structured plan with:
1. Tasks broken down into steps
2. File paths that need changes
3. Potential risks or blockers
4. Estimated complexity${catalogContext}`;

    case 'worker':
      return `
# Role: Worker Agent

You are a worker agent with FULL tool access. Your job is to:
- Execute tasks efficiently
- Make file changes as needed
- Run tests and verify your work
- Report completion status

CRITICAL CONSTRAINTS:
- You are a WORKER, not a manager
- NEVER spawn sub-agents or delegate work
- Execute tasks directly yourself
- If you encounter blockers, report them immediately

Focus on DOING the work, not planning or delegating.${catalogContext}`;

    case 'verify':
      return `
# Role: Verification Agent

You are a verification agent using 'try to break it' philosophy. Your job is to:
- Run build/test/lint checks
- Probe for edge cases and boundary conditions
- Test actual functionality (API calls, CLI commands)
- Report honest assessment

You SHOULD:
- Be adversarial - try to find what's broken
- Run all available verification steps
- Test with unusual inputs
- Check for security issues

You MUST:
- Return VERDICT: PASS / FAIL / PARTIAL
- Provide specific evidence for failures
- Suggest concrete fixes${catalogContext}`;

    default:
      return '';
  }
}

/**
 * Spawn a new sub-agent to run a task in the background.
 */
export function spawnSubAgent(task: string, role: AgentRole = 'worker'): { id: string; error?: string } {
  ensureAgentsDir();

  // Check concurrent limit
  const running = listSubAgents().filter(a => a.status === 'running');
  if (running.length >= MAX_CONCURRENT) {
    return { id: '', error: `Max ${MAX_CONCURRENT} concurrent sub-agents. Wait for one to finish or check /agents.` };
  }

  const id = `agent-${Date.now().toString(36)}-${role}`;
  const taskFile = join(getAgentsDir(), `${id}.json`);

  const taskData: SubAgentTask = {
    id,
    task,
    cwd: process.cwd(),
    status: 'running',
    startedAt: new Date().toISOString(),
    role,
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
      } catch (_) { /* intentionally ignored: task file may already be updated by runner */ }
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
      } catch (_) {
        /* intentionally ignored: corrupted agent task file */
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
  } catch (_) {
    /* intentionally ignored: corrupted agent task file */
    return null;
  }
}
