import { writePlan, writePRD, writeTeam } from '../state/artifacts.js';
import { addWorkflow, updateWorkflow, removeWorkflow, type WorkflowState } from '../state/manager.js';
import { routeTaskWithReason, type AgentRole } from '../agents/router.js';
import { spawnAgent, spawnAgentTeam } from '../agents/spawn.js';

function nowId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

export interface TeamRunResult {
  workflowId: string;
  role: AgentRole;
  teamSize: number;
  planPath: string;
  prdPath: string;
  teamPath: string;
  summary: string;
  agentIds: string[];
}

/**
 * Real team workflow execution using agent spawning
 *
 * Pipeline: plan → prd → parallel execution → verify
 */
export async function runTeamWorkflow(task: string, teamSize: number, requestedRole?: AgentRole, sessionId = 'cli'): Promise<TeamRunResult> {
  const workflowId = nowId('team');
  const route = routeTaskWithReason(task);
  const role = requestedRole ?? route.role;

  const workflow: WorkflowState = {
    workflowId,
    type: 'team',
    status: 'running',
    startedAt: new Date().toISOString(),
    sessionId,
    metadata: { task, teamSize, role, routeReason: route.reason },
  };
  addWorkflow(workflow);

  const agentIds: string[] = [];

  try {
    // Stage 1: Planning
    const plannerResult = await spawnAgent({
      task: `Create a detailed execution plan for: ${task}`,
      role: 'planner',
      cwd: process.cwd(),
    });

    if (plannerResult.error) {
      throw new Error(`Planner failed: ${plannerResult.error}`);
    }
    agentIds.push(plannerResult.id);

    const planContent = `# Team Plan\n\n- Task: ${task}\n- Team size: ${teamSize}\n- Role: ${role}\n- Route reason: ${route.reason}\n\n## Planning Agent\nAgent ID: ${plannerResult.id}\nStatus: Spawned in background\n\n## Stages\n1. ✓ Plan created\n2. PRD generation\n3. Parallel execution\n4. Verification\n5. Fix (if needed)\n`;

    // Stage 2: PRD (Product Requirements Document)
    const prdResult = await spawnAgent({
      task: `Based on the plan, write a clear PRD for: ${task}`,
      role: 'planner',
      cwd: process.cwd(),
    });

    if (prdResult.error) {
      throw new Error(`PRD generation failed: ${prdResult.error}`);
    }
    agentIds.push(prdResult.id);

    const prdContent = `# Team PRD\n\n## Goal\n${task}\n\n## Execution Lane\n- Primary role: ${role}\n- Workers: ${teamSize}\n- Model hint: ${route.model}\n\n## PRD Agent\nAgent ID: ${prdResult.id}\nStatus: Spawned in background\n`;

    // Stage 3: Parallel execution with multiple workers
    const workerRequests = Array.from({ length: teamSize }, (_, i) => ({
      task: `Execute subtask ${i + 1}/${teamSize} of: ${task}\n\nYou are worker ${i + 1} in a team of ${teamSize}. Focus on your portion of the work.`,
      role,
      cwd: process.cwd(),
    }));

    const workerResults = await spawnAgentTeam(workerRequests);
    const successfulWorkers = workerResults.filter(r => !r.error);
    const failedWorkers = workerResults.filter(r => r.error);

    agentIds.push(...successfulWorkers.map(w => w.id));

    // Stage 4: Verification
    const verifyResult = await spawnAgent({
      task: `Verify that the following task was completed correctly: ${task}\n\nWorkers spawned: ${successfulWorkers.length}/${teamSize}`,
      role: 'verifier',
      cwd: process.cwd(),
    });

    if (verifyResult.error) {
      throw new Error(`Verification failed: ${verifyResult.error}`);
    }
    agentIds.push(verifyResult.id);

    const summary = `Team workflow: ${successfulWorkers.length}/${teamSize} workers spawned for ${role} role`;

    const teamContent = `# Team Run\n\n${summary}\n\n## Agents Spawned\n\n### Planning\n- Planner: ${plannerResult.id}\n- PRD Writer: ${prdResult.id}\n\n### Execution (${successfulWorkers.length}/${teamSize} successful)\n${successfulWorkers.map((w, i) => `- Worker ${i + 1}: ${w.id}`).join('\n')}${failedWorkers.length > 0 ? `\n\n### Failed Workers\n${failedWorkers.map(w => `- Error: ${w.error}`).join('\n')}` : ''}\n\n### Verification\n- Verifier: ${verifyResult.id}\n\n## Next Steps\n\nCheck agent status with: bobo agents\nView agent output: bobo agent <id>\n`;

    const planPath = writePlan(planContent);
    const prdPath = writePRD(prdContent);
    const teamPath = writeTeam(teamContent);

    updateWorkflow(workflowId, { status: 'completed', completedAt: new Date().toISOString() });

    return { workflowId, role, teamSize, planPath, prdPath, teamPath, summary, agentIds };
  } catch (error) {
    updateWorkflow(workflowId, { status: 'failed', completedAt: new Date().toISOString(), metadata: { error: (error as Error).message } });
    throw error;
  } finally {
    removeWorkflow(workflowId);
  }
}
