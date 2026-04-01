import { z } from "zod";

// === Rule Types ===
export const RuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(["core", "domain", "evomap", "project", "root"]),
  tags: z.array(z.string()),
  content: z.string().min(1),
  source: z.string().optional(),
  version: z.string().optional(),
});
export type Rule = z.infer<typeof RuleSchema>;

// === Skill Types ===
export const SkillSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum([
    "agent-engineering",
    "marketing",
    "dev-tools",
    "design",
    "research",
    "media",
    "infrastructure",
    "knowledge",
    "other",
  ]),
  tags: z.array(z.string()),
  content: z.string().min(1),
  triggers: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  source: z.string().optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

// === Workflow Types ===
export const WorkflowStepSchema = z.object({
  name: z.string(),
  description: z.string(),
  action: z.string(),
  dependsOn: z.array(z.string()).default([]),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum([
    "ui-verify",
    "tdd",
    "db-migration",
    "feature-dev",
    "3d-viz",
    "data-pipeline",
  ]),
  steps: z.array(WorkflowStepSchema),
  triggers: z.array(z.string()),
  checklist: z.array(z.string()).default([]),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

// === Memory Types ===
export const MemorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["account", "patterns", "projects", "services", "custom"]),
  tags: z.array(z.string()),
  content: z.string().min(1),
  template: z.boolean().default(false),
});
export type Memory = z.infer<typeof MemorySchema>;

// === Knowledge Index ===
export const KnowledgeIndexSchema = z.object({
  version: z.string(),
  extractedAt: z.string(),
  rules: z.array(z.string()),
  skills: z.array(z.string()),
  workflows: z.array(z.string()),
  memory: z.array(z.string()),
  stats: z.object({
    totalRules: z.number(),
    totalSkills: z.number(),
    totalWorkflows: z.number(),
    totalMemory: z.number(),
    totalSize: z.string(),
  }),
});
export type KnowledgeIndex = z.infer<typeof KnowledgeIndexSchema>;

// === Search Result ===
export interface SearchResult {
  id: string;
  type: "rule" | "skill" | "workflow" | "memory";
  title: string;
  score: number;
  snippet: string;
  category: string;
}

// === Validation helpers ===
export function validateRule(data: unknown): boolean {
  RuleSchema.parse(data);
  return true;
}

export function validateSkill(data: unknown): boolean {
  SkillSchema.parse(data);
  return true;
}

export function validateWorkflow(data: unknown): boolean {
  WorkflowSchema.parse(data);
  return true;
}

export function validateMemory(data: unknown): boolean {
  MemorySchema.parse(data);
  return true;
}
