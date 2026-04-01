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

  verification: {
    description: '对抗性自验、测试策略、质量保证',
    prompt: `# Verification Skill

## 何时必须验证
- ≥3 个文件被编辑
- 后端 / API 变更
- 基础设施 / 配置变更

## 对抗性验证
至少一个对抗性探测：
- 边界值：空输入、超大输入、特殊字符
- 幂等性：同一操作执行两次
- 错误恢复：中途失败能否回滚
- 并发安全：多个请求同时执行

## 验证输出
✅ PASS: [what was verified]
❌ FAIL: [what failed + error details]
⚠️ SKIP: [what wasn't verified + reason]

## 反模式
- ❌ 只读代码不运行就说"看起来对"
- ❌ 假装跑了测试
- ❌ "应该没问题" 不是验证`,
  },

  'context-mgmt': {
    description: '上下文压缩、token 预算管理',
    prompt: `# Context Management Skill

## Token 预算
- <50%: 正常工作
- 50-75%: 注意效率，减少冗余
- >75%: 准备 compact
- >90%: 立即 compact

## 九段式压缩
对话过长时按 9 段输出：
1. 请求意图
2. 技术概念
3. 文件和代码
4. 错误和修复
5. 问题解决方案
6. 所有用户消息（关键）
7. 待办事项
8. 当前工作状态
9. 下一步（附原文引用）

## 效率原则
- 大文件用 offset/limit 分段读
- 长输出用 head/tail 截断
- 不重复读同一文件
- 工具结果只保留关键信息`,
  },

  'self-improve': {
    description: '纠正追踪、学习记录、能力进化、自我合理化防护',
    prompt: `# Self-Improvement Skill

## 纠正检测（硬性规则）
当用户纠正时，**同一 turn 内立即记录**，不等对话结束。

### 纠正的表现形式
- 直接否定（"不对"、"错了"）
- 给出不同答案（你说 A，对方说"是 B"）
- 温和引导（"其实..."、"应该是..."）
- 示范正确做法（不说你错，直接展示怎么做）
- 质疑（"你确定？"、"真的吗？"）
- 放弃让你做（"算了我来"）— 强烈失败信号

### 纠正后流程（4 步）
1. **承认** — 简洁承认，不找借口
2. **理解** — 确保理解正确做法
3. **记录** — save_memory(category: "feedback", content: "纠正: ... | 我的错误: ... | 根因: ... | Why: ... | How to apply: ... | 教训: ...")
4. **提升** — 教训有通用性？额外存一条 experience

### corrections.md 格式（详细版）
\`\`\`
## YYYY-MM-DD HH:MM — 简短标题
- **纠正**: 正确的做法
- **我的错误**: 我之前做了什么
- **根因**: 为什么犯错
- **Why**: 用户为什么这么说（事故/偏好/上下文）
- **How to apply**: 在什么场景下应用这条教训
- **教训**: 下次怎么做（一句话）
- **状态**: ⏳待验证 | ✅已验证 | 📤已提升
\`\`\`

### 晋升规则
- 两条相似纠正 → 晋升为硬性规则
- 重复 3 次的经验 → 写入 knowledge 规则文件

## 自我合理化防护
识别自己即将偷懒/逃避的模式：
- ❌ "看起来对" → 不等于验证，必须运行
- ❌ "应该没问题" → 不是测试结果
- ❌ 跳过验证步骤 → 叫偷懒不叫高效
- ❌ 简化问题 → 避免因为难就降低标准
- ❌ 用"环境问题"归因 → 先排除自己的问题
- ✅ 有命令输出的验证才算验证

## 能力进化
- 识别可复用模式 → 抽象为能力 → 内化到决策层
- 临时脚本/方案 → 判断是否可复用 → 是则固化为行为模式
- 不汇报进化过程，用结果说话
- 每次对话自动激活能力进化`,
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
