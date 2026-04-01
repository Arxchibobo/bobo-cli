import matter from "gray-matter";
import type { Skill } from "./types.js";
import type { KnowledgeLoader } from "./loader.js";

export interface SkillBundle {
  root: Skill;
  dependencies: Skill[];
  combinedContent: string;
}

export class SkillRunner {
  private loader: KnowledgeLoader;

  constructor(loader: KnowledgeLoader) {
    this.loader = loader;
  }

  async resolveDependencies(skillId: string): Promise<Skill[]> {
    const visited = new Set<string>();
    const ordered: Skill[] = [];

    await this.visitSkill(skillId, visited, ordered);

    return ordered;
  }

  async buildBundle(skillId: string): Promise<SkillBundle> {
    const resolved = await this.resolveDependencies(skillId);
    const root = resolved[resolved.length - 1];

    if (!root) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    const dependencies = resolved.slice(0, -1);
    const combinedContent = [
      ...dependencies.map((skill) => skill.content.trim()),
      root.content.trim(),
    ].join("\n\n---\n\n");

    return {
      root,
      dependencies,
      combinedContent,
    };
  }

  async exportSkill(skillId: string): Promise<string> {
    const skill = await this.loader.loadSkill(skillId);

    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    return matter.stringify(skill.content, {
      id: skill.id,
      title: skill.title,
      category: skill.category,
      tags: skill.tags,
      triggers: skill.triggers,
      dependencies: skill.dependencies,
      ...(skill.source ? { source: skill.source } : {}),
    });
  }

  private async visitSkill(skillId: string, visited: Set<string>, ordered: Skill[]): Promise<void> {
    if (visited.has(skillId)) {
      return;
    }

    visited.add(skillId);

    const skill = await this.loader.loadSkill(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    for (const dependencyId of skill.dependencies) {
      await this.visitSkill(dependencyId, visited, ordered);
    }

    ordered.push(skill);
  }
}
