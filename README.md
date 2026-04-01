# bobo-cli 🐕

> 大波比 — 便携式 AI 工程助手 CLI

把 Claude Code 的架构能力、Skill 体系和工程化方法论塞进一个可移植的 CLI 工具。

## 安装

```bash
git clone https://github.com/Arxchibobo/bobo-cli.git
cd bobo-cli
npm install && npm run build
npm link  # 全局安装 bobo 命令
```

## 快速开始

```bash
# 初始化
bobo init
bobo config set apiKey sk-xxx

# 一次性执行
bobo "解释这个 codebase 的架构"

# 交互模式（REPL）
bobo
```

## 架构

```
bobo CLI v0.8.0
│
├── Knowledge System (9 files)
│   ├── Always-load: system.md, rules.md, agent-directives.md
│   └── On-demand: engineering, error-catalog, verification,
│                  task-router, dream, advanced-patterns
│
├── Skill System (47 skills)
│   ├── 2 Builtin: coding, research
│   ├── 7 Core enabled: adversarial-verification, context-compressor,
│   │   context-budget-analyzer, proactive-self-improving, high-agency,
│   │   memory-manager, deep-research
│   └── 38 On-demand: ljg-*, nano-banana-pro, scrapling, semrush...
│
├── Tool System (18 tools)
│   ├── File: read, write, edit, search, list_directory
│   ├── Shell: shell
│   ├── Memory: save_memory, search_memory
│   ├── Git: status, diff, log, commit, push
│   ├── Planner: create_plan, update_plan, show_plan
│   └── Web: web_search, web_fetch
│
├── Memory System
│   ├── memory.md (5KB cap, auto-slim, 4-type taxonomy)
│   ├── memory/*.md (daily logs)
│   └── .learnings/ (corrections, changelog)
│
├── Project System (.bobo/)
│   └── Auto-detects AGENTS.md, CLAUDE.md, CONVENTIONS.md
│
└── Context Management
    ├── On-demand knowledge loading (keyword triggers)
    ├── Context decay detection (10+ turns warning)
    └── Nine-section compact (/compact)
```

## System Prompt 注入顺序

1. **Knowledge** — 人格 + 规则 + 工程方法论
2. **Skills** — 启用的 Skill 行为指令
3. **Memory** — 持久记忆（偏好/纠正/经验）
4. **Project** — 项目级配置和规则
5. **Environment** — 工作目录 + Context decay warning

## CLI 命令

```bash
bobo config set <key> <value>   # 配置
bobo config list                # 查看配置
bobo init                       # 初始化 ~/.bobo/
bobo knowledge                  # 查看知识库
bobo skill list                 # 列出所有 Skill
bobo skill enable <name>        # 启用 Skill
bobo skill disable <name>       # 禁用 Skill
bobo skill import <path>        # 从 OpenClaw 导入 Skill
bobo project init               # 初始化项目 .bobo/
```

## REPL 命令

```
/clear     — 清空对话历史
/compact   — 九段式上下文压缩
/dream     — 记忆整理（整合 + 晋升 + 清理）
/status    — 会话状态
/plan      — 查看任务计划
/knowledge — 查看知识库
/skills    — 查看 Skill 列表
/help      — 帮助
/quit      — 退出
```

## 工程知识体系

来源：Claude Code 源码分析 + CLAUDE.MD 机械性覆盖规则

| 知识文件 | 内容 | 加载方式 |
|---------|------|---------|
| system.md | 人格、工作模式、纠正检测、主动记忆 | always |
| rules.md | 代码规范、诚实报告、git 规范 | always |
| agent-directives.md | 10 条机械性覆盖规则（Step 0、分阶段执行等）| always |
| engineering.md | 任务路由、搜索策略、三文件模式 | on-demand |
| error-catalog.md | E001-E010 高频错误速查 | on-demand |
| verification.md | 对抗性验证协议 | on-demand |
| task-router.md | 任务分类策略 | on-demand |
| dream.md | Dream 记忆整理协议 | on-demand |
| advanced-patterns.md | 记忆类型学、九段式详细版、子代理架构 | on-demand |

## License

MIT
