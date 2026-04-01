import type { KnowledgeLoader } from "./loader.js";
import type { SearchResult } from "./types.js";

export class KnowledgeSearch {
  private loader: KnowledgeLoader;

  constructor(loader: KnowledgeLoader) {
    this.loader = loader;
  }

  async search(query: string): Promise<SearchResult[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const results: SearchResult[] = [];

    // Search rules
    const rules = await this.loader.listRules();
    for (const meta of rules) {
      const rule = await this.loader.loadRule(meta.id);
      if (!rule) continue;
      const text = `${rule.title} ${rule.tags.join(" ")} ${rule.content}`;
      const score = this.scoreText(text, terms);
      if (score > 0) {
        results.push({
          id: rule.id,
          type: "rule",
          title: rule.title,
          score,
          snippet: this.extractSnippet(rule.content, terms[0]),
          category: rule.category,
        });
      }
    }

    // Search skills
    const skills = await this.loader.listSkills();
    for (const meta of skills) {
      const skill = await this.loader.loadSkill(meta.id);
      if (!skill) continue;
      const text = `${skill.title} ${skill.tags.join(" ")} ${skill.triggers.join(" ")} ${skill.content}`;
      const score = this.scoreText(text, terms);
      if (score > 0) {
        results.push({
          id: skill.id,
          type: "skill",
          title: skill.title,
          score,
          snippet: this.extractSnippet(skill.content, terms[0]),
          category: skill.category,
        });
      }
    }

    // Search workflows
    const workflows = await this.loader.listWorkflows();
    for (const meta of workflows) {
      const wf = await this.loader.loadWorkflow(meta.id);
      if (!wf) continue;
      const text = `${wf.title} ${wf.triggers.join(" ")} ${wf.steps.map(s => s.name + " " + s.description).join(" ")}`;
      const score = this.scoreText(text, terms);
      if (score > 0) {
        results.push({
          id: wf.id,
          type: "workflow",
          title: wf.title,
          score,
          snippet: wf.steps.map(s => s.description).join(" → ").slice(0, 120),
          category: wf.type,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async searchByType(query: string, type: "rule" | "skill" | "workflow" | "memory"): Promise<SearchResult[]> {
    const all = await this.search(query);
    return all.filter(r => r.type === type);
  }

  private scoreText(text: string, terms: string[]): number {
    const lower = text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (!lower.includes(term)) continue;
      score += 1; // base match
      // Title proximity bonus (first 200 chars likely contain title)
      const idx = lower.indexOf(term);
      if (idx < 200) score += 0.5;
      // Frequency bonus
      const count = lower.split(term).length - 1;
      score += Math.min(count * 0.15, 1.5);
    }
    return score;
  }

  private extractSnippet(content: string, term: string): string {
    if (!term) return content.slice(0, 120) + "...";
    const idx = content.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return content.slice(0, 120) + "...";
    const start = Math.max(0, idx - 40);
    const end = Math.min(content.length, idx + 80);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < content.length ? "..." : "";
    return prefix + content.slice(start, end) + suffix;
  }
}
