/**
 * Agent Router — 任务类型 → agent/模型映射
 * 
 * 根据任务描述自动选择最合适的 agent 角色
 */

import type { AgentDefinition, AdvisorCapability } from './catalog.js';
import { AGENT_CATALOG, shouldUseAdvisor, selectAdvisorForExecutor } from './catalog.js';

export type AgentRole = keyof typeof AGENT_CATALOG;

/**
 * 任务路由规则
 * 
 * 优先级：
 * 1. 显式关键词匹配（test, review, plan, verify, search, doc）
 * 2. 任务复杂度判断（简单 → explore, 复杂 → planner）
 * 3. 默认 executor
 */
export function routeTask(task: string): AgentRole {
  const lower = task.toLowerCase();

  // 显式关键词匹配
  if (lower.includes('test') || lower.includes('测试')) return 'tester';
  if (lower.includes('review') || lower.includes('审查') || lower.includes('检查')) return 'reviewer';
  if (lower.includes('plan') || lower.includes('规划') || lower.includes('计划')) return 'planner';
  if (lower.includes('verify') || lower.includes('验证') || lower.includes('确认')) return 'verifier';
  if (lower.includes('search') || lower.includes('find') || lower.includes('查找') || lower.includes('搜索')) return 'explore';
  if (lower.includes('doc') || lower.includes('文档') || lower.includes('readme')) return 'writer';
  if (lower.includes('challenge') || lower.includes('critique') || lower.includes('挑战') || lower.includes('质疑')) return 'critic';

  // 复杂度判断
  const complexityIndicators = [
    'refactor', '重构',
    'architecture', '架构',
    'design', '设计',
    'multiple', '多个',
    'across', '跨',
  ];
  const isComplex = complexityIndicators.some(indicator => lower.includes(indicator));
  if (isComplex) return 'planner';

  // 默认 executor
  return 'executor';
}

/**
 * 根据任务选择模型层级
 * 
 * 规则：
 * - 简单任务（lookup, search, doc）→ haiku
 * - 标准任务（implement, debug, test）→ sonnet
 * - 复杂任务（architecture, review, plan）→ opus
 */
export function selectModel(task: string, role: AgentRole): 'haiku' | 'sonnet' | 'opus' {
  const agent = AGENT_CATALOG[role];
  const lower = task.toLowerCase();

  // 显式复杂度标记
  if (lower.includes('complex') || lower.includes('复杂')) return 'opus';
  if (lower.includes('simple') || lower.includes('简单')) return 'haiku';

  // 使用 agent 默认模型
  return agent.model;
}

/**
 * 路由决策结果
 */
export interface RoutingDecision {
  role: AgentRole;
  model: 'haiku' | 'sonnet' | 'opus';
  agent: AgentDefinition;
  reason: string;
  /** Advisor strategy config (when applicable) */
  advisor?: {
    /** Whether to use advisor for this task */
    enabled: boolean;
    /** Which agent role serves as advisor */
    advisorRole: string;
    /** Max advisor calls for cost control */
    maxUses: number;
    /** Advisor model tier */
    advisorModel: 'opus';
  };
}

/**
 * 完整路由决策（包含原因 + advisor strategy）
 */
export function routeTaskWithReason(task: string): RoutingDecision {
  const role = routeTask(task);
  const model = selectModel(task, role);
  const agent = AGENT_CATALOG[role];

  let reason = `Task matched role: ${role}`;
  if (task.toLowerCase().includes(role)) {
    reason = `Explicit keyword match: "${role}"`;
  } else if (role === 'executor') {
    reason = 'Default role for implementation tasks';
  }

  // Determine task complexity for advisor strategy
  const complexity = estimateComplexity(task);
  const advisorDecision = shouldUseAdvisor(complexity);

  let advisor: RoutingDecision['advisor'] = undefined;
  if (advisorDecision.use && agent.advisorRole === 'executor-only') {
    // Executor-type agents get an advisor assigned
    const advisorRole = selectAdvisorForExecutor(role);
    advisor = {
      enabled: true,
      advisorRole,
      maxUses: advisorDecision.maxUses,
      advisorModel: 'opus',
    };
  }

  return { role, model, agent, reason, advisor };
}

/**
 * Estimate task complexity from description
 * 
 * Simple: 1-2 steps (lookup, single edit, run command)
 * Medium: 3-5 steps (add feature, fix bug, write script)
 * Complex: 6+ steps (refactor, architecture, multi-file)
 */
function estimateComplexity(task: string): 'simple' | 'medium' | 'complex' {
  const lower = task.toLowerCase();

  const complexIndicators = [
    'refactor', '重构', 'architecture', '架构',
    'multiple', '多个', 'across', '跨',
    'redesign', 'migrate', '迁移', 'overhaul',
    'system', '系统', 'pipeline', '流水线',
  ];
  if (complexIndicators.some(i => lower.includes(i))) return 'complex';

  const simpleIndicators = [
    'find', '查找', 'search', '搜索',
    'read', '读', 'check', '检查',
    'list', '列出', 'show', '显示',
  ];
  if (simpleIndicators.some(i => lower.includes(i))) return 'simple';

  return 'medium';
}

/**
 * 批量路由（用于 team 模式）
 */
export function routeTeamTasks(tasks: string[]): RoutingDecision[] {
  return tasks.map(routeTaskWithReason);
}
