import type { ChatCompletionTool } from 'openai/resources/index.js';

export interface PlanStep {
  id: number;
  description: string;
  status: 'pending' | 'in-progress' | 'done' | 'skipped';
}

export interface Plan {
  title: string;
  steps: PlanStep[];
  createdAt: string;
}

// Session-scoped plan (not persisted, lives within one REPL session)
let currentPlan: Plan | null = null;

// ─── Tool Definitions ────────────────────────────────────────

export const plannerToolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_plan',
      description: 'Create a task plan with steps. Use for tasks with 3+ steps. Shows the plan to the user before execution.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Plan title' },
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of step descriptions',
          },
        },
        required: ['title', 'steps'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_plan',
      description: 'Update the status of a plan step.',
      parameters: {
        type: 'object',
        properties: {
          stepId: { type: 'number', description: 'Step ID (1-indexed)' },
          status: {
            type: 'string',
            enum: ['pending', 'in-progress', 'done', 'skipped'],
            description: 'New status',
          },
        },
        required: ['stepId', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_plan',
      description: 'Display the current task plan with progress.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

// ─── Tool Execution ──────────────────────────────────────────

export function executePlannerTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'create_plan': return createPlan(args);
    case 'update_plan': return updatePlan(args);
    case 'show_plan': return showPlan();
    default: return `Unknown planner tool: ${name}`;
  }
}

export function isPlannerTool(name: string): boolean {
  return ['create_plan', 'update_plan', 'show_plan'].includes(name);
}

function createPlan(args: Record<string, unknown>): string {
  const title = args.title as string;
  const stepDescs = args.steps as string[];

  currentPlan = {
    title,
    steps: stepDescs.map((desc, i) => ({
      id: i + 1,
      description: desc,
      status: 'pending',
    })),
    createdAt: new Date().toISOString(),
  };

  return formatPlan(currentPlan);
}

function updatePlan(args: Record<string, unknown>): string {
  if (!currentPlan) return 'No active plan. Create one first with create_plan.';

  const stepId = args.stepId as number;
  const status = args.status as PlanStep['status'];

  const step = currentPlan.steps.find(s => s.id === stepId);
  if (!step) return `Step ${stepId} not found. Plan has ${currentPlan.steps.length} steps.`;

  step.status = status;
  return formatPlan(currentPlan);
}

function showPlan(): string {
  if (!currentPlan) return 'No active plan.';
  return formatPlan(currentPlan);
}

function formatPlan(plan: Plan): string {
  const statusIcons: Record<string, string> = {
    'pending': '⬜',
    'in-progress': '🔵',
    'done': '✅',
    'skipped': '⏭️',
  };

  const total = plan.steps.length;
  const done = plan.steps.filter(s => s.status === 'done').length;
  const progress = Math.round((done / total) * 100);

  let output = `📋 ${plan.title} [${done}/${total} = ${progress}%]\n`;
  output += '─'.repeat(40) + '\n';

  for (const step of plan.steps) {
    const icon = statusIcons[step.status] || '⬜';
    output += `${icon} ${step.id}. ${step.description}\n`;
  }

  return output;
}

/**
 * Get current plan for display in /plan command
 */
export function getCurrentPlan(): string {
  if (!currentPlan) return 'No active plan.';
  return formatPlan(currentPlan);
}

/**
 * Reset the plan (for /clear)
 */
export function resetPlan(): void {
  currentPlan = null;
}
