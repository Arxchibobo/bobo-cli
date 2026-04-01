# bobo-cli 🐕

> 大波比 — 便携式 AI 工程助手 CLI

在任何机器上用命令行获得 AI 工程助手能力。内嵌完整工程化方法论、持久记忆系统、智能知识管理。

## 安装

```bash
npm i -g bobo-cli
```

## 快速开始

```bash
# 初始化配置和知识库
bobo init

# 设置 API Key
bobo config set apiKey sk-xxx

# 一次性执行
bobo "帮我看看当前目录结构"

# 进入交互模式
bobo
```

## 核心能力

### 🧠 工程化方法论
- **claude-Reconstruction v5.2 工作模式**：计划→确认→执行→验收
- **任务路由器**：自动判断任务复杂度，选择最优执行策略
- **错误速查目录**：Top 10 高频错误 + 调试 Checklist
- **验证协议**：对抗性自验，确保交付质量

### 💾 持久记忆
- 跨会话记忆（用户偏好、业务经验、纠正记录）
- 自动分类存储（5 种类别）
- 每日日志 + 自动瘦身（≤5KB）
- 搜索记忆查找历史信息

### 📚 智能知识库
- **核心知识**（always-load）：人格 + 工作规则
- **按需加载**（on-demand）：根据任务关键词自动加载工程/调试/验证知识
- **自定义扩展**：用户可在 `~/.bobo/knowledge/` 添加任意 `.md` 文件

### 🔧 内置工具
| 工具 | 说明 |
|------|------|
| `read_file` | 读取文件（支持 offset/limit） |
| `write_file` | 写入文件（自动创建目录） |
| `edit_file` | 精确替换文件内容 |
| `search_files` | glob + grep 搜索 |
| `list_directory` | 列出目录内容 |
| `shell` | 执行 Shell 命令 |
| `save_memory` | 保存记忆 |
| `search_memory` | 搜索记忆 |
| `git_status` | Git 状态 |
| `git_diff` | Git diff |

## 命令

| 命令 | 说明 |
|------|------|
| `bobo` | 进入交互模式 |
| `bobo "提示词"` | 一次性执行 |
| `bobo config set <key> <value>` | 设置配置 |
| `bobo config get <key>` | 查看配置 |
| `bobo config list` | 显示所有配置 |
| `bobo init` | 初始化 ~/.bobo/ |
| `bobo knowledge` | 查看知识库状态 |
| `bobo --version` | 版本号 |

## 交互模式命令

| 命令 | 说明 |
|------|------|
| `/clear` | 清空对话历史 |
| `/compact` | 压缩上下文（保留最近对话） |
| `/history` | 查看对话轮数 |
| `/status` | 查看会话状态 |
| `/knowledge` | 查看加载的知识库 |
| `/help` | 显示帮助 |
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
```

## 自定义知识库

在 `~/.bobo/knowledge/` 放入任意 `.md` 文件，CLI 会自动加载。

```bash
bobo init                          # 创建目录 + 默认知识文件
echo "# My Rules" > ~/.bobo/knowledge/my-rules.md  # 添加自定义规则
bobo knowledge                     # 查看所有知识文件
```

## 配置项

| Key | 说明 | 默认值 |
|-----|------|--------|
| `apiKey` | API 密钥 | — |
| `model` | 模型名称 | `claude-sonnet-4-20250514` |
| `baseUrl` | API 地址 | `https://api.anthropic.com/v1` |
| `knowledgeDir` | 知识库目录 | `~/.bobo/knowledge` |
| `maxTokens` | 最大输出 token | `4096` |

## License

MIT
