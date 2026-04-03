import { writePlan, writePRD, writeTeam } from '../state/artifacts.js';
import { addWorkflow, updateWorkflow, removeWorkflow, type WorkflowState } from '../state/manager.js';
import { routeTaskWithReason, type AgentRole } from '../agents/router.js';

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
}

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

  try {
    const plan = `# Team Plan\n\n- Task: ${task}\n- Team size: ${teamSize}\n- Role: ${role}\n- Route reason: ${route.reason}\n\n## Stages\n1. plan\n2. prd\n3. exec\n4. verify\n5. fix\n`;
    const prd = `# Team PRD\n\n## Goal\n${task}\n\n## Execution Lane\n- Primary role: ${role}\n- Workers: ${teamSize}\n- Model hint: ${route.model}\n`;
    const summary = `Team workflow prepared for ${teamSize} ${role} worker(s): ${task}`;

    const planPath = writePlan(plan);
    const prdPath = writePRD(prd);
    const teamPath = writeTeam(`# Team Run\n\n${summary}\n`);

    updateWorkflow(workflowId, { status: 'completed', completedAt: new Date().toISOString() });

    return { workflowId, role, teamSize, planPath, prdPath, teamPath, summary };
  } catch (error) {
    updateWorkflow(workflowId, { status: 'failed', completedAt: new Date().toISOString(), metadata: { error: (error as Error).message } });
    throw error;
  } finally {
    removeWorkflow(workflowId);
  }
}
