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

  const systemPrompt = buildAgentSystemPrompt(agent, request.task);

  return { decision, agent, systemPrompt };
}

/**
 * 构建 agent system prompt
 */
function buildAgentSystemPrompt(agent: AgentDefinition, task: string): string {
  const boundaries = agent.boundaries.map(b => `- ${b}`).join('\n');
  const useCases = agent.useCases.map(u => `- ${u}`).join('\n');

  return `# Role: ${agent.role} (${agent.description})

## What you do
${useCases}

## What you DON'T do
${boundaries}

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
