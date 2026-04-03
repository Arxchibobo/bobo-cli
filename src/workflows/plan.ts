import { writePlan } from '../state/artifacts.js';
import { routeTaskWithReason } from '../agents/router.js';
import { spawnAgent } from '../agents/spawn.js';

export interface PlanResult {
  role: string;
  model: string;
  path: string;
  content: string;
  agentId?: string;
}

/**
 * Real plan workflow using planner agent
 *
 * Spawns a planner agent to create a structured execution plan
 */
export async function runPlanWorkflow(task: string): Promise<PlanResult> {
  const route = routeTaskWithReason(task);

  // Spawn a planner agent to create the plan
  const plannerResult = await spawnAgent({
    task: `Create a detailed, structured execution plan for the following task:\n\n${task}\n\nBreak down into concrete steps, identify file changes needed, list dependencies, assess risks, and estimate complexity.`,
    role: 'planner',
    cwd: process.cwd(),
  });

  let content: string;

  if (plannerResult.error) {
    // Fallback to static plan if agent spawn failed
    content = `# Plan\n\n## Task\n${task}\n\n## Recommended role\n${route.role}\n\n## Model\n${route.model}\n\n## Reason\n${route.reason}\n\n## Suggested steps\n1. Explore relevant files\n2. Create minimal change set\n3. Implement\n4. Verify\n\n## Error\nPlanner agent spawn failed: ${plannerResult.error}\n`;
  } else {
    content = `# Plan\n\n## Task\n${task}\n\n## Recommended role\n${route.role}\n\n## Model\n${route.model}\n\n## Reason\n${route.reason}\n\n## Planner Agent\nAgent ID: ${plannerResult.id}\nStatus: Running in background\n\nThe planner agent is creating a detailed plan. Check status with:\n  bobo agent ${plannerResult.id}\n\n## Fallback Steps\n1. Explore relevant files\n2. Create minimal change set\n3. Implement\n4. Verify\n`;
  }

  const path = writePlan(content);
  return {
    role: route.role,
    model: route.model,
    path,
    content,
    agentId: plannerResult.error ? undefined : plannerResult.id,
  };
}
