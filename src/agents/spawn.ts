/**
 * Agent Spawn — 基于新 catalog 的 agent 生成
 * 
 * 桥接 agents/catalog + agents/router → sub-agents
 */

import { AGENT_CATALOG, type AgentDefinition } from './catalog.js';
import { routeTaskWithReason, type RoutingDecision } from './router.js';

export interface SpawnRequest {
  task: string;
  role?: string;
  model?: string;
  cwd?: string;
}

export interface SpawnResult {
  decision: RoutingDecision;
  agent: AgentDefinition;
  systemPrompt: string;
}

/**
 * 根据任务准备 spawn 参数
 */
export function prepareSpawn(request: SpawnRequest): SpawnResult {
  const decision = request.role
    ? {
        role: request.role as keyof typeof AGENT_CATALOG,
        model: AGENT_CATALOG[request.role as keyof typeof AGENT_CATALOG]?.model ?? 'sonnet' as const,
        agent: AGENT_CATALOG[request.role as keyof typeof AGENT_CATALOG],
        reason: `Explicit role: ${request.role}`,
      }
    : routeTaskWithReason(request.task);

  const agent = decision.agent;

  const systemPrompt = buildAgentSystemPrompt(
    agent,
    request.task,
    decision.advisor ? { advisorRole: decision.advisor.advisorRole, maxUses: decision.advisor.maxUses } : undefined,
  );

  return { decision, agent, systemPrompt };
}

/**
 * 构建 agent system prompt
 */
function buildAgentSystemPrompt(agent: AgentDefinition, task: string, advisorConfig?: { advisorRole: string; maxUses: number }): string {
  const boundaries = agent.boundaries.map(b => `- ${b}`).join('\n');
  const useCases = agent.useCases.map(u => `- ${u}`).join('\n');

  let advisorBlock = '';
  if (advisorConfig) {
    advisorBlock = `
## Advisor Strategy
You have access to a ${advisorConfig.advisorRole} advisor (Opus-tier). Max ${advisorConfig.maxUses} calls.

Call advisor BEFORE substantive work — before writing, before committing to an interpretation.
If you need orientation first (finding files, reading code), do that, then call advisor.

Also call advisor:
- When you believe the task is complete (persist results first)
- When stuck — errors recurring, approach not converging
- When considering a change of approach

Advisor gives direction only. It does not call tools or produce output.
Give the advice serious weight. If evidence conflicts with advice, escalate once more to reconcile.
`;
  }

  return `# Role: ${agent.role} (${agent.description})

## What you do
${useCases}

## What you DON'T do
${boundaries}
${advisorBlock}
## Task
${task}

## Rules
- Stay within your role boundaries
- Report completion status clearly
- If you encounter something outside your role, say so
- Be concise and direct
`;
}

/**
 * 列出所有可 spawn 的角色
 */
export function listSpawnableRoles(): Array<{ role: string; description: string; model: string }> {
  return Object.entries(AGENT_CATALOG).map(([role, def]) => ({
    role,
    description: def.description,
    model: def.model,
  }));
}

/**
 * 实际 spawn 一个 sub-agent 并返回 agent ID
 *
 * 桥接到 sub-agents.ts 的真实执行
 */
export async function spawnAgent(request: SpawnRequest): Promise<{ id: string; error?: string }> {
  const { spawnSubAgent } = await import('../sub-agents.js');
  const { decision, agent, systemPrompt } = prepareSpawn(request);

  const fullTask = `${systemPrompt}\n\n---\n\n${request.task}`;

  // Map agent role to sub-agent role type
  // Most agents map to 'worker', but some have special handling
  let subAgentRole: 'explore' | 'plan' | 'worker' | 'verify';

  switch (decision.role) {
    case 'explore':
      subAgentRole = 'explore';
      break;
    case 'planner':
      subAgentRole = 'plan';
      break;
    case 'verifier':
      subAgentRole = 'verify';
      break;
    default:
      subAgentRole = 'worker';
  }

  return spawnSubAgent(fullTask, subAgentRole);
}

/**
 * Spawn multiple agents in parallel for team workflows
 */
export async function spawnAgentTeam(
  requests: SpawnRequest[]
): Promise<Array<{ id: string; error?: string }>> {
  return Promise.all(requests.map(req => spawnAgent(req)));
}
