import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PROJECT_DIR = '.bobo';
const PROJECT_CONFIG = 'project.json';

export interface ProjectConfig {
  name?: string;
  description?: string;
  knowledge?: string[]; // Additional .md files to load
  rules?: string[];     // Project-specific rule files
}

/**
 * Find project root by walking up from CWD looking for .bobo/
 */
export function findProjectRoot(): string | null {
  let dir = process.cwd();
  const root = resolve('/');

  while (dir !== root) {
    if (existsSync(join(dir, PROJECT_DIR))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }

  return null;
}

/**
 * Load project config if in a project
 */
export function loadProjectConfig(): { root: string; config: ProjectConfig } | null {
  const root = findProjectRoot();
  if (!root) return null;

  const configPath = join(root, PROJECT_DIR, PROJECT_CONFIG);
  if (!existsSync(configPath)) {
    return { root, config: {} };
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return { root, config };
  } catch {
    return { root, config: {} };
  }
}

/**
 * Load project-level knowledge for system prompt injection
 */
export function loadProjectKnowledge(): string | null {
  const project = loadProjectConfig();
  if (!project) return null;

  const parts: string[] = [];
  const boboDir = join(project.root, PROJECT_DIR);

  // Load project description
  if (project.config.name) {
    parts.push(`# Project: ${project.config.name}`);
    if (project.config.description) {
      parts.push(project.config.description);
    }
  }

  // Load project knowledge files
  const knowledgeFiles = project.config.knowledge || [];
  for (const file of knowledgeFiles) {
    const filePath = join(boboDir, file);
    if (existsSync(filePath)) {
      parts.push(readFileSync(filePath, 'utf-8').trim());
    }
  }

  // Load project rules
  const ruleFiles = project.config.rules || [];
  for (const file of ruleFiles) {
    const filePath = join(boboDir, file);
    if (existsSync(filePath)) {
      parts.push(readFileSync(filePath, 'utf-8').trim());
    }
  }

  // Auto-detect common project files
  const autoDetect = ['AGENTS.md', 'CLAUDE.md', 'CONVENTIONS.md', 'RULES.md'];
  for (const file of autoDetect) {
    const filePath = join(project.root, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8').trim();
      if (content.length < 5000) { // Don't load huge files
        parts.push(`# ${file}\n\n${content}`);
      }
    }
  }

  return parts.length > 0 ? parts.join('\n\n---\n\n') : null;
}

/**
 * Initialize a project .bobo/ directory
 */
export function initProject(): string {
  const projectDir = join(process.cwd(), PROJECT_DIR);

  if (existsSync(projectDir)) {
    return `Project already initialized at ${projectDir}`;
  }

  mkdirSync(projectDir, { recursive: true });

  const config: ProjectConfig = {
    name: process.cwd().split('/').pop() || 'project',
    description: '',
    knowledge: [],
    rules: [],
  };

  writeFileSync(
    join(projectDir, PROJECT_CONFIG),
    JSON.stringify(config, null, 2) + '\n',
  );

  writeFileSync(
    join(projectDir, 'README.md'),
    `# Project Configuration

This directory contains project-specific configuration for bobo-cli.

## Files

- \`project.json\` — Project config (name, knowledge files, rules)
- Add \`.md\` files here and reference them in project.json

## Usage

\`\`\`bash
# Run bobo in this project (auto-detects .bobo/)
bobo "explain this codebase"
\`\`\`
`,
  );

  return `Initialized project at ${projectDir}`;
}
