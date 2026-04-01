# bobo-cli 🐕

> 大波比 — 便携式 AI 工程助手 CLI

把当前 `main` 分支上的 REPL/agent 产品能力，与结构化知识库、规则系统、技能依赖解析、项目脚手架能力整合到一个可发布的 CLI 中。

## 现在这个版本包含什么

### 1. 交互式 AI 工程助手
默认运行 `bobo` 会进入 REPL，支持：
- 一次性执行 prompt
- 持续对话
- `/compact` 九段式上下文压缩
- `/dream` 记忆整理
- `/plan` 查看任务计划
- 工具调用（文件、git、web、memory、planner）

### 2. 结构化知识库系统
当前 bundled knowledge:
- **Rules**: 15
- **Skills**: 125
- **Workflows**: 6
- **Memory templates**: 5

支持：
- `bobo kb stats`
- `bobo kb search <query>`
- `bobo rules show <id>`
- `bobo skills deps <id>`

### 3. 工程体系复用能力
- skill dependency resolution
- skill bundle/export/import
- project scaffold (`template project`)
- extracted rules / workflows / memory templates

## 安装

### 本地开发
```bash
npm install
npm run build
node dist/index.js --help
```

### 全局使用
```bash
npm install -g .
bobo --help
```

> Node.js >= 18/20+ 推荐（当前项目使用现代 ESM + TypeScript）

## 快速开始

### REPL 模式
```bash
bobo
```

### 一次性执行
```bash
bobo "解释这个 codebase 的架构"
```

### 查看知识库统计
```bash
bobo kb stats
```

### 查看规则
```bash
bobo rules show blocking-rules
```

### 查看技能依赖
```bash
bobo skills deps review-with-security
```

### 生成项目脚手架
```bash
bobo template project --dir ./my-project --name "My Project"
```

## 当前命令体系

### 旧主产品命令（保留）
```bash
bobo config set <key> <value>
bobo config get <key>
bobo config list
bobo init
bobo knowledge
bobo skill list
bobo skill enable <name>
bobo skill disable <name>
bobo skill import <path>
bobo project init
```

### 新结构化命令（已接入 main）
```bash
bobo kb stats
bobo kb search <query>
bobo rules list
bobo rules show <id>
bobo rules search <query>
bobo skills list
bobo skills show <id>
bobo skills search <query>
bobo skills deps <id>
bobo skills bundle <id>
bobo skills export <id> --output ./skill.md
bobo skills import ./skill.md
bobo template skill --name my-new-skill
bobo template rule --name my-new-rule
bobo template project --dir ./my-project --name "My Project"
```

## 知识来源模型

### 旧知识层（main 原有）
用于 REPL 的 prompt 注入与 on-demand 加载：
- `knowledge/system.md`
- `knowledge/rules.md`
- `knowledge/agent-directives.md`
- `knowledge/engineering.md`
- `knowledge/error-catalog.md`
- `knowledge/verification.md`
- `knowledge/task-router.md`
- `knowledge/dream.md`
- `knowledge/advanced-patterns.md`

### 新结构化知识层（已并入）
用于搜索 / 依赖解析 / scaffold / 结构化访问：
- `knowledge/index.json`
- `knowledge/rules/*.md`
- `knowledge/skills/*.md`
- `knowledge/workflows/*.md`
- `knowledge/memory/*.md`

更新流程：
```bash
SOURCE_ROOT="E:/Bobo's Coding cache" npm run kb:extract
npm run kb:validate
```

## Project Scaffold

`bobo template project` 会生成：

```text
.claude/
├── CLAUDE.md
├── settings.json
├── rules/
│   ├── core/
│   └── domain/
└── skills/
```

适合把当前工程体系移植到新项目。

## 开发与验证

```bash
npm run build
npm test
npm run kb:validate
npm run pack:check
```

当前测试覆盖：
- main baseline CLI
- structured knowledge commands
- structured skills + template flows

## 当前状态

已完成：
- main 原 REPL/agent CLI 保持可用
- structured knowledge engine 接入 main
- rules / kb / skills deps / template project 已接入 main
- npm packaging 基本可用
- welcome 界面统一包装

后续可继续增强：
- workflow / memory 结构化命令完全接入 main
- doctor / json output / shell completion
- npm 正式发布

## License

MIT
