import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config.js';

export interface Skill {
  name: string;
  description: string;
  enabled: boolean;
  type: 'builtin' | 'custom';
  promptFile?: string;
}

interface SkillManifest {
  skills: Record<string, { enabled: boolean }>;
}

const SKILLS_DIR = 'skills';
const MANIFEST_FILE = 'skills-manifest.json';

// ─── Built-in Skills ─────────────────────────────────────────

const BUILTIN_SKILLS: Record<string, { description: string; prompt: string }> = {
  coding: {
    description: '代码规范、零注释原则、验证协议',
    prompt: `# Coding Skill

## 零注释原则
- 默认不写注释，只在 WHY 非显而易见时写
- 好的命名已说明 WHAT
- 禁止 "added for issue #123"

## 代码质量
- 不投机抽象：三行重复好过一个过早抽象
- 不加没用的：不加 impossible error handling
- 函数职责单一，命名明确

## PR 规范
- commit message 用英文，动词开头
- 一个 PR 一个功能，不混杂
- 变更说明写在 PR 描述，不写在代码注释

## Review Checklist
1. 编译通过
2. 测试通过（或明确说没测试）
3. 无 console.log/debugger 遗留
4. 无硬编码路径/密钥
5. 错误处理完整`,
  },

  research: {
    description: '搜索策略、信息综合、调研方法',
    prompt: `# Research Skill

## 搜索策略
1. **先窄后宽**：精确搜索 → 模糊搜索 → 全局搜索
2. **先本地后远程**：文件系统 → git log → web
3. **先结构后内容**：目录结构 → 文件名 → 文件内容

## 信息综合
- 收集多个来源，交叉验证
- 区分事实和观点
- 标注信息来源和时效性

## 调研模板
1. 明确问题（要回答什么？）
2. 搜索关键信息
3. 整理发现
4. 得出结论
5. 标注不确定的地方`,
  },
};

// ─── Skill Management ────────────────────────────────────────

function getSkillsDir(): string {
  return join(getConfigDir(), SKILLS_DIR);
}

function getManifestPath(): string {
  return join(getConfigDir(), MANIFEST_FILE);
}

function loadManifest(): SkillManifest {
  const path = getManifestPath();
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      return { skills: {} };
    }
  }
  // Default: all builtin skills enabled
  const skills: Record<string, { enabled: boolean }> = {};
  for (const name of Object.keys(BUILTIN_SKILLS)) {
    skills[name] = { enabled: true };
  }
  return { skills };
}

function saveManifest(manifest: SkillManifest): void {
  writeFileSync(getManifestPath(), JSON.stringify(manifest, null, 2) + '\n');
}

/**
 * List all available skills
 */
export function listSkills(): Skill[] {
  const manifest = loadManifest();
  const skills: Skill[] = [];

  // Built-in skills
  for (const [name, info] of Object.entries(BUILTIN_SKILLS)) {
    skills.push({
      name,
      description: info.description,
      enabled: manifest.skills[name]?.enabled ?? true,
      type: 'builtin',
    });
  }

  // Custom skills from ~/.bobo/skills/
  const skillsDir = getSkillsDir();
  if (existsSync(skillsDir)) {
    const entries = readdirSync(skillsDir);
    for (const entry of entries) {
      const fullPath = join(skillsDir, entry);
      try {
        // Use statSync to follow symlinks
        const stat = statSync(fullPath);
        if (!stat.isDirectory()) continue;
      } catch { continue; }

      const skillFile = join(fullPath, 'SKILL.md');
      if (existsSync(skillFile)) {
        const content = readFileSync(skillFile, 'utf-8');
        let desc = 'Custom skill';
        const h1Match = content.match(/^#\s+.+\n+([^#\n][^\n]{10,})/m);
        const fmMatch = content.match(/^description:\s*(.+)/m);
        const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('```') && l.trim().length > 15);

        if (fmMatch) desc = fmMatch[1].trim().replace(/^["']|["']$/g, '');
        else if (h1Match) desc = h1Match[1].trim().slice(0, 80);
        else if (firstLine) desc = firstLine.trim().slice(0, 80);

        skills.push({
          name: entry,
          description: desc,
          enabled: manifest.skills[entry]?.enabled ?? true,
          type: 'custom',
          promptFile: skillFile,
        });
      }
    }
  }

  return skills;
}

/**
 * Enable or disable a skill
 */
export function setSkillEnabled(name: string, enabled: boolean): string {
  const manifest = loadManifest();
  const allSkills = listSkills();
  const skill = allSkills.find(s => s.name === name);

  if (!skill) {
    return `Skill not found: ${name}. Available: ${allSkills.map(s => s.name).join(', ')}`;
  }

  manifest.skills[name] = { enabled };
  saveManifest(manifest);
  return `Skill "${name}" ${enabled ? 'enabled ✅' : 'disabled ❌'}`;
}

/**
 * Load enabled skill prompts for system prompt injection
 */
export function loadSkillPrompts(): string {
  const manifest = loadManifest();
  const parts: string[] = [];

  // Built-in skills
  for (const [name, info] of Object.entries(BUILTIN_SKILLS)) {
    if (manifest.skills[name]?.enabled !== false) {
      parts.push(info.prompt);
    }
  }

  // Custom skills (follow symlinks)
  const skillsDir = getSkillsDir();
  if (existsSync(skillsDir)) {
    const entries = readdirSync(skillsDir);
    for (const entry of entries) {
      const fullPath = join(skillsDir, entry);
      try {
        if (!statSync(fullPath).isDirectory()) continue;
      } catch { continue; }
      if (manifest.skills[entry]?.enabled === false) continue;
      const skillFile = join(fullPath, 'SKILL.md');
      if (existsSync(skillFile)) {
        parts.push(readFileSync(skillFile, 'utf-8').trim());
      }
    }
  }

  return parts.length > 0 ? '\n\n---\n\n# Active Skills\n\n' + parts.join('\n\n---\n\n') : '';
}

/**
 * Import OpenClaw skills from a directory into ~/.bobo/skills/
 * Returns a report of imported/skipped skills
 */
export function importSkills(sourceDir: string): string {
  const skillsDir = getSkillsDir();
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  if (!existsSync(sourceDir)) {
    return `Source directory not found: ${sourceDir}`;
  }

  const dirs: string[] = [];
  for (const entry of readdirSync(sourceDir)) {
    const fullPath = join(sourceDir, entry);
    try {
      if (statSync(fullPath).isDirectory()) dirs.push(entry);
    } catch { /* skip broken symlinks */ }
  }

  let imported = 0;
  let skipped = 0;
  let alreadyExists = 0;
  const report: string[] = [];

  // Tools that the CLI has
  const cliTools = new Set([
    'read_file', 'write_file', 'edit_file', 'search_files', 'list_directory',
    'shell', 'save_memory', 'search_memory', 'git_status', 'git_diff',
    'git_log', 'git_commit', 'create_plan', 'update_plan', 'show_plan',
    'web_search', 'web_fetch',
  ]);

  // Tools/features that need OpenClaw-specific infrastructure
  const incompatiblePatterns = [
    /\bmessage\s*\(\s*{?\s*action/i,       // message tool (Slack/Telegram/etc)
    /\bnodes\s*\(\s*{?\s*action/i,          // nodes tool (camera/screen)
    /\bcron\s*\(\s*{?\s*action/i,           // cron tool
    /\bcanvas\s*\(\s*{?\s*action/i,         // canvas tool
    /\bsessions_spawn\b/i,                   // sub-agent spawning
    /\bsessions_send\b/i,                    // inter-session messaging
    /\bgateway\s*\(\s*{?\s*action/i,        // gateway management
  ];

  for (const dir of dirs) {
    const skillFile = join(sourceDir, dir, 'SKILL.md');
    if (!existsSync(skillFile)) {
      continue;
    }

    const targetDir = join(skillsDir, dir);

    // Skip if already exists
    if (existsSync(targetDir)) {
      alreadyExists++;
      continue;
    }

    // Read SKILL.md to classify
    const content = readFileSync(skillFile, 'utf-8');

    // Check for incompatible patterns
    const hasIncompatible = incompatiblePatterns.some(p => p.test(content));

    // Create skill directory and copy SKILL.md
    mkdirSync(targetDir, { recursive: true });

    if (hasIncompatible) {
      // Add compatibility note
      const wrappedContent = `<!-- Imported from OpenClaw. Some features may require tools not available in CLI mode. -->\n\n${content}`;
      writeFileSync(join(targetDir, 'SKILL.md'), wrappedContent);
      report.push(`  ⚠️ ${dir} (imported with compatibility warning)`);
    } else {
      writeFileSync(join(targetDir, 'SKILL.md'), content);
      report.push(`  ✅ ${dir}`);
    }

    // Copy any additional .md files in the skill directory
    try {
      const extraFiles = readdirSync(join(sourceDir, dir))
        .filter(f => f.endsWith('.md') && f !== 'SKILL.md');
      for (const f of extraFiles) {
        const src = join(sourceDir, dir, f);
        const dst = join(targetDir, f);
        try {
          if (existsSync(src) && !existsSync(dst)) {
            const st = statSync(src);
            if (st.size < 50000) copyFileSync(src, dst);
          }
        } catch { /* skip files with permission issues */ }
      }

      // Also copy references/ directory if it exists
      const refsDir = join(sourceDir, dir, 'references');
      if (existsSync(refsDir)) {
        const targetRefs = join(targetDir, 'references');
        mkdirSync(targetRefs, { recursive: true });
        try {
          const refFiles = readdirSync(refsDir).filter(f => f.endsWith('.md'));
          for (const f of refFiles) {
            try {
              const st = statSync(join(refsDir, f));
              if (st.size < 50000) copyFileSync(join(refsDir, f), join(targetRefs, f));
            } catch { /* skip */ }
          }
        } catch { /* skip unreadable refs */ }
      }
    } catch { /* skip extra file copy errors */ }

    imported++;
  }

  // Update manifest - all imported skills start disabled to avoid prompt bloat
  const manifest = loadManifest();
  for (const dir of dirs) {
    const skillFile = join(sourceDir, dir, 'SKILL.md');
    if (existsSync(skillFile) && !manifest.skills[dir]) {
      manifest.skills[dir] = { enabled: false }; // Start disabled
    }
  }
  saveManifest(manifest);

  return [
    `📦 Skill Import Report:`,
    `  Imported: ${imported}`,
    `  Already exists: ${alreadyExists}`,
    `  Total available: ${imported + alreadyExists}`,
    ``,
    `Imported skills start DISABLED to avoid prompt bloat.`,
    `Enable with: bobo skill enable <name>`,
    ``,
    ...(report.length > 0 ? ['Details:', ...report] : []),
  ].join('\n');
}

/**
 * Initialize skills directory with README
 */
export function initSkills(): void {
  const skillsDir = getSkillsDir();
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  const readmePath = join(skillsDir, 'README.md');
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, `# Custom Skills

Create a subdirectory with a \`SKILL.md\` file to add a custom skill.

Example:
\`\`\`
skills/
└── my-skill/
    └── SKILL.md
\`\`\`

Manage with:
- \`bobo skill list\` — List all skills
- \`bobo skill enable <name>\` — Enable a skill
- \`bobo skill disable <name>\` — Disable a skill
`);
  }

  // Save default manifest
  const manifestPath = getManifestPath();
  if (!existsSync(manifestPath)) {
    const manifest = loadManifest();
    saveManifest(manifest);
  }
}
