# Architecture Audit — v0.7.0

## 当前架构图

```
bobo CLI
├── CLI Layer (index.ts)
│   ├── Commands: config, init, knowledge, skill, project
│   └── REPL: /clear /compact /dream /status /plan /knowledge /skills /help
│
├── Agent Core (agent.ts)
│   ├── System Prompt Assembly:
│   │   Layer 1: Knowledge (always + on-demand)
│   │   Layer 2: Memory
│   │   Layer 3: Skills
│   │   Layer 4: Project context
│   │   Layer 5: Environment
│   └── Tool Loop (max 20 iterations, streaming)
│
├── Knowledge System (knowledge.ts)
│   ├── Always: system.md, rules.md, agent-directives.md
│   ├── On-demand: engineering, error-catalog, verification,
│   │             task-router, dream, advanced-patterns
│   └── Custom: user's additional .md files
│
├── Memory System (memory.ts)
│   ├── memory.md (structured, 5KB cap, auto-slim)
│   ├── memory/*.md (daily logs)
│   └── .learnings/ (corrections, changelog)
│
├── Skills (skills.ts)
│   ├── 2 Builtin: coding, research
│   └── 45 Imported: adversarial-verification, context-compressor, etc.
│
├── Tools (17 total)
│   ├── File: read, write, edit, search, list_directory
│   ├── Shell: shell
│   ├── Memory: save_memory, search_memory
│   ├── Git: status, diff, log, commit
│   ├── Planner: create_plan, update_plan, show_plan
│   └── Web: web_search, web_fetch
│
├── Planner (planner.ts) — session-scoped task tracking
├── Project (project.ts) — .bobo/ project config + auto-detect
└── Web (web.ts) — DuckDuckGo search + curl fetch
```

## 发现的问题

### P1: Skill Prompt 注入顺序不对
agent.ts 中 system prompt 组装顺序：
1. Knowledge → 2. Memory → 3. Skills → 4. Project → 5. Env

**问题**: Skills 在 Memory 之后注入。但 skills 的指令（如 adversarial-verification）应该在 memory 之前，因为 skill 是行为规则，memory 是数据。
**修复**: Skills → Knowledge → Memory → Project → Env

### P2: Knowledge 的 on-demand 触发词不完整
`task-router.md` 的 trigger keywords 是空数组 `[]`，永远不会被自动加载。
`agent-directives.md` 在 ALWAYS_LOAD 里很好，但 `advanced-patterns.md` 的触发词缺少关键场景。
**修复**: 给 task-router 加触发词，补充 advanced-patterns 触发词。

### P3: /compact 命令太简陋
当前只是保留最后 8 条消息。知识文件里定义了九段式压缩，但代码没实现。
**修复**: 用 agent 调用实现真正的九段式压缩。

### P4: 缺少 context decay 实现
agent-directives.md 说"10+ 消息后必须重新读文件"，但代码没有任何 decay 检测。
**修复**: 在 agent.ts 中加入 message count 检测 + warning 注入。

### P5: Skills 的 description 截断不一致
有些 skill description 特别长（整段话），有些是空的（`|` 或 `>`）。
**修复**: 统一截断到 80 字符。

### P6: 缺少 init 时的 skill 默认启用
`bobo init` 创建目录但不设置默认 skill manifest。用户需要手动 import。
**修复**: init 时如果检测到 OpenClaw skills 目录就提示 import。

### P7: web_search 可靠性差
DuckDuckGo Lite HTML 解析很脆弱，经常空结果。
**修复**: 加 fallback 到 curl+Google 或 Brave API。

### P8: edit_file 只替换第一次出现
当文件中同一段文本出现多次时只替换第一个，可能导致 bug。
**修复**: 与 agent-directives.md 的"编辑完整性"规则对齐，加 re-read 验证。

### P9: 缺少 git_push 工具
有 git_commit 但没有 git_push，完整的 git 工作流断裂。

### P10: memory 的 search 是简单 keyword 匹配
没有语义搜索，只做 keyword.includes()。对长期记忆的检索效果差。
**修复**: 先改善为 TF-IDF 或至少多关键词 AND/OR 逻辑。
