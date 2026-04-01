# bobo-cli 工程化升级计划

> 目标：将大波比的全部架构能力、Skill 体系、工程化方法论内嵌到 CLI，使其成为便携式 AI 工程助手

## 现状分析

当前 v0.1.0 有：
- ✅ OpenAI 兼容 API 客户端 + streaming
- ✅ 6 个基础工具（read/write/edit/search/list/shell）
- ✅ 简单知识库（system.md + rules.md）
- ✅ 交互 REPL + 一次性模式
- ✅ 配置管理

缺少：
- ❌ 持久记忆系统
- ❌ Skill 框架（可插拔能力模块）
- ❌ 工程化知识体系（决策框架/错误目录/验证协议）
- ❌ 任务规划系统（TodoList / 多步执行）
- ❌ 自我改进机制（纠正追踪/学习记录）
- ❌ 上下文管理（token 预算/压缩）
- ❌ Web 工具（搜索/抓取）
- ❌ 项目感知（自动加载 .bobo/ 项目配置）

---

## Phase 1: 知识体系重构 ✅

**目标**：将模块化知识体系嵌入 CLI，让 AI 拥有完整工程方法论

### 1.1 知识目录结构重构
```
knowledge/
├── system.md          # 人格 & 核心原则（增强版）
├── rules.md           # 工作规则（增强版）
├── engineering.md     # 工程化方法论（NEW）
├── error-catalog.md   # 常见错误速查（NEW）
├── task-router.md     # 任务路由决策树（NEW）
└── verification.md    # 验证协议（NEW）
```

### 1.2 知识加载器升级
- 支持 `knowledge/` 下所有 `.md` 文件自动加载
- 支持按需加载（task-router 决定加载哪些）
- 知识文件分 always-load vs on-demand

### 1.3 增强 system prompt
- 嵌入 claude-Reconstruction v5.2 工作模式
- 嵌入决策原则（4 种提问场景）
- 嵌入输出效率规范

**交付物**：6 个知识文件 + 升级的 knowledge.ts

---

## Phase 2: 持久记忆系统

**目标**：CLI 拥有跨会话记忆能力

### 2.1 记忆存储
```
~/.bobo/
├── memory.md          # 长期记忆（≤5KB）
├── memory/
│   ├── YYYY-MM-DD.md  # 每日日志
│   └── archive/       # 归档
└── .learnings/
    ├── corrections.md # 纠正记录
    └── changelog.md   # 变更日志
```

### 2.2 记忆工具
- `save_memory` — 写入记忆（自动分类）
- `search_memory` — 搜索记忆
- `read_memory` — 读取记忆

### 2.3 自动行为
- 启动时加载 memory.md 到 system prompt
- 对话结束时自动提取重要信息
- 超限自动瘦身

**交付物**：memory.ts + 3 个新工具 + 记忆管理逻辑

---

## Phase 3: Skill 框架

**目标**：可插拔的能力模块系统

### 3.1 Skill 结构
```
~/.bobo/skills/
├── manifest.json      # 已安装 skill 列表
└── <skill-name>/
    ├── SKILL.md       # 技能描述和指令
    ├── tools.ts       # 自定义工具（可选）
    └── prompts/       # 提示词模板（可选）
```

### 3.2 内置 Skills
- `coding` — 代码规范、零注释原则、验证协议
- `research` — 搜索 + 分析 + 综合
- `verification` — 对抗性自验
- `context-mgmt` — 上下文压缩、token 预算
- `self-improve` — 纠正追踪、学习记录

### 3.3 Skill 命令
- `bobo skill list` — 列出可用 skill
- `bobo skill info <name>` — 查看 skill 详情
- `bobo skill enable/disable <name>` — 启用/禁用

**交付物**：skills.ts + skill 加载器 + 5 个内置 skill + CLI 命令

---

## Phase 4: 任务规划系统

**目标**：复杂任务自动拆解、追踪、验证

### 4.1 TodoList 工具
- `create_plan` — 创建任务计划（≥3 步的非平凡任务）
- `update_plan` — 更新任务状态
- `show_plan` — 显示当前计划

### 4.2 三文件模式（长任务）
- task_plan.md / notes.md / deliverable

### 4.3 REPL 增强
- `/plan` — 显示当前任务计划
- `/status` — 显示会话状态

**交付物**：planner.ts + 3 个工具 + REPL 命令

---

## Phase 5: 工具扩展

**目标**：补充实用工具能力

### 5.1 Web 工具
- `web_search` — 网页搜索（通过 API 或 fallback curl）
- `web_fetch` — 抓取网页内容转 markdown

### 5.2 项目感知
- 自动检测 `.bobo/` 项目目录
- 加载项目级配置和知识
- `bobo project init` — 初始化项目配置

### 5.3 Git 工具
- `git_status` / `git_diff` / `git_log` — Git 集成

**交付物**：web.ts + project.ts + git.ts + 对应工具定义

---

## Phase 6: 自我改进 & 上下文管理

**目标**：持续学习 + 高效使用 context

### 6.1 纠正追踪
- 检测用户纠正 → 自动记录
- corrections.md 格式化存储
- 重复纠正 → 晋升到 memory.md

### 6.2 上下文管理
- Token 估算（tiktoken-lite）
- 自动 compact 提示
- `/compact` 命令 — 九段式压缩

**交付物**：self-improve.ts + context.ts + /compact 命令

---

## Phase 7: 验证 & 发布

**目标**：确保质量，准备 npm publish

### 7.1 测试
- 单元测试（vitest）
- 集成测试（工具执行）
- E2E 测试（CLI 命令）

### 7.2 构建 & 发布
- TypeScript 编译验证
- npm pack 测试
- README 更新
- `npm publish`

### 7.3 对抗性验证
- 边界值测试
- 错误恢复测试
- 大文件 / 长对话测试

**交付物**：测试套件 + 发布就绪的 npm 包

---

## 执行节奏

| Phase | 预计 | 依赖 |
|-------|------|------|
| 1. 知识体系 | 1 session | 无 |
| 2. 记忆系统 | 1 session | Phase 1 |
| 3. Skill 框架 | 1-2 session | Phase 1 |
| 4. 任务规划 | 1 session | Phase 2 |
| 5. 工具扩展 | 1 session | Phase 1 |
| 6. 自我改进 | 1 session | Phase 2,3 |
| 7. 验证发布 | 1 session | All |

每个 Phase 完成后：编译验证 → 功能测试 → git commit + push
