#!/usr/bin/env node
/**
 * Knowledge Validation Script
 * Validates the integrity of extracted knowledge bundles.
 *
 * Usage: node scripts/validate-knowledge.mjs
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const KB_DIR = join(__dirname, "../knowledge");

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ERROR: ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  WARN: ${msg}`);
  warnings++;
}

// 1. Check index.json exists and is valid
console.log("=== Validating index.json ===");
const indexPath = join(KB_DIR, "index.json");
if (!existsSync(indexPath)) {
  error("index.json not found");
  process.exit(1);
}

let index;
try {
  index = JSON.parse(readFileSync(indexPath, "utf-8"));
} catch (e) {
  error(`index.json parse error: ${e.message}`);
  process.exit(1);
}

console.log(`  Version: ${index.version}`);
console.log(`  Extracted: ${index.extractedAt}`);

// 2. Validate rules
console.log("\n=== Validating Rules ===");
for (const ruleId of index.rules || []) {
  const rulePath = join(KB_DIR, "rules", `${ruleId}.md`);
  if (!existsSync(rulePath)) {
    error(`Rule file missing: ${ruleId}.md`);
    continue;
  }
  const content = readFileSync(rulePath, "utf-8");
  if (!content.startsWith("---")) {
    error(`Rule ${ruleId}: missing frontmatter`);
  }
  if (!content.match(/^id:\s*.+/m)) {
    error(`Rule ${ruleId}: missing id in frontmatter`);
  }
  if (!content.match(/^title:\s*.+/m)) {
    warn(`Rule ${ruleId}: missing title`);
  }
  if (!content.match(/^category:\s*.+/m)) {
    warn(`Rule ${ruleId}: missing category`);
  }
}
console.log(`  Checked ${index.rules?.length || 0} rules`);

// 3. Validate skills
console.log("\n=== Validating Skills ===");
for (const skillId of index.skills || []) {
  const skillPath = join(KB_DIR, "skills", `${skillId}.md`);
  if (!existsSync(skillPath)) {
    error(`Skill file missing: ${skillId}.md`);
    continue;
  }
  const content = readFileSync(skillPath, "utf-8");
  if (!content.startsWith("---")) {
    error(`Skill ${skillId}: missing frontmatter`);
  }
  if (!content.match(/^id:\s*.+/m)) {
    error(`Skill ${skillId}: missing id`);
  }
  if (!content.match(/^category:\s*.+/m)) {
    warn(`Skill ${skillId}: missing category`);
  }
}
console.log(`  Checked ${index.skills?.length || 0} skills`);

// 4. Validate workflows
console.log("\n=== Validating Workflows ===");
for (const wfId of index.workflows || []) {
  const wfPath = join(KB_DIR, "workflows", `${wfId}.md`);
  if (!existsSync(wfPath)) {
    error(`Workflow file missing: ${wfId}.md`);
  }
}
console.log(`  Checked ${index.workflows?.length || 0} workflows`);

// 5. Validate memory
console.log("\n=== Validating Memory ===");
for (const memId of index.memory || []) {
  const memPath = join(KB_DIR, "memory", `${memId}.md`);
  if (!existsSync(memPath)) {
    error(`Memory file missing: ${memId}.md`);
  }
}
console.log(`  Checked ${index.memory?.length || 0} memory templates`);

// 6. Check for orphaned files
console.log("\n=== Checking for Orphaned Files ===");
for (const subdir of ["rules", "skills", "workflows", "memory"]) {
  const dir = join(KB_DIR, subdir);
  if (!existsSync(dir)) continue;
  const indexKey = subdir === "memory" ? "memory" : subdir;
  const listed = index[indexKey] || [];
  for (const file of readdirSync(dir)) {
    const id = basename(file, ".md");
    if (!listed.includes(id)) {
      warn(`Orphaned file in ${subdir}/: ${file} (not in index)`);
    }
  }
}

// Summary
console.log("\n=== Validation Summary ===");
if (errors === 0 && warnings === 0) {
  console.log("  All checks passed!");
} else {
  console.log(`  Errors: ${errors}`);
  console.log(`  Warnings: ${warnings}`);
}

process.exit(errors > 0 ? 1 : 0);
