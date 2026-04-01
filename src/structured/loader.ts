import { readFile } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import type { Rule, Skill, Workflow, Memory, KnowledgeIndex, WorkflowStep } from "./types.js";
import { RuleSchema, SkillSchema, WorkflowSchema, MemorySchema, KnowledgeIndexSchema } from "./types.js";

export class KnowledgeLoader {
  private cache = new Map<string, unknown>();
  private basePath: string;

  constructor(knowledgePath: string) {
    this.basePath = knowledgePath;
  }

  async loadIndex(): Promise<KnowledgeIndex> {
    if (this.cache.has("index")) return this.cache.get("index") as KnowledgeIndex;
    const raw = await readFile(join(this.basePath, "index.json"), "utf-8");
    const index = KnowledgeIndexSchema.parse(JSON.parse(raw));
    this.cache.set("index", index);
    return index;
  }

  async loadRule(id: string): Promise<Rule | undefined> {
    return this.loadItem<Rule>("rules", id, RuleSchema);
  }

  async loadSkill(id: string): Promise<Skill | undefined> {
    return this.loadItem<Skill>("skills", id, SkillSchema);
  }

  async loadWorkflow(id: string): Promise<Workflow | undefined> {
    const cacheKey = `workflows:${id}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey) as Workflow;

    try {
      const raw = await readFile(join(this.basePath, "workflows", `${id}.md`), "utf-8");
      const { data, content } = matter(raw);
      const steps = this.parseWorkflowSteps(content);
      const workflow = WorkflowSchema.parse({
        ...data,
        triggers: this.normalizeStringArray(data.triggers),
        checklist: this.normalizeStringArray(data.checklist),
        steps,
      });
      this.cache.set(cacheKey, workflow);
      return workflow;
    } catch {
      return undefined;
    }
  }

  async loadMemory(id: string): Promise<Memory | undefined> {
    return this.loadItem<Memory>("memory", id, MemorySchema);
  }

  async listRules(): Promise<Pick<Rule, "id" | "title" | "category" | "tags">[]> {
    const index = await this.loadIndex();
    const results: Pick<Rule, "id" | "title" | "category" | "tags">[] = [];
    for (const id of index.rules) {
      const rule = await this.loadRule(id);
      if (rule) results.push({ id: rule.id, title: rule.title, category: rule.category, tags: rule.tags });
    }
    return results;
  }

  async listSkills(): Promise<Pick<Skill, "id" | "title" | "category" | "tags">[]> {
    const index = await this.loadIndex();
    const results: Pick<Skill, "id" | "title" | "category" | "tags">[] = [];
    for (const id of index.skills) {
      const skill = await this.loadSkill(id);
      if (skill) results.push({ id: skill.id, title: skill.title, category: skill.category, tags: skill.tags });
    }
    return results;
  }

  async listWorkflows(): Promise<Pick<Workflow, "id" | "title" | "type" | "triggers">[]> {
    const index = await this.loadIndex();
    const results: Pick<Workflow, "id" | "title" | "type" | "triggers">[] = [];
    for (const id of index.workflows) {
      const wf = await this.loadWorkflow(id);
      if (wf) results.push({ id: wf.id, title: wf.title, type: wf.type, triggers: wf.triggers });
    }
    return results;
  }

  async listMemory(): Promise<Pick<Memory, "id" | "title" | "type" | "tags">[]> {
    const index = await this.loadIndex();
    const results: Pick<Memory, "id" | "title" | "type" | "tags">[] = [];
    for (const id of index.memory) {
      const mem = await this.loadMemory(id);
      if (mem) results.push({ id: mem.id, title: mem.title, type: mem.type, tags: mem.tags });
    }
    return results;
  }

  private async loadItem<T>(subdir: string, id: string, schema: any): Promise<T | undefined> {
    const cacheKey = `${subdir}:${id}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey) as T;
    try {
      const raw = await readFile(join(this.basePath, subdir, `${id}.md`), "utf-8");
      const { data, content } = matter(raw);
      const item = schema.parse({
        ...data,
        tags: this.normalizeStringArray(data.tags),
        triggers: this.normalizeStringArray(data.triggers),
        dependencies: this.normalizeStringArray(data.dependencies),
        content,
      });
      this.cache.set(cacheKey, item);
      return item as T;
    } catch {
      return undefined;
    }
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private parseWorkflowSteps(content: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const stepPattern = /### Step \d+: (.+)\n([\s\S]*?)(?=\n### Step \d+:|\n## Checklist|$)/g;

    for (const match of content.matchAll(stepPattern)) {
      const name = match[1]?.trim();
      const body = match[2] ?? "";
      const description = body.split("\n")[0]?.trim() ?? "";
      const actionMatch = body.match(/- Action: `([^`]+)`/);
      const dependsOnMatch = body.match(/- Depends on: (.+)/);

      if (!name || !description || !actionMatch) continue;

      const dependsOnRaw = dependsOnMatch?.[1]?.trim() ?? "none";
      const dependsOn = dependsOnRaw === "none"
        ? []
        : dependsOnRaw.split(",").map((value) => value.trim()).filter(Boolean);

      steps.push({
        name,
        description,
        action: actionMatch[1].trim(),
        dependsOn,
      });
    }

    return steps;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
