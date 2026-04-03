import { writePlan } from '../state/artifacts.js';
import { routeTaskWithReason } from '../agents/router.js';

export interface PlanResult {
  role: string;
  model: string;
  path: string;
  content: string;
}

export async function runPlanWorkflow(task: string): Promise<PlanResult> {
  const route = routeTaskWithReason(task);
  const content = `# Plan\n\n## Task\n${task}\n\n## Recommended role\n${route.role}\n\n## Model\n${route.model}\n\n## Reason\n${route.reason}\n\n## Suggested steps\n1. Explore relevant files\n2. Create minimal change set\n3. Implement\n4. Verify\n`;
  const path = writePlan(content);
  return { role: route.role, model: route.model, path, content };
}
