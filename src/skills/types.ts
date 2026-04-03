/**
 * Skill Types — 三段分层
 * 
 * execution: 主执行逻辑（coding, research, orchestrate）
 * enhancement: 增强能力（git-advanced, web-enhanced, parallel）
 * guarantee: 执行保证（verification, persistence loop）
 */

export type SkillCategory = 'execution' | 'enhancement' | 'guarantee';

export interface StructuredSkill {
  name: string;
  category: SkillCategory;
  description: string;
  enabled: boolean;
  source: 'builtin' | 'user' | 'project';
  triggers: string[];
  promptFile?: string;
  prompt?: string;
  dependencies?: string[];
}

/**
 * Skill composition order:
 * [1 execution] + [0-N enhancements] + [0-1 guarantee]
 */
export interface SkillComposition {
  execution: StructuredSkill | null;
  enhancements: StructuredSkill[];
  guarantee: StructuredSkill | null;
}
