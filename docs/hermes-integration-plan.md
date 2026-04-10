# Hermes v0.8.0 → Bobo CLI v3.0 集成整理

> 对比 Hermes Agent v0.8.0 (2026.4.8) 和 Bobo CLI v3.0.1，找出值得集成的差异功能。

---

## 📊 命令对比总览

```
命令领域             Hermes v0.8.0          Bobo CLI v3.0        差距
─────────────────────────────────────────────────────────────────────
聊天/Agent          chat (default)          REPL (default)       ≈ 对等
模型选择            model (交互式TUI)       config set model     🔴 缺交互式选模型
状态面板            status (全组件)          status (HUD面板)     ≈ 对等
项目初始化          (无独立命令)             init / project init  ✅ Bobo 更好
配置管理            config show/edit/set     config set/get/list  ≈ 对等
环境诊断            doctor                   doctor               ≈ 对等
Skills              skills (10+子命令)       skill list/enable    🔴 缺 browse/search/install/publish
Plugins             plugins install/update   (无)                 🔴 完全缺失
MCP                 mcp serve/add/remove     mcp status/init      🟡 缺 serve 模式
Sessions            sessions list/export/    sessions (基础)      🟡 缺 browse/export/prune/stats
                    delete/prune/stats/
                    browse/rename/insights
Memory              memory setup/status/off  memory list/add      🟡 缺 provider 配置
Cron                cron 9个子命令           (无)                 🔴 完全缺失
Auth/Login          login/logout/auth pool   config set apiKey    🔴 缺 OAuth + 凭证池
Gateway             gateway 7个子命令        (无)                 ⚪ N/A (Bobo是纯CLI)
Webhook             webhook 4个子命令        (无)                 🟡 可选集成
Profiles            profile 9个子命令        (无)                 🔴 缺多 profile
Logs                logs tail/filter         (无)                 🔴 缺日志系统
Shell Completion    completion bash/zsh      completer (内置)     🟡 缺独立 completion 脚本
ACP Server          acp                      (无)                 🟡 可选
Honcho Memory       honcho 10+子命令         (无)                 🟡 可选高级记忆
Insights/Analytics  insights --days --source cost-tracker          🟡 缺聚合分析面板
Pairing             pairing approve/revoke   (无)                 ⚪ N/A (Bobo是纯CLI)
更新/卸载           update/uninstall/version (无)                 🔴 缺自更新
WhatsApp            whatsapp                 (无)                 ⚪ N/A
```

---

## 🔴 P0 — 必须集成（核心体验差距）

### 1. `bobo model` — 交互式模型选择器
**Hermes**: `hermes model` 打开 TUI 列表，支持 provider+model 一起选，`/model` 命令实时切换
**Bobo**: 只有 `bobo config set model xxx` 手动设置

**集成方案**:
```typescript
// src/workflows/model-picker.ts
// 交互式列表：列出已配置 provider 支持的模型
// 支持搜索过滤、provider 分组、价格显示
// 选中后写入 config + 当前 session 立即生效
bobo model                    # 交互式 TUI 选择
bobo model list               # 列出可用模型
bobo model set <name>         # 直接设置（等同 config set model）
bobo model info <name>        # 显示模型详情（context length, 价格等）
```

### 2. `bobo skills` — 完整 Skill 生态
**Hermes**: browse/search/install/inspect/audit/publish/snapshot/tap — 完整的包管理
**Bobo**: 只有 list/enable/disable/import

**集成方案**:
```typescript
// 扩展 src/skills/ 模块
bobo skill browse              # 浏览 registry（分页）
bobo skill search <query>      # 搜索 skills.sh / GitHub / ClawHub
bobo skill install <id>        # 安装（支持 official/xxx 和 URL）
bobo skill inspect <id>        # 预览不安装
bobo skill update              # 更新已安装
bobo skill publish             # 发布到 registry
bobo skill snapshot export/import  # 快照导入导出
```

### 3. `bobo cron` — 定时任务管理
**Hermes**: list/create/edit/pause/resume/run/remove/status/tick — 完整的 cron 系统
**Bobo**: 完全没有

**集成方案**:
```typescript
// src/cron/ 新模块
bobo cron list                 # 列出定时任务
bobo cron create "prompt" --every 2h --skill xxx
bobo cron edit <id>            # 编辑
bobo cron pause/resume <id>    # 暂停/恢复
bobo cron run <id>             # 手动触发
bobo cron remove <id>          # 删除
bobo cron status               # 调度器状态
```
存储: `~/.bobo/cron.json` + Node.js scheduler（`node-cron` 或自建）

### 4. `bobo auth` — 凭证池管理
**Hermes**: login/logout + auth add/list/remove/reset — 多 provider OAuth + 凭证池轮转
**Bobo**: 只有 `config set apiKey`

**集成方案**:
```typescript
// src/auth/ 新模块
bobo login [provider]          # OAuth 登录（Nous/OpenAI/GitHub 等）
bobo logout [provider]         # 清除凭证
bobo auth add                  # 添加 API key 到凭证池
bobo auth list                 # 列出已配置凭证
bobo auth remove <id>          # 删除凭证
bobo auth reset <provider>     # 重置凭证耗尽状态
```
支持: 多 key 轮转、自动 failover、余额/配额跟踪

### 5. `bobo update` / `bobo version` — 自更新
**Hermes**: `hermes update` 直接拉取最新版本
**Bobo**: 没有自更新机制

**集成方案**:
```typescript
bobo version                   # 显示当前版本 + 检查最新版
bobo update                    # npm update -g bobo-ai-cli
bobo uninstall                 # 清理卸载
```

---

## 🟡 P1 — 建议集成（体验提升）

### 6. `bobo sessions` — 增强 Session 管理
**Hermes**: list/export/delete/prune/stats/rename/browse — 完整会话管理
**Bobo**: 基础的 sessions 命令

**补充**:
```typescript
bobo sessions browse           # 交互式 session 浏览器
bobo sessions export [id]      # 导出为 JSONL
bobo sessions prune --days 30  # 清理旧 session
bobo sessions stats            # 统计概览
bobo sessions rename <id> <name>
```

### 7. `bobo plugins` — 插件系统
**Hermes**: install/update/remove/list/enable/disable + 插件可注册 CLI 子命令 + lifecycle hooks
**Bobo**: 有 hooks 系统但没有 plugin 包管理

**集成方案**:
```typescript
bobo plugin install <git-url>  # 从 Git 安装
bobo plugin list               # 列出已安装
bobo plugin update [name]      # 更新
bobo plugin remove <name>      # 卸载
bobo plugin enable/disable <name>
```
插件可以: 注册 CLI 子命令、hook 文件编辑/shell 执行、扩展工具集

### 8. `bobo profile` — 多配置 Profile
**Hermes**: 9个子命令，完整的多 profile 隔离
**Bobo**: 没有 profile 概念

**集成方案**:
```typescript
bobo profile list              # 列出 profiles
bobo profile create <name>     # 创建新 profile（独立 config/memory/skills）
bobo profile use <name>        # 切换活跃 profile
bobo profile delete <name>     # 删除
bobo profile export/import     # 导入导出
```
每个 profile: `~/.bobo/profiles/<name>/` 独立的 config + memory + skills

### 9. `bobo logs` — 结构化日志
**Hermes**: `hermes logs` tail/filter，agent.log + errors.log
**Bobo**: 没有日志系统

**集成方案**:
```typescript
bobo logs                      # tail 最近日志
bobo logs --level error        # 只看错误
bobo logs --since 1h           # 最近1小时
bobo logs --follow             # 实时跟踪
```
写入: `~/.bobo/logs/agent.log` + `errors.log`

### 10. `bobo insights` — 使用分析
**Hermes**: `hermes insights --days 30 --source cli` — 聚合 token/cost/session 分析
**Bobo**: 有 cost-tracker 但没有聚合分析视图

**集成方案**: 扩展现有 cost-tracker，加 `bobo insights` 命令输出按天/模型/任务类型的聚合分析

---

## 🟢 P2 — 可选集成（锦上添花）

### 11. Shell Completion 独立脚本
```bash
bobo completion bash > ~/.bash_completion.d/bobo
bobo completion zsh > ~/.zsh/completions/_bobo
```
当前 Bobo 有内置 completer，但没有导出为 shell 脚本的能力。

### 12. Webhook 订阅
```typescript
bobo webhook subscribe <url> --event task.complete
bobo webhook list
bobo webhook remove <id>
bobo webhook test <id>
```

### 13. ACP Server 模式
```typescript
bobo acp                       # 作为 ACP server 运行，供编辑器集成
```
让 VS Code / Cursor / 其他编辑器通过 ACP 协议调用 Bobo。

### 14. MCP Serve 模式
```typescript
bobo mcp serve                 # 作为 MCP server 运行，暴露 Bobo 工具
bobo mcp add <config>          # 添加 MCP server 连接
bobo mcp remove <name>         # 移除
```

### 15. Honcho 外部记忆
```typescript
bobo memory provider setup     # 交互式选择记忆 provider
bobo memory provider status    # 当前 provider 状态
```

---

## ⚪ 不集成（不适用于 Bobo CLI 场景）

| Hermes 功能 | 原因 |
|-------------|------|
| gateway 系列 | Bobo 是纯 CLI，不需要消息网关 |
| pairing 系列 | 无多用户 DM 场景 |
| whatsapp | 无消息平台集成 |
| claw migrate | 反向迁移不需要 |

---

## 🏗️ v0.8.0 核心架构特性（值得借鉴）

### Background Process Auto-Notifications
Hermes 的 `notify_on_complete` 让后台任务完成时自动通知 agent。
→ Bobo 的 `process-manager.ts` 可以加类似回调。

### Inactivity-Based Timeouts
Hermes 跟踪实际工具活动而非 wall-clock 时间来判断超时。
→ Bobo 的 autonomous 模式可以借鉴。

### Jittered Retry Backoff
Hermes 用指数退避 + jitter 做 API 重试。
→ Bobo 的 agent.ts API 调用可以加。

### Config Validation at Startup
Hermes 在启动时验证 YAML 配置结构。
→ Bobo 的 `loadConfig()` 可以加 schema validation。

### Oversized Tool Results → File
Hermes 把超大工具结果写文件而非截断。
→ Bobo 的工具执行可以借鉴。

---

## 📋 推荐实施顺序

```
Phase 1 (v3.1.0) — 核心命令补齐
  ├── bobo model (交互式选模型)
  ├── bobo version / bobo update (自更新)
  ├── bobo auth add/list/remove (凭证池)
  └── bobo logs (结构化日志)

Phase 2 (v3.2.0) — 生态系统
  ├── bobo skill browse/search/install (Skill 包管理)
  ├── bobo plugin install/list/remove (插件系统)
  └── bobo sessions browse/export/prune (增强)

Phase 3 (v3.3.0) — 高级功能
  ├── bobo cron (定时任务)
  ├── bobo profile (多 profile)
  ├── bobo insights (使用分析)
  └── 架构优化（notify_on_complete, jitter retry, config validation）

Phase 4 (v4.0.0) — 平台化
  ├── bobo acp (ACP server)
  ├── bobo mcp serve (MCP server)
  ├── bobo webhook (事件订阅)
  └── bobo completion (shell completion 导出)
```

---

## 🔑 关键决策点

1. **Skill Registry**: 自建 vs 兼容 Hermes 的 skills.sh / well-known / ClawHub？
   - 建议: 兼容 Hermes 的 registry 协议，减少重复建设
   
2. **Plugin 格式**: 自定义 vs 兼容 Hermes plugin 格式？
   - 建议: 定义 Bobo 自己的 plugin spec（TypeScript/ESM），但支持 Hermes plugin 兼容层

3. **Session 存储**: 文件 vs SQLite？
   - Hermes 用 SQLite，查询能力更强
   - 建议: 迁移到 SQLite（`better-sqlite3`）

4. **Cron 调度器**: 内置 vs 外部？
   - 建议: 内置（`node-cron`），`bobo cron daemon` 后台运行

5. **Auth OAuth Flow**: 浏览器回调 vs 设备码？
   - 建议: 先做设备码（device code flow），简单且 SSH 友好
