# oh-my-claudecode → bobo-cli 收束计划

> 基于 oh-my-claudecode v4.9.1 架构分析，提炼可迁移设计并整合进 bobo-cli

## 核心发现

oh-my-claudecode 不是"某个功能点做得巧"，而是把 Claude Code 包成了**可编排的 agent 操作系统**。

**四大支柱：**
1. **Hooks** — 生命周期事件检测
2. **Skills** — 行为注入（不是人格包）
3. **Agents** — 专业化角色执行
4. **State** — 跨上下文进度追踪

**最值得抄的不是花哨 keyword，而是分层体系：**
- 提示词 / agent / workflow / state / hook / memory / docs 做成了清晰的层次结构
- Skill 作为"行为注入"而非"人格包"的设计
- 项目级 / 用户级配置分层
- 显式工作流命令面（/team, /deep-interview, /ask, /verify）

---

## P0 — 本周必做（核心架构升级）

### 1. 显式工作流命令层

**目标：** 从"自由聊天"升级到"可控执行面"

**新增命令：**
```bash
bobo team <N>:<role> "<task>"     # N 个角色协同
bobo interview "<topic>"          # Socratic 深度访谈
bobo ask <model> "<prompt>"       # 跨模型咨询
bobo verify                       # 对抗性验证
bobo plan "<task>"                # 结构化规划
```

**实现：**
- [ ] `src/workflows/team.ts` — Team pipeline (plan → prd → exec → verify → fix)
- [ ] `src/workflows/interview.ts` — Deep interview (Socratic questioning)
- [ ] `src/workflows/ask.ts` — Multi-model advisor (Claude/GPT/Gemini)
- [ ] `src/workflows/verify.ts` — Adversarial verification
- [ ] `src/workflows/plan.ts` — Structured planning
- [ ] `src/cli.ts` — 注册新命令

**文件结构：**
```
src/
  workflows/
    team.ts
    interview.ts
    ask.ts
    verify.ts
    plan.ts
    index.ts
```

---

### 2. Agent Catalog + 路由层升级

**目标：** 清晰的角色边界 + 任务类型 → agent/模型映射

**当前状态：** bobo-cli 已有 role-based sub-agents 雏形，但边界模糊

**OMC 的 19 个 agent 分 4 lanes：**
- **Build/Analysis Lane:** explore, analyst, planner, architect, debugger, executor, verifier, tracer
- **Review Lane:** security-reviewer, code-reviewer
- **Domain Lane:** test-engineer, designer, writer, qa-tester, scientist, git-master, document-specialist, code-simplifier
- **Coordination Lane:** critic

**bobo-cli 精简版（8 个核心角色）：**
```typescript
// src/agents/catalog.ts
export const AGENT_CATALOG = {
  // Build Lane
  explore: { model: 'haiku', role: 'Fast codebase search' },
  planner: { model: 'opus', role: 'Task sequencing' },
  executor: { model: 'sonnet', role: 'Code implementation' },
  verifier: { model: 'sonnet', role: 'Completion verification' },
  
  // Review Lane
  reviewer: { model: 'opus', role: 'Code review' },
  
  // Domain Lane
  tester: { model: 'sonnet', role: 'Test strategy' },
  writer: { model: 'haiku', role: 'Documentation' },
  
  // Coordination Lane
  critic: { model: 'opus', role: 'Plan challenge' },
} as const;
```

**任务路由规则：**
```typescript
// src/agents/router.ts
export function routeTask(task: string): AgentRole {
  if (task.includes('test')) return 'tester';
  if (task.includes('review')) return 'reviewer';
  if (task.includes('plan')) return 'planner';
  if (task.includes('verify')) return 'verifier';
  if (task.includes('search') || task.includes('find')) return 'explore';
  if (task.includes('doc')) return 'writer';
  return 'executor'; // default
}
```

**实现：**
- [ ] `src/agents/catalog.ts` — Agent 定义
- [ ] `src/agents/router.ts` — 任务路由
- [ ] `src/agents/spawn.ts` — Agent 生成逻辑
- [ ] 更新 `src/sub-agents.ts` 使用新 catalog

---

### 3. 状态与产物层

**目标：** 把过程外化，方便恢复/审计/复盘

**新增目录结构：**
```
.bobo/
  state/
    sessions/
      <session-id>/
        context.json
        history.jsonl
    active-workflows.json
  artifacts/
    plans/
      plan-<timestamp>.md
      prd-<timestamp>.md
    research/
      research-<topic>-<timestamp>.md
    ask/
      ask-<model>-<timestamp>.md
  project-memory.json
  notepad.md
```

**实现：**
- [ ] `src/state/manager.ts` — 状态管理
- [ ] `src/state/artifacts.ts` — 产物写入
- [ ] `src/state/recovery.ts` — 会话恢复
- [ ] 更新 `src/sessions.ts` 使用新状态层

**API：**
```typescript
// 写入产物
await writeArtifact('plans', 'plan-feature-x.md', content);

// 读取状态
const state = await readSessionState(sessionId);

// 恢复会话
const session = await recoverSession(sessionId);
```

---

## P1 — 下周补齐（高价值抽象）

### 4. Team Pipeline

**目标：** OMC 最强抽象，适合 bobo-cli 轻量版

**Pipeline 阶段：**
```
plan → prd → exec → verify → fix (loop)
```

**实现：**
```typescript
// src/workflows/team.ts
export async function runTeamPipeline(task: string, teamSize: number, role: string) {
  // Stage 1: Plan
  const plan = await spawnAgent('planner', `Create plan for: ${task}`);
  await writeArtifact('plans', `plan-${Date.now()}.md`, plan);
  
  // Stage 2: PRD
  const prd = await spawnAgent('planner', `Write PRD based on plan`);
  await writeArtifact('plans', `prd-${Date.now()}.md`, prd);
  
  // Stage 3: Execute (parallel workers)
  const workers = Array(teamSize).fill(null).map((_, i) => 
    spawnAgent(role, `Execute task ${i+1}/${teamSize}`)
  );
  const results = await Promise.all(workers);
  
  // Stage 4: Verify
  const verification = await spawnAgent('verifier', `Verify: ${results.join('\n')}`);
  
  // Stage 5: Fix (if needed)
  if (!verification.passed) {
    return runTeamPipeline(task, teamSize, role); // retry
  }
  
  return { plan, prd, results, verification };
}
```

---

### 5. Skill 三段分层

**目标：** 解决 skill 越装越乱的问题

**OMC 的 Skill 分层：**
```
[Execution Skill] + [0-N Enhancements] + [Optional Guarantee]
```

**三类 Skill：**
1. **Execution Skill** — 主执行逻辑（default, orchestrate, planner）
2. **Enhancement Skill** — 增强能力（ultrawork 并行, git-master 提交, frontend-ui-ux）
3. **Guarantee Skill** — 执行保证（ralph 持久化循环）

**实现：**
```typescript
// src/skills/types.ts
export type SkillType = 'execution' | 'enhancement' | 'guarantee';

export interface Skill {
  name: string;
  type: SkillType;
  triggers: string[];
  prompt: string;
  dependencies?: string[]; // 依赖其他 skill
}

// src/skills/loader.ts
export function loadSkills(): Skill[] {
  const execution = loadSkillsFromDir('bundled-skills/execution');
  const enhancement = loadSkillsFromDir('bundled-skills/enhancement');
  const guarantee = loadSkillsFromDir('bundled-skills/guarantee');
  return [...execution, ...enhancement, ...guarantee];
}

// src/skills/composer.ts
export function composeSkills(skills: Skill[]): string {
  const execution = skills.find(s => s.type === 'execution');
  const enhancements = skills.filter(s => s.type === 'enhancement');
  const guarantee = skills.find(s => s.type === 'guarantee');
  
  return [
    execution?.prompt,
    ...enhancements.map(e => e.prompt),
    guarantee?.prompt,
  ].filter(Boolean).join('\n\n---\n\n');
}
```

**重组现有 Skill：**
```
bundled-skills/
  execution/
    coding.md
    research.md
  enhancement/
    git-advanced.md
    web-enhanced.md
  guarantee/
    ralph.md (持久化循环)
    verification.md (必须验证)
```

---

### 6. 项目级 / 用户级 Skill 分层

**目标：** 清晰的优先级体系

**优先级：**
```
项目级 > 用户级 > 内置
```

**目录结构：**
```
.bobo/skills/          # 项目级（版本控制）
~/.bobo/skills/        # 用户级（跨项目）
bundled-skills/        # 内置（随 CLI 发布）
```

**实现：**
```typescript
// src/skills/loader.ts
export function loadAllSkills(): Skill[] {
  const builtin = loadSkillsFromDir(join(__dirname, '../bundled-skills'));
  const user = loadSkillsFromDir(join(homedir(), '.bobo/skills'));
  const project = loadSkillsFromDir(join(process.cwd(), '.bobo/skills'));
  
  // 项目级覆盖用户级，用户级覆盖内置
  return mergeSkills([builtin, user, project]);
}

function mergeSkills(layers: Skill[][]): Skill[] {
  const map = new Map<string, Skill>();
  for (const layer of layers) {
    for (const skill of layer) {
      map.set(skill.name, skill); // 后加载的覆盖先加载的
    }
  }
  return Array.from(map.values());
}
```

---

## P2 — 可选（锦上添花）

### 7. HUD / Statusline

实时显示当前执行状态（类似 tmux statusline）

```typescript
// src/ui/hud.ts
export function renderHUD(state: AgentState) {
  const { activeAgents, completedTasks, totalTasks } = state;
  console.log(chalk.dim(`[${activeAgents.join(', ')}] ${completedTasks}/${totalTasks}`));
}
```

### 8. tmux Worker Runtime

生成真实的 tmux pane 运行 sub-agent（类似 OMC 的 `omc team N:codex`）

### 9. OpenClaw / Webhook Bridge

支持外部系统监听 bobo-cli 事件

---

## 不建议照搬的点

1. **太多 magic keywords** — 长期会变脏，维护成本高
2. **OMC 的 prompt/command surface 过载** — 用户学习曲线陡峭
3. **强依赖 Claude Code / tmux / plugin 生态** — 移植成本高
4. **README 营销味重** — 产品感强但内核复杂度藏起来

---

## 实施顺序

**Week 1 (P0):**
1. Day 1-2: 工作流命令层 + CLI 注册
2. Day 3-4: Agent catalog + 路由升级
3. Day 5: 状态与产物层

**Week 2 (P1):**
1. Day 1-2: Team pipeline
2. Day 3-4: Skill 三段分层
3. Day 5: 项目级/用户级 skill 分层

**Week 3 (P2, optional):**
1. HUD / tmux worker / webhook bridge

---

## 验收标准

**P0 完成后，bobo-cli 应该能：**
- ✅ `bobo team 3:executor "build REST API"` — 3 个 executor 协同
- ✅ `bobo interview "task management app"` — Socratic 访谈
- ✅ `bobo ask claude "review this code"` — 跨模型咨询
- ✅ `bobo verify` — 对抗性验证
- ✅ `.bobo/state/` 和 `.bobo/artifacts/` 自动生成

**P1 完成后，bobo-cli 应该能：**
- ✅ Team pipeline 自动执行 plan → prd → exec → verify → fix
- ✅ Skill 按 execution/enhancement/guarantee 分类
- ✅ 项目级 skill 覆盖用户级 skill

---

## 下一步

我现在可以：
1. **直接开始实现 P0** — 创建文件骨架 + 核心逻辑
2. **先出一版 PoC** — 只做 `bobo team` 和 agent catalog，验证可行性
3. **你指定优先级** — 你觉得哪个最急

你要我直接开干哪个？汪汪~ 🐕
