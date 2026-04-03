/**
 * Skill Composer — 组合 execution + enhancements + guarantee
 * 
 * 保证组合顺序: [execution] → [enhancements...] → [guarantee]
 */

import type { StructuredSkill, SkillComposition } from './types.js';

/**
 * 从匹配到的 skills 构建组合
 */
export function composeSkills(skills: StructuredSkill[]): SkillComposition {
  const enabled = skills.filter(s => s.enabled);

  const execution = enabled.find(s => s.category === 'execution') ?? null;
  const enhancements = enabled.filter(s => s.category === 'enhancement');
  const guarantee = enabled.find(s => s.category === 'guarantee') ?? null;

  return { execution, enhancements, guarantee };
}

/**
 * 将组合渲染为 prompt 字符串
 */
export function renderComposition(composition: SkillComposition): string {
  const parts: string[] = [];

  if (composition.execution?.prompt) {
    parts.push(`# Execution Skill: ${composition.execution.name}\n\n${composition.execution.prompt}`);
  }

  for (const e of composition.enhancements) {
    if (e.prompt) {
      parts.push(`# Enhancement: ${e.name}\n\n${e.prompt}`);
    }
  }

  if (composition.guarantee?.prompt) {
    parts.push(`# Guarantee: ${composition.guarantee.name}\n\n${composition.guarantee.prompt}`);
  }

  if (parts.length === 0) return '';
  return '\n\n---\n\n# Active Skills\n\n' + parts.join('\n\n---\n\n');
}

/**
 * 根据用户消息匹配 skills 并组合
 */
export function matchAndCompose(allSkills: StructuredSkill[], userMessage: string): SkillComposition {
  const lower = userMessage.toLowerCase();
  const matched: StructuredSkill[] = [];

  for (const skill of allSkills) {
    if (!skill.enabled) continue;

    // Trigger keyword match
    const triggered = skill.triggers.some(t => lower.includes(t.toLowerCase()));
    if (triggered) {
      matched.push(skill);
      continue;
    }

    // Name match
    const nameWords = skill.name.replace(/[-_]/g, ' ').toLowerCase();
    if (nameWords.split(' ').some(w => w.length > 3 && lower.includes(w))) {
      matched.push(skill);
    }
  }

  return composeSkills(matched);
}
