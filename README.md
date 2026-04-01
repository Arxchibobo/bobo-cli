# bobo-cli 🐕

> 大波比 — 便携式 AI 助手 CLI

在任何机器上用命令行获得 AI 助手能力，支持文件操作、Shell 执行、多轮对话。

## 安装

```bash
npm i -g bobo-cli
```

## 快速开始

```bash
# 初始化配置
bobo init

# 设置 API Key（支持 OpenAI / Anthropic / Gemini 等兼容 API）
bobo config set apiKey sk-xxx

# 设置模型
bobo config set model claude-sonnet-4-20250514

# 设置 API 地址（可选，默认 Anthropic）
bobo config set baseUrl https://api.openai.com/v1

# 一次性执行
bobo "帮我看看当前目录结构"

# 进入交互模式
bobo
```

## 功能

- 🗣️ **交互模式** — 多轮对话，上下文记忆
- ⚡ **一次性执行** — `bobo "你的问题"` 直接获得答案
- 📁 **文件操作** — 读取、写入、编辑、搜索文件
- 🖥️ **Shell 执行** — 运行本地命令
- 🧠 **知识库** — 内嵌大波比人格和工作规则
- 🔄 **多模型** — Claude / GPT / Gemini，自由切换

## 命令

| 命令 | 说明 |
|------|------|
| `bobo` | 进入交互模式 |
| `bobo "提示词"` | 一次性执行 |
| `bobo config set <key> <value>` | 设置配置 |
| `bobo config get <key>` | 查看配置 |
| `bobo config list` | 显示所有配置 |
| `bobo init` | 初始化 ~/.bobo/ |
| `bobo --version` | 版本号 |

## 交互模式内置命令

| 命令 | 说明 |
|------|------|
| `/clear` | 清空对话历史 |
| `/history` | 查看对话轮数 |
| `/help` | 显示帮助 |
| `/quit` | 退出 |

## 配置项

| Key | 说明 | 默认值 |
|-----|------|--------|
| `apiKey` | API 密钥 | — |
| `model` | 模型名称 | `claude-sonnet-4-20250514` |
| `baseUrl` | API 地址 | `https://api.anthropic.com/v1` |
| `knowledgeDir` | 知识库目录 | `~/.bobo/knowledge` |
| `maxTokens` | 最大输出 token | `4096` |

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
```

## 自定义知识库

编辑 `~/.bobo/knowledge/system.md` 和 `rules.md` 来自定义 AI 的人格和规则。

```bash
bobo init  # 会自动创建模板文件
```

## 内置工具

Agent 可以使用以下工具：

- **read_file** — 读取文件内容
- **write_file** — 写入文件
- **edit_file** — 精确编辑文件
- **search_files** — 搜索文件（glob + grep）
- **list_directory** — 列出目录内容
- **shell** — 执行 Shell 命令

## License

MIT
