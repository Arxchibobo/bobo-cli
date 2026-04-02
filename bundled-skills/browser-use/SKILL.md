---
id: "browser-use"
title: "Browser-Use Skill"
category: "infrastructure"
tags: ["browser-use skill", "📚 概述", "🚀 快速开始", "创建环境", "安装 browser-use 和 chromium", "browser use（推荐 - 最快速度 + 最低成本）", "或者使用其他 llm", "🏗️ 核心概念", "🛠️ 开发规则", "🎯 开发命令"]
triggers: []
dependencies: []
source: "E:/Bobo's Coding cache/.claude/skills/browser-use"
---

# Browser-Use Skill

> AI 驱动的浏览器自动化库 - 使用 LLM 控制浏览器完成复杂任务

## 📚 概述

Browser-Use 是一个 async Python >= 3.11 库，通过 LLM + CDP (Chrome DevTools Protocol) 实现 AI 浏览器驱动能力。核心架构使 AI agents 能够自主导航网页、与元素交互、通过处理 HTML 并做出 LLM 驱动的决策来完成复杂任务。

## 🚀 快速开始

### 1. 安装 Browser-Use

```bash
# 创建环境
pip install uv
uv venv --python 3.12
source .venv/bin/activate
# Windows 使用: .venv\Scripts\activate

# 安装 browser-use 和 chromium
uv pip install browser-use
uvx browser-use install
```

### 2. 选择你喜欢的 LLM

创建 `.env` 文件并添加 API key：

```bash
# Browser Use（推荐 - 最快速度 + 最低成本）
BROWSER_USE_API_KEY=your_key_here
# 在 https://cloud.browser-use.com/new-api-key 获取 $10 免费额度

# 或者使用其他 LLM
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
```

### 3. 运行第一个 Agent

```python
from browser_use import Agent, ChatBrowserUse
from dotenv import load_dotenv
import asyncio

load_dotenv()

async def main():
    llm = ChatBrowserUse()
    task = "查找 Hacker News 上排名第一的帖子"
    agent = Agent(task=task, llm=llm)
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
```

### 4. 生产部署

使用 `@sandbox` 装饰器部署到生产环境，并扩展到百万级 agents：

```python
from browser_use import Browser, sandbox, ChatBrowserUse
from browser_use.agent.service import Agent
import asyncio

@sandbox(cloud_profile_id='your-profile-id')
async def production_task(browser: Browser):
    agent = Agent(
        task="你的认证任务",
        browser=browser,
        llm=ChatBrowserUse()
    )
    await agent.run()

asyncio.run(production_task())
```

同步本地 cookies 到云端：

```bash
export BROWSER_USE_API_KEY=your_key && curl -fsSL https://browser-use.com/profile.sh | sh
```

## 🏗️ 核心概念

### Agent 基础

```python
from browser_use import Agent, ChatBrowserUse

agent = Agent(
    task="搜索最新 AI 新闻",
    llm=ChatBrowserUse(),
)

async def main():
    history = await agent.run(max_steps=100)

    # 访问有用信息
    history.urls()                    # 访问过的 URL 列表
    history.action_names()            # 执行的操作名称
    history.final_result()            # 最终提取的内容
    history.is_successful()           # 检查是否成功完成
```

### Browser 配置

```python
from browser_use import Agent, Browser, ChatBrowserUse

browser = Browser(
    headless=False,  # 显示浏览器窗口
    window_size={'width': 1000, 'height': 700},
    proxy=ProxySettings(server='http://host:8080'),
    user_data_dir='./profile',  # 保持登录状态
)

agent = Agent(
    task='搜索 Browser Use',
    browser=browser,
    llm=ChatBrowserUse(),
)
```

### Tools（工具）

自定义工具扩展 agent 能力：

```python
from browser_use import Tools, ActionResult, Browser

tools = Tools()

@tools.action('向人类询问问题')
def ask_human(question: str, browser: Browser) -> ActionResult:
    answer = input(f'{question} > ')
    return f'人类回答: {answer}'

agent = Agent(
    task='向人类寻求帮助',
    llm=llm,
    tools=tools,
)
```

## 🛠️ 开发规则

### 核心原则

1. **始终使用 `uv` 而不是 `pip`**

   ```bash
   uv venv --python 3.11
   source .venv/bin/activate
   uv sync
   ```

2. **类型安全编码**
   - 使用 Pydantic v2 模型进行所有内部操作
   - 使用现代 Python 类型提示：`str | None` 而非 `Optional[str]`

3. **Pre-commit 格式化**
   - 在提交 PR 前始终运行 pre-commit

4. **使用描述性名称和文档字符串**

5. **返回 `ActionResult` 结构化内容**
   - 帮助 agent 更好地推理

6. **从不创建随机示例**
   - 测试功能时使用终端内联代码

7. **默认推荐 `ChatBrowserUse` 模型**
   - 最高准确度 + 最快速度 + 最低 token 成本

## 🎯 开发命令

```bash
# 设置
uv venv --python 3.11
source .venv/bin/activate
uv sync

# 测试
uv run pytest -vxs tests/ci        # CI 测试
uv run pytest -vxs tests/          # 所有测试

# 质量检查
uv run pyright                      # 类型检查
uv run ruff check --fix            # Linting
uv run ruff format                 # 格式化
uv run pre-commit run --all-files  # Pre-commit hooks

# MCP 服务器模式
uvx browser-use[cli] --mcp
```

## 📖 可用工具（Actions）

### 导航和浏览器控制

- `search` - 搜索查询（DuckDuckGo、Google、Bing）
- `navigate` - 导航到 URL
- `go_back` - 返回浏览器历史
- `wait` - 等待指定秒数

### 页面交互

- `click` - 通过索引点击元素
- `input` - 输入文本到表单字段
- `upload_file` - 上传文件
- `scroll` - 滚动页面
- `find_text` - 滚动到页面上的特定文本
- `send_keys` - 发送特殊按键（Enter、Escape 等）

### JavaScript 执行

- `evaluate` - 在页面上执行自定义 JavaScript 代码

### 标签页管理

- `switch` - 在浏览器标签页之间切换
- `close` - 关闭浏览器标签页

### 内容提取

- `extract` - 使用 LLM 从网页提取数据

### 视觉分析

- `screenshot` - 请求下一个浏览器状态的截图

### 表单控件

- `dropdown_options` - 获取下拉选项值
- `select_dropdown` - 选择下拉选项

### 文件操作

- `write_file` - 写入内容到文件
- `read_file` - 读取文件内容
- `replace_file` - 替换文件中的文本

### 任务完成

- `done` - 完成任务（始终可用）

## 💡 提示技巧

### 1. 具体 vs 开放式

**✅ 具体（推荐）**

```python
task = """
1. 访问 https://quotes.toscrape.com/
2. 使用 extract 操作查询 "前 3 条引用及其作者"
3. 使用 write_file 操作将结果保存到 quotes.csv
4. 对第一条引用进行 Google 搜索并找到写作时间
"""
```

**❌ 开放式**

```python
task = "访问网络并赚钱"
```

### 2. 直接命名操作

当你确切知道 agent 应该做什么时，直接引用操作名称：

```python
task = """
1. 使用 search 操作查找 "Python 教程"
2. 使用 click 在新标签页中打开第一个结果
3. 使用 scroll 操作向下滚动 2 页
4. 使用 extract 提取前 5 项的名称
5. 如果页面未加载，等待 2 秒，刷新并等待 10 秒
6. 使用 send_keys 操作输入 "Tab Tab ArrowDown Enter"
"""
```

### 3. 通过键盘导航处理交互问题

有时按钮无法点击（你发现了库中的 bug - 提交 issue）。好消息 - 通常可以通过键盘导航解决！

```python
task = """
如果提交按钮无法点击：
1. 使用 send_keys 操作输入 "Tab Tab Enter" 进行导航和激活
2. 或使用 send_keys 输入 "ArrowDown ArrowDown Enter" 提交表单
"""
```

### 4. 自定义操作集成

```python
@controller.action("从认证器应用获取 2FA 代码")
async def get_2fa_code():
    # 你的实现
    pass

task = """
使用 2FA 登录：
1. 输入用户名/密码
2. 提示输入 2FA 时，使用 get_2fa_code 操作
3. 永远不要尝试从页面手动提取 2FA 代码
4. 始终使用 get_2fa_code 操作获取认证代码
"""
```

### 5. 错误恢复

```python
task = """
稳健的数据提取：
1. 访问 openai.com 查找他们的 CEO
2. 如果由于反机器人保护导航失败：
   - 使用 Google 搜索查找 CEO
3. 如果页面超时，使用 go_back 并尝试替代方法
"""
```

## 🌟 高级功能

### 结构化输出

使用 Pydantic 模型获取结构化输出：

```python
from pydantic import BaseModel

class Quote(BaseModel):
    text: str
    author: str

agent = Agent(
    task="提取前 3 条引用",
    llm=llm,
    output_model_schema=Quote,
)

history = await agent.run()
structured_data = history.structured_output
```

### 远程浏览器（Browser-Use Cloud）

```python
from browser_use import Browser, ChatBrowserUse

# 简单：使用 Browser-Use 云浏览器服务
browser = Browser(use_cloud=True)

# 高级：配置云浏览器参数
browser = Browser(
    cloud_profile_id='your-profile-id',  # 特定浏览器配置
    cloud_proxy_country_code='us',       # 代理位置
    cloud_timeout=30,                    # 会话超时（分钟）
)
```

### MCP 集成

Browser-Use 支持两种模式：

1. **作为 MCP 服务器**：向 MCP 客户端（如 Claude Desktop）公开浏览器自动化工具
2. **使用 MCP 客户端**：Agent 可以连接到外部 MCP 服务器以扩展能力

```bash
# 作为 MCP 服务器运行
uvx browser-use[cli] --mcp
```

## 📂 项目结构

```
browser_use/
├── agent/              # Agent 核心逻辑
│   ├── service.py     # 主编排器
│   ├── views.py       # Pydantic 模型
│   └── system_prompt*.md  # Agent 提示词
├── browser/           # 浏览器管理
│   ├── session.py    # BrowserSession + CDP 客户端
│   └── profile.py    # 浏览器配置和启动参数
├── dom/              # DOM 处理
│   └── service.py    # DomService 提取和处理
├── tools/            # 操作注册表
│   └── service.py    # 工具定义
├── llm/              # LLM 集成层
└── mcp/              # MCP 集成
    └── client.py     # MCP 客户端连接
```

## 🔗 相关资源

- **GitHub**: https://github.com/browser-use/browser-use
- **文档**: https://docs.browser-use.com
- **Discord**: https://link.browser-use.com/discord
- **Cloud**: https://cloud.browser-use.com

## 🤝 支持

- 查看 [GitHub Issues](https://github.com/browser-use/browser-use/issues)
- 在 [Discord 社区](https://link.browser-use.com/discord) 提问
- 企业支持：support@browser-use.com
