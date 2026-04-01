#!/usr/bin/env node
/**
 * Knowledge Extraction Script
 * Extracts rules, skills, workflows, memory from the monorepo into portable bundles.
 *
 * Usage: SOURCE_ROOT="../.." node scripts/extract-knowledge.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "fs";
import { join, basename, resolve, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_ROOT = resolve(process.env.SOURCE_ROOT || join(__dirname, "../.."));
const OUTPUT_DIR = join(__dirname, "../knowledge");

console.log(`Extracting knowledge from: ${SOURCE_ROOT}`);
console.log(`Output to: ${OUTPUT_DIR}\n`);

// Ensure output dirs
for (const dir of ["rules", "skills", "workflows", "memory"]) {
  mkdirSync(join(OUTPUT_DIR, dir), { recursive: true });
}

// === Skill Category Mapping ===
const SKILL_CATEGORIES = {
  // Agent Engineering
  "cache-optimization-skill": "agent-engineering",
  "context-optimization-suite": "agent-engineering",
  "decision-making-framework": "agent-engineering",
  "memory-evolution-system": "agent-engineering",
  "quality-assurance-framework": "agent-engineering",
  "multi-lens-thinking": "agent-engineering",
  "self-evolution": "agent-engineering",
  "ralph-loop": "agent-engineering",
  "pua": "agent-engineering",
  "planning-with-files": "agent-engineering",
  "Skill_Seekers": "agent-engineering",
  "skill-manager": "agent-engineering",
  "skill-creator": "agent-engineering",
  "skill-share": "agent-engineering",

  // Marketing
  "ab-test-setup": "marketing",
  "analytics-tracking": "marketing",
  "brand-voice": "marketing",
  "competitor-alternatives": "marketing",
  "content-atomizer": "marketing",
  "content-research-writer": "marketing",
  "copy-editing": "marketing",
  "copywriting": "marketing",
  "direct-response-copy": "marketing",
  "email-sequence": "marketing",
  "email-sequences": "marketing",
  "free-tool-strategy": "marketing",
  "keyword-research": "marketing",
  "launch-strategy": "marketing",
  "lead-magnet": "marketing",
  "marketing-ideas": "marketing",
  "marketing-psychology": "marketing",
  "newsletter": "marketing",
  "onboarding-cro": "marketing",
  "page-cro": "marketing",
  "paid-ads": "marketing",
  "popup-cro": "marketing",
  "positioning-angles": "marketing",
  "pricing-strategy": "marketing",
  "programmatic-seo": "marketing",
  "referral-program": "marketing",
  "schema-markup": "marketing",
  "seo-audit": "marketing",
  "seo-content": "marketing",
  "signup-flow-cro": "marketing",
  "paywall-upgrade-cro": "marketing",
  "form-cro": "marketing",
  "social-content": "marketing",
  "orchestrator": "marketing",

  // Dev Tools
  "code-review": "dev-tools",
  "code-review-expert": "dev-tools",
  "code-simplifier": "dev-tools",
  "commit-commands": "dev-tools",
  "refactoring-expert": "dev-tools",
  "testing-expert": "dev-tools",
  "documentation-expert": "dev-tools",
  "feature-dev": "dev-tools",
  "hookify": "dev-tools",
  "pr-review-toolkit": "dev-tools",
  "plugin-dev": "dev-tools",
  "mcp-builder": "dev-tools",
  "file-organizer": "dev-tools",
  "developer-growth-analysis": "dev-tools",
  "webapp-testing": "dev-tools",
  "verify": "dev-tools",
  "spec-flow-skill": "dev-tools",
  "github": "dev-tools",
  "gitlab": "dev-tools",

  // Design
  "ui-ux-pro-max": "design",
  "canvas-design": "design",
  "frontend-design": "design",
  "frontend-design-offical": "design",
  "frontend-expert": "design",
  "theme-factory": "design",
  "artifacts-builder": "design",

  // Research
  "wide-research": "research",
  "literature-review": "research",
  "synthesizer": "research",
  "question-refiner": "research",
  "research-executor": "research",
  "got-controller": "research",
  "notebooklm": "research",
  "citation-validator": "research",

  // Media
  "nano-banana-pro": "media",
  "seedance-prompt": "media",
  "image-editor": "media",
  "image-enhancer": "media",
  "ppt-generator": "media",
  "visual-prompt-engineer": "media",
  "remotion-dev": "media",

  // Infrastructure
  "docker-expert": "infrastructure",
  "security-expert": "infrastructure",
  "security-audit-expert": "infrastructure",
  "security-guidance": "infrastructure",
  "browser-use": "infrastructure",
  "agent-browser": "infrastructure",
  "backend-expert": "infrastructure",
  "web-access": "infrastructure",

  // Knowledge
  "document-skills": "knowledge",
  "explanatory-output-style": "knowledge",
  "learning-output-style": "knowledge",
  "meeting-insights-analyzer": "knowledge",
  "obsidian-bases": "knowledge",
  "obsidian-markdown": "knowledge",
  "json-canvas": "knowledge",
  "stripe": "knowledge",
  "supabase": "knowledge",
  "asana": "knowledge",
  "linear": "knowledge",
  "slack": "knowledge",
  "context7": "knowledge",
};

const DEFAULT_CATEGORY = "other";

function getCategory(skillName) {
  return SKILL_CATEGORIES[skillName] || DEFAULT_CATEGORY;
}

// === 1. Extract Rules ===
function extractRules() {
  const ruleSources = [
    { dir: join(SOURCE_ROOT, ".claude/rules/core"), category: "core" },
    { dir: join(SOURCE_ROOT, ".claude/rules/domain"), category: "domain" },
    { dir: join(SOURCE_ROOT, ".claude/rules"), category: "root" },
  ];

  // Also try global rules
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    ruleSources.push({ dir: join(homeDir, ".claude/rules/core"), category: "core" });
    ruleSources.push({ dir: join(homeDir, ".claude/rules/domain"), category: "domain" });
    ruleSources.push({ dir: join(homeDir, ".claude/rules"), category: "root" });
  }

  const extracted = [];

  for (const { dir, category } of ruleSources) {
    if (!existsSync(dir)) continue;
    const stat = statSync(dir);
    if (!stat.isDirectory()) continue;

    for (const file of readdirSync(dir).filter(f => f.endsWith(".md"))) {
      const filePath = join(dir, file);
      const content = readFileSync(filePath, "utf-8");
      const id = basename(file, ".md");

      // Skip if already extracted (project-level overrides global)
      if (extracted.some(r => r.id === id)) continue;

      const tags = sanitizeItems(extractTags(content));
      const title = extractTitle(content);

      const output = `---
id: ${yamlString(id)}
title: ${yamlString(title)}
category: ${yamlString(category)}
tags: ${yamlArray(tags)}
source: ${yamlString(filePath.replace(/\\/g, "/"))}
---

${content}`;

      writeFileSync(join(OUTPUT_DIR, "rules", `${id}.md`), output);
      extracted.push({ id, title, category, tags });
      console.log(`  [rule] ${id} (${category})`);
    }
  }

  return extracted;
}

// === 2. Extract Skills ===
function extractSkills() {
  const skillsDir = join(SOURCE_ROOT, ".claude/skills");
  if (!existsSync(skillsDir)) {
    console.log("  Skills directory not found, skipping");
    return [];
  }

  const extracted = [];

  for (const entry of readdirSync(skillsDir)) {
    const skillDir = join(skillsDir, entry);
    if (!statSync(skillDir).isDirectory()) continue;
    if (entry.startsWith(".") || entry === "node_modules") continue;

    const category = getCategory(entry);

    // Find the main skill content file
    let contentFile = null;
    let content = "";

    // Check for common patterns
    const candidates = [
      join(skillDir, "SKILL.md"),
      join(skillDir, `${entry}.md`),
      join(skillDir, "skill.md"),
      join(skillDir, "README.md"),
      join(skillDir, "prompt.md"),
    ];

    // Also check for any .md file in the directory
    if (!contentFile) {
      const mdFiles = readdirSync(skillDir).filter(f => f.endsWith(".md"));
      if (mdFiles.length > 0) {
        contentFile = join(skillDir, mdFiles[0]);
      }
    }

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        contentFile = candidate;
        break;
      }
    }

    if (contentFile && existsSync(contentFile)) {
      content = readFileSync(contentFile, "utf-8");
    } else {
      // Create minimal content from directory name
      content = `# ${entry}\n\nSkill directory: ${entry}`;
    }

    const title = extractTitle(content) || entry.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    const tags = sanitizeItems(extractTags(content));
    const triggers = sanitizeItems(extractTriggers(content));

    const output = `---
id: ${yamlString(entry)}
title: ${yamlString(title)}
category: ${yamlString(category)}
tags: ${yamlArray(tags)}
triggers: ${yamlArray(triggers)}
dependencies: []
source: ${yamlString(skillDir.replace(/\\/g, "/"))}
---

${content}`;

    writeFileSync(join(OUTPUT_DIR, "skills", `${entry}.md`), output);
    extracted.push({ id: entry, title, category, tags });
  }

  console.log(`  Extracted ${extracted.length} skills`);
  return extracted;
}

// === 3. Extract Workflows ===
function extractWorkflows() {
  // Workflows are embedded in engineering-workflows.md
  const workflowDefs = [
    {
      id: "ui-verify",
      title: "UI Verification Loop",
      type: "ui-verify",
      triggers: ["UI modify", "frontend change", "component update"],
      checklist: ["App starts", "Visual elements render", "No console errors", "Responsive layout"],
      steps: [
        { name: "Complete code modification", description: "Finish all UI code changes", action: "code", dependsOn: [] },
        { name: "Start dev server", description: "Run npm run dev to start the application", action: "npm run dev", dependsOn: ["code"] },
        { name: "Navigate to component", description: "Open browser and navigate to affected component", action: "navigate", dependsOn: ["npm run dev"] },
        { name: "Verify visual rendering", description: "Check visual elements render correctly", action: "verify", dependsOn: ["navigate"] },
        { name: "Check console errors", description: "Open DevTools and verify no console errors", action: "check-console", dependsOn: ["navigate"] },
        { name: "Mark complete", description: "Only mark task complete after visual verification", action: "complete", dependsOn: ["verify", "check-console"] },
      ],
    },
    {
      id: "tdd-flow",
      title: "TDD Full Flow",
      type: "tdd",
      triggers: ["new feature", "bug fix", "refactor", "critical logic"],
      checklist: ["Tests pass", "Coverage >= 80%", "Edge cases covered", "Property tests for critical paths"],
      steps: [
        { name: "Plan architecture", description: "Use sequential thinking to plan the architecture", action: "plan", dependsOn: [] },
        { name: "RED - Write failing tests", description: "Write unit tests covering all edge cases - must FAIL", action: "write-test", dependsOn: ["plan"] },
        { name: "GREEN - Minimal implementation", description: "Write minimal code to make tests pass", action: "implement", dependsOn: ["write-test"] },
        { name: "REFACTOR", description: "Clean up code while keeping tests green", action: "refactor", dependsOn: ["implement"] },
        { name: "Property tests", description: "Add property-based tests for critical functions", action: "property-test", dependsOn: ["refactor"] },
        { name: "Mutation tests", description: "Verify test quality with mutation testing", action: "mutation-test", dependsOn: ["property-test"] },
      ],
    },
    {
      id: "db-migration",
      title: "Database Migration Orchestration",
      type: "db-migration",
      triggers: ["schema change", "data migration", "multi-table operation"],
      checklist: ["Dependencies analyzed", "Rollback script ready", "Integrity verified", "Compatible views built"],
      steps: [
        { name: "Analyze dependencies", description: "Map all tables, foreign keys, and dependencies", action: "analyze", dependsOn: [] },
        { name: "Write migration script", description: "Create forward migration in single transaction", action: "write-migration", dependsOn: ["analyze"] },
        { name: "Write rollback script", description: "Create rollback script for failure recovery", action: "write-rollback", dependsOn: ["analyze"] },
        { name: "Build compatibility views", description: "Create backward-compatible views if needed", action: "compat-views", dependsOn: ["write-migration"] },
        { name: "Test in staging", description: "Execute migration in test environment", action: "test", dependsOn: ["write-migration", "write-rollback"] },
        { name: "Verify integrity", description: "Run verification queries for data consistency", action: "verify", dependsOn: ["test"] },
      ],
    },
    {
      id: "feature-dev",
      title: "Feature Development Workflow",
      type: "feature-dev",
      triggers: ["new feature", "complex feature", "multi-file change"],
      checklist: ["Plan approved", "Dependencies identified", "Tests written", "Code reviewed"],
      steps: [
        { name: "Structured planning", description: "Break feature into clear steps with dependencies", action: "plan", dependsOn: [] },
        { name: "Identify dependencies", description: "Map which steps depend on which", action: "deps", dependsOn: ["plan"] },
        { name: "Implement step by step", description: "Execute in dependency order, verify each step", action: "implement", dependsOn: ["deps"] },
        { name: "Verify each step", description: "Test and verify before moving to next step", action: "verify", dependsOn: ["implement"] },
      ],
    },
    {
      id: "3d-viz",
      title: "3D Visualization Layout",
      type: "3d-viz",
      triggers: ["Three.js", "R3F", "3D scene", "layout algorithm"],
      checklist: ["Node distribution balanced", "Surface offsets applied", "Global layout verified", "Local connections clean"],
      steps: [
        { name: "Understand data scale", description: "Analyze node count and category distribution", action: "analyze", dependsOn: [] },
        { name: "Weight-based sector allocation", description: "Allocate sector angles by node count (not equal)", action: "allocate", dependsOn: ["analyze"] },
        { name: "Apply surface offsets", description: "Offset connection points to geometry surface (sphere=1.0, cube=1.2, torus=1.4)", action: "offset", dependsOn: ["allocate"] },
        { name: "Handle overflow", description: "Enable multi-ring spiral if nodes exceed sector capacity", action: "overflow", dependsOn: ["allocate"] },
        { name: "Visual verification", description: "Start dev server and screenshot verify layout + connections", action: "verify", dependsOn: ["offset", "overflow"] },
      ],
    },
    {
      id: "data-pipeline",
      title: "Large Data Pipeline",
      type: "data-pipeline",
      triggers: ["batch query", "big dataset", "frontend rendering", "search"],
      checklist: ["Data batched", "Deduplication applied", "Lazy loading enabled", "Multi-field search supported"],
      steps: [
        { name: "Batch data fetch", description: "Query in controlled batch sizes", action: "fetch", dependsOn: [] },
        { name: "Process data", description: "Dedup + classify + aggregate", action: "process", dependsOn: ["fetch"] },
        { name: "Optimize frontend", description: "Lazy load images, video thumbnails with #t=0.1, object-fit: cover", action: "frontend", dependsOn: ["process"] },
        { name: "Add search", description: "Support multi-field search (name + ID)", action: "search", dependsOn: ["frontend"] },
        { name: "Deduplicate display", description: "Use Set to deduplicate marquee/list display names", action: "dedup", dependsOn: ["process"] },
      ],
    },
  ];

  const extracted = [];
  for (const wf of workflowDefs) {
    // Serialize steps as YAML-like list in frontmatter
    const stepsYaml = wf.steps.map(s =>
      `  - name: "${s.name}"\n    description: "${s.description}"\n    action: ${s.action}\n    dependsOn: [${s.dependsOn.join(", ")}]`
    ).join("\n");

    const output = `---
id: ${wf.id}
title: "${wf.title}"
type: ${wf.type}
triggers: [${wf.triggers.join(", ")}]
checklist: [${wf.checklist.join(", ")}]
---

# ${wf.title}

## Triggers
${wf.triggers.map(t => `- ${t}`).join("\n")}

## Steps
${wf.steps.map((s, i) => `### Step ${i + 1}: ${s.name}\n${s.description}\n- Action: \`${s.action}\`\n- Depends on: ${s.dependsOn.length > 0 ? s.dependsOn.join(", ") : "none"}`).join("\n\n")}

## Checklist
${wf.checklist.map(c => `- [ ] ${c}`).join("\n")}
`;

    writeFileSync(join(OUTPUT_DIR, "workflows", `${wf.id}.md`), output);
    extracted.push({ id: wf.id, title: wf.title });
    console.log(`  [workflow] ${wf.id}`);
  }

  return extracted;
}

// === 4. Extract Memory Templates ===
function extractMemory() {
  const memorySources = [
    { dir: join(SOURCE_ROOT, ".claude/memory"), type: "custom" },
    { dir: join(SOURCE_ROOT, "memory"), type: "custom" },
  ];

  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    memorySources.push({
      dir: join(homeDir, ".claude/projects/E--Bobo-s-Coding-cache/memory"),
      type: "custom",
    });
  }

  const extracted = [];

  for (const { dir, type } of memorySources) {
    if (!existsSync(dir)) continue;
    const stat = statSync(dir);
    if (!stat.isDirectory()) continue;

    for (const file of readdirSync(dir).filter(f => f.endsWith(".md") && f !== "MEMORY.md")) {
      const filePath = join(dir, file);
      const content = readFileSync(filePath, "utf-8");
      const id = basename(file, ".md");

      if (extracted.some(m => m.id === id)) continue;

      const title = extractTitle(content) || id.replace(/-/g, " ");

      const output = `---
id: ${yamlString(id)}
title: ${yamlString(title)}
type: ${yamlString(type)}
tags: [memory, template]
template: true
---

${content}`;

      writeFileSync(join(OUTPUT_DIR, "memory", `${id}.md`), output);
      extracted.push({ id, title });
      console.log(`  [memory] ${id}`);
    }
  }

  return extracted;
}

// === Helper Functions ===
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].replace(/[>`\[\]]/g, "").trim() : "";
}

function extractTags(content) {
  const tags = new Set();
  // From frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const tagMatch = fmMatch[1].match(/tags:\s*\[([^\]]+)\]/);
    if (tagMatch) {
      tagMatch[1].split(",").forEach(t => tags.add(t.trim().replace(/['"]/g, "")));
    }
  }
  // From headings
  const headings = content.match(/^##?\s+(.+)$/gm) || [];
  headings.forEach(h => {
    const cleaned = h.replace(/^#+\s+/, "").toLowerCase();
    if (cleaned.length < 30) tags.add(cleaned);
  });
  return [...tags].filter(Boolean).slice(0, 10);
}

function extractTriggers(content) {
  const triggers = [];
  const patterns = [
    /trigger(?:s)?:\s*\[([^\]]+)\]/i,
    /when\s+(?:to\s+)?use:\s*(.+)/i,
  ];
  for (const p of patterns) {
    const match = content.match(p);
    if (match) {
      match[1].split(",").forEach(t => triggers.push(t.trim().replace(/['"]/g, "")));
    }
  }
  return sanitizeItems(triggers);
}

function sanitizeItems(items) {
  return [...new Set(items)]
    .map((item) => String(item).trim())
    .filter(Boolean)
    .filter((item) => !item.includes(":") && !item.includes("[") && !item.includes("]"))
    .map((item) => item.replace(/^[-*#\s]+/, ""))
    .map((item) => item.replace(/\*\*/g, ""))
    .map((item) => item.replace(/`/g, ""))
    .map((item) => item.replace(/"/g, "'"))
    .filter(Boolean)
    .slice(0, 10);
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function yamlArray(values) {
  const normalized = sanitizeItems(Array.isArray(values) ? values : []);
  return `[${normalized.map((value) => JSON.stringify(value)).join(", ")}]`;
}

// === Generate Index ===
function generateIndex(rules, skills, workflows, memory) {
  const index = {
    version: "1.0.0",
    extractedAt: new Date().toISOString().split("T")[0],
    rules: rules.map(r => r.id),
    skills: skills.map(s => s.id),
    workflows: workflows.map(w => w.id),
    memory: memory.map(m => m.id),
    stats: {
      totalRules: rules.length,
      totalSkills: skills.length,
      totalWorkflows: workflows.length,
      totalMemory: memory.length,
      totalSize: `${rules.length + skills.length + workflows.length + memory.length} items`,
    },
  };

  writeFileSync(join(OUTPUT_DIR, "index.json"), JSON.stringify(index, null, 2));
  return index;
}

// === Main ===
console.log("=== Extracting Rules ===");
const rules = extractRules();
console.log(`  Total: ${rules.length} rules\n`);

console.log("=== Extracting Skills ===");
const skills = extractSkills();
console.log(`  Total: ${skills.length} skills\n`);

console.log("=== Extracting Workflows ===");
const workflows = extractWorkflows();
console.log(`  Total: ${workflows.length} workflows\n`);

console.log("=== Extracting Memory ===");
const memory = extractMemory();
console.log(`  Total: ${memory.length} memory templates\n`);

console.log("=== Generating Index ===");
const index = generateIndex(rules, skills, workflows, memory);

console.log("\n=== Summary ===");
console.log(`  Rules:      ${index.stats.totalRules}`);
console.log(`  Skills:     ${index.stats.totalSkills}`);
console.log(`  Workflows:  ${index.stats.totalWorkflows}`);
console.log(`  Memory:     ${index.stats.totalMemory}`);
console.log(`  Output:     ${OUTPUT_DIR}`);
console.log("\nDone!");
