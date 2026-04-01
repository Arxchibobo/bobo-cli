# bobo-cli 🐕

> 大波比 — 便携式 AI 工程助手 CLI

在任何机器上用命令行获得完整 AI 工程助手能力。内嵌工程化方法论、持久记忆、Skill 框架、任务规划、Web 工具、项目感知。

## 安装

```bash
npm i -g bobo-cli
```

## 快速开始

```bash
# 初始化配置、知识库、Skill
bobo init

# 设置 API Key
bobo config set apiKey sk-xxx

# 一次性执行
bobo "帮我看看当前目录结构"

# 进入交互模式
bobo
```

## 架构

```
┌─────────────────────────────────────────┐
│              bobo-cli 🐕                 │
├──────────┬──────────┬───────────────────┤
│ Knowledge│  Skills  │   Project Context │
│ (6 files)│ (5 built │   (.bobo/ auto-   │
│ always + │  in +    │    detect)        │
│ on-demand│  custom) │                   │
├──────────┼──────────┼───────────────────┤
│         Memory System (persistent)      │
│     memory.md + daily logs + learnings  │
├──────────┬──────────┬───────────────────┤
│  Core    │ Planner  │  Web Tools        │
│  Tools   │ (plan/   │  (search/fetch)   │
│ (10 个)  │  track)  │                   │
├──────────┴──────────┴───────────────────┤
│     Agent (OpenAI-compatible API)       │
│   streaming + tool calling + context    │
└─────────────────────────────────────────┘
```

## 核心能力

### 🧠 工程化方法论
- **claude-Reconstruction v5.2 工作模式**：计划→确认→执行→验收
- **任务路由器**：自动判断复杂度，选择最优策略
- **错误速查目录**：Top 10 高频错误 + 调试 Checklist
- **验证协议**：对抗性自验，确保交付质量
- **知识按需加载**：根据任务关键词自动加载相关知识

### 💾 持久记忆
- 跨会话记忆（5 种类别：用户偏好/纠正/项目/经验/引用）
- 每日日志自动归档
- 搜索历史记忆
- 自动瘦身（≤5KB）

### 🧩 Skill 框架
5 个内置 Skill + 自定义扩展：
| Skill | 说明 |
|-------|------|
| `coding` | 代码规范、零注释原则、PR 规范 |
| `research` | 搜索策略、信息综合、调研方法 |
| `verification` | 对抗性自验、测试策略 |
| `context-mgmt` | 上下文压缩、token 预算 |
| `self-improve` | 纠正追踪、学习记录、能力进化 |

### 📋 任务规划
- `create_plan` — 创建多步任务计划
- `update_plan` — 追踪步骤进度
- `show_plan` — 查看计划状态
- 复杂任务自动拆解，可视化进度

### 🌐 Web 工具
- `web_search` — DuckDuckGo 搜索（无需 API Key）
- `web_fetch` — 抓取网页，HTML→纯文本

### 📁 项目感知
- 自动检测 `.bobo/` 项目目录
- 加载项目级配置和知识
- 自动识别 `AGENTS.md` / `CLAUDE.md` / `CONVENTIONS.md`

### 🔧 全部工具（15 个）

| 工具 | 说明 |
|------|------|
| `read_file` | 读取文件（支持 offset/limit） |
| `write_file` | 写入文件（自动创建目录） |
| `edit_file` | 精确替换文件内容 |
| `search_files` | glob + grep 搜索 |
| `list_directory` | 列出目录 |
| `shell` | 执行 Shell 命令 |
| `save_memory` | 保存记忆 |
| `search_memory` | 搜索记忆 |
| `git_status` | Git 状态 |
| `git_diff` | Git diff |
| `create_plan` | 创建任务计划 |
| `update_plan` | 更新计划进度 |
| `show_plan` | 显示计划 |
| `web_search` | 网页搜索 |
| `web_fetch` | 抓取网页 |

## CLI 命令

| 命令 | 说明 |
|------|------|
| `bobo` | 进入交互模式 |
| `bobo "提示词"` | 一次性执行 |
| `bobo init` | 初始化 ~/.bobo/ |
| `bobo config set/get/list` | 配置管理 |
| `bobo knowledge` | 查看知识库 |
| `bobo skill list/enable/disable` | Skill 管理 |
| `bobo project init` | 初始化项目 .bobo/ |
| `bobo --version` | 版本号 |

## 交互模式命令

| 命令 | 说明 |
|------|------|
| `/clear` | 清空对话 |
| `/compact` | 压缩上下文 |
| `/history` | 对话轮数 |
| `/status` | 会话状态 |
| `/plan` | 当前任务计划 |
| `/knowledge` | 知识库列表 |
| `/skills` | Skill 列表 |
| `/help` | 帮助 |
| `/quit` | 退出 |

## 多模型支持

```bash
# Claude (Anthropic)
bobo config set baseUrl https://api.anthropic.com/v1
bobo config set model claude-sonnet-4-20250514

# GPT (OpenAI)
bobo config set baseUrl https://api.openai.com/v1
bobo config set model gpt-4o

# Gemini (Google)
bobo config set baseUrl https://generativelanguage.googleapis.com/v1beta/openai
bobo config set model gemini-2.0-flash

# DeepSeek
bobo config set baseUrl https://api.deepseek.com/v1
bobo config set model deepseek-chat
```

## 自定义

### 知识库扩展
```bash
echo "# My Rules" > ~/.bobo/knowledge/my-rules.md
```

### 自定义 Skill
```bash
mkdir -p ~/.bobo/skills/my-skill
echo "# My Skill\nDescription..." > ~/.bobo/skills/my-skill/SKILL.md
```

### 项目配置
```bash
cd your-project
bobo project init    # Creates .bobo/project.json
```

## 数据目录

```
~/.bobo/
├── config.json         # 配置
├── memory.md           # 持久记忆
├── memory/             # 每日日志
├── .learnings/         # 纠正记录
├── knowledge/          # 知识库
├── skills/             # 自定义 Skill
└── skills-manifest.json # Skill 状态
```

## License

MIT
