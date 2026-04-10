/**
 * Agent Catalog — 8 核心角色定义
 * 
 * 基于 oh-my-claudecode 的 19 agent 精简版，保留最核心的 8 个角色。
 * 分 4 lanes: Build, Review, Domain, Coordination
 */

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

/**
 * Advisor capability flag
 * 
 * Based on Anthropic's Advisor Strategy (2026-04-09):
 * - Small model (executor) drives end-to-end
 * - Opus agents can serve as advisors: give direction, not execute
 * - Advisor only outputs plan / correction / stop signal
 * - Never calls tools, never produces user-facing output
 */
export type AdvisorCapability = 'executor-only' | 'advisor-eligible' | 'advisor-or-executor';

export interface AgentDefinition {
  /** Agent 角色名 */
  role: string;
  /** 默认模型层级 */
  model: ModelTier;
  /** 角色描述 */
  description: string;
  /** 适用场景 */
  useCases: string[];
  /** 角色边界（不做什么） */
  boundaries: string[];
  /**
   * Advisor Strategy role
   * - 'executor-only': always drives, never advises (haiku/sonnet agents)
   * - 'advisor-eligible': can serve as advisor to an executor (opus agents)
   * - 'advisor-or-executor': can do both depending on task (opus agents on simple tasks)
   */
  advisorRole: AdvisorCapability;
}

/**
 * Agent Catalog
 * 
 * Build Lane: explore, planner, executor, verifier
 * Review Lane: reviewer
 * Domain Lane: tester, writer
 * Coordination Lane: critic
 */
export const AGENT_CATALOG: Record<string, AgentDefinition> = {
  // ===== Build Lane =====
  explore: {
    role: 'explore',
    model: 'haiku',
    description: 'Fast codebase search, file/symbol mapping',
    useCases: [
      'Quick code lookup',
      'Find function/class definitions',
      'Locate files by pattern',
      'Symbol search across codebase',
    ],
    boundaries: [
      'Does not implement code',
      'Does not analyze logic',
      'Does not write documentation',
    ],
    advisorRole: 'executor-only',
  },

  planner: {
    role: 'planner',
    model: 'opus',
    description: 'Task sequencing, execution plan creation. Can serve as advisor to executors.',
    useCases: [
      'Break down complex tasks',
      'Create execution plans',
      'Identify dependencies',
      'Risk assessment',
      'Advise executors on approach before they start coding',
    ],
    boundaries: [
      'Does not implement code',
      'Does not gather requirements',
      'Does not review plans (use critic)',
      'As advisor: does not call tools or produce user-facing output',
    ],
    advisorRole: 'advisor-eligible',
  },

  executor: {
    role: 'executor',
    model: 'sonnet',
    description: 'Code implementation, refactoring, feature work. Primary driver in advisor strategy.',
    useCases: [
      'Feature implementation',
      'Code refactoring',
      'Bug fixes',
      'Multi-file changes',
    ],
    boundaries: [
      'Does not plan (escalate to planner/advisor)',
      'Does not verify (use verifier)',
      'Does not review (use reviewer)',
    ],
    advisorRole: 'executor-only',
  },

  verifier: {
    role: 'verifier',
    model: 'sonnet',
    description: 'Completion verification, test adequacy confirmation',
    useCases: [
      'Verify task completion',
      'Check test coverage',
      'Validate implementation',
      'Adversarial testing',
    ],
    boundaries: [
      'Does not implement fixes',
      'Does not write tests (use tester)',
      'Does not plan (use planner)',
    ],
    advisorRole: 'executor-only',
  },

  // ===== Review Lane =====
  reviewer: {
    role: 'reviewer',
    model: 'opus',
    description: 'Comprehensive code review, logic defects, maintainability. Can advise executors on quality.',
    useCases: [
      'Code review',
      'API contract review',
      'Security review',
      'Performance review',
      'Advise executors before delivery on quality issues',
    ],
    boundaries: [
      'Does not implement fixes',
      'Does not write tests',
      'Does not plan refactors',
      'As advisor: does not call tools or produce user-facing output',
    ],
    advisorRole: 'advisor-eligible',
  },

  // ===== Domain Lane =====
  tester: {
    role: 'tester',
    model: 'sonnet',
    description: 'Test strategy, coverage, flaky-test hardening',
    useCases: [
      'Write unit tests',
      'Write integration tests',
      'Test strategy design',
      'Coverage analysis',
    ],
    boundaries: [
      'Does not implement features',
      'Does not review code (use reviewer)',
      'Does not verify (use verifier)',
    ],
    advisorRole: 'executor-only',
  },

  writer: {
    role: 'writer',
    model: 'haiku',
    description: 'Documentation, migration notes, user guidance',
    useCases: [
      'Write README',
      'Write API docs',
      'Write migration guides',
      'Write user guides',
    ],
    boundaries: [
      'Does not implement code',
      'Does not review code',
      'Does not plan features',
    ],
    advisorRole: 'executor-only',
  },

  // ===== Coordination Lane =====
  critic: {
    role: 'critic',
    model: 'opus',
    description: 'Plan/design critical challenge, gap analysis. Can advise executors when direction is uncertain.',
    useCases: [
      'Challenge plans',
      'Find gaps in designs',
      'Multi-angle review',
      'Risk identification',
      'Advise executors when approach is not converging',
    ],
    boundaries: [
      'Does not create plans (use planner)',
      'Does not implement code',
      'Does not gather requirements',
      'As advisor: does not call tools or produce user-facing output',
    ],
    advisorRole: 'advisor-eligible',
  },
};

/**
 * 获取 agent 定义
 */
export function getAgent(role: string): AgentDefinition | undefined {
  return AGENT_CATALOG[role];
}

/**
 * 获取所有 agent 角色名
 */
export function getAllAgentRoles(): string[] {
  return Object.keys(AGENT_CATALOG);
}

/**
 * 按 lane 分组
 */
export function getAgentsByLane(): Record<string, string[]> {
  return {
    build: ['explore', 'planner', 'executor', 'verifier'],
    review: ['reviewer'],
    domain: ['tester', 'writer'],
    coordination: ['critic'],
  };
}

/**
 * Get agents that can serve as advisors (Opus-tier agents with advisor-eligible role)
 * 
 * Based on Anthropic's Advisor Strategy:
 * - Advisor = stronger model that gives direction but never executes tools
 * - Executor = smaller model that drives end-to-end and escalates when stuck
 */
export function getAdvisorEligibleAgents(): string[] {
  return Object.entries(AGENT_CATALOG)
    .filter(([_, def]) => def.advisorRole === 'advisor-eligible' || def.advisorRole === 'advisor-or-executor')
    .map(([role]) => role);
}

/**
 * Determine if a task should use advisor strategy
 * 
 * Rules (from advisor-strategy.md):
 * - Simple (1-2 steps): no advisor
 * - Medium (3-5 steps): advisor at start + end (max_uses=2)
 * - Complex (6+ steps): advisor at start + stuck + end (max_uses=3)
 */
export function shouldUseAdvisor(taskComplexity: 'simple' | 'medium' | 'complex'): { use: boolean; maxUses: number } {
  switch (taskComplexity) {
    case 'simple': return { use: false, maxUses: 0 };
    case 'medium': return { use: true, maxUses: 2 };
    case 'complex': return { use: true, maxUses: 3 };
  }
}

/**
 * Select the best advisor for a given executor role
 * 
 * Matching logic:
 * - executor → planner (approach guidance)
 * - tester → reviewer (quality guidance)
 * - verifier → critic (gap analysis)
 * - default → planner
 */
export function selectAdvisorForExecutor(executorRole: string): string {
  switch (executorRole) {
    case 'executor': return 'planner';
    case 'tester': return 'reviewer';
    case 'verifier': return 'critic';
    default: return 'planner';
  }
}
