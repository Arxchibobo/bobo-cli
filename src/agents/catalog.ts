/**
 * Agent Catalog — 8 核心角色定义
 * 
 * 基于 oh-my-claudecode 的 19 agent 精简版，保留最核心的 8 个角色。
 * 分 4 lanes: Build, Review, Domain, Coordination
 */

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

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
  },

  planner: {
    role: 'planner',
    model: 'opus',
    description: 'Task sequencing, execution plan creation',
    useCases: [
      'Break down complex tasks',
      'Create execution plans',
      'Identify dependencies',
      'Risk assessment',
    ],
    boundaries: [
      'Does not implement code',
      'Does not gather requirements',
      'Does not review plans (use critic)',
    ],
  },

  executor: {
    role: 'executor',
    model: 'sonnet',
    description: 'Code implementation, refactoring, feature work',
    useCases: [
      'Feature implementation',
      'Code refactoring',
      'Bug fixes',
      'Multi-file changes',
    ],
    boundaries: [
      'Does not plan (use planner)',
      'Does not verify (use verifier)',
      'Does not review (use reviewer)',
    ],
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
  },

  // ===== Review Lane =====
  reviewer: {
    role: 'reviewer',
    model: 'opus',
    description: 'Comprehensive code review, logic defects, maintainability',
    useCases: [
      'Code review',
      'API contract review',
      'Security review',
      'Performance review',
    ],
    boundaries: [
      'Does not implement fixes',
      'Does not write tests',
      'Does not plan refactors',
    ],
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
  },

  // ===== Coordination Lane =====
  critic: {
    role: 'critic',
    model: 'opus',
    description: 'Plan/design critical challenge, gap analysis',
    useCases: [
      'Challenge plans',
      'Find gaps in designs',
      'Multi-angle review',
      'Risk identification',
    ],
    boundaries: [
      'Does not create plans (use planner)',
      'Does not implement code',
      'Does not gather requirements',
    ],
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
