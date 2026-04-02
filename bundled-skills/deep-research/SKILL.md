<!-- Imported from OpenClaw. Some features may require tools not available in CLI mode. -->

---
name: deep-research
version: 1.0.0
description: "多模型深度研究 — 支持 Claude/Gemini/OpenAI 路由，并行搜索，交叉验证，带引用报告"
metadata:
  openclaw:
    triggers:
      - "深度研究"
      - "deep research"
      - "用openai深度研究"
      - "用gemini深度研究"
      - "用claude深度研究"
---

# 深度研究 Skill 🔬

多模型深度研究能力，支持用户指定模型路由。

## 触发词与模型路由

解析用户消息，匹配以下模式：

| 用户说 | 使用模型 | 调用方式 |
|--------|---------|---------|
| `用openai深度研究 xxx` | GPT-5.3 | Azure OpenAI API (synthesize.sh openai) |
| `用gemini深度研究 xxx` | Gemini 3.1 Pro | Google AI Studio API (synthesize.sh gemini) |
| `用gemini-dr深度研究 xxx` | Google Deep Research Pro | Google DR API (synthesize.sh gemini-dr) |
| `用claude深度研究 xxx` | Claude Opus 4.6 | 当前模型直接输出 |
| `深度研究 xxx` | Google Deep Research Pro（默认） | Google DR API (synthesize.sh gemini-dr) |

**路由判断**：检查消息开头的"用openai"/"用gemini"/"用claude"关键词。无指定 → 默认 gemini-dr。

> 💡 `用gemini-dr` 使用 Google 的 Deep Research 专用模型（deep-research-pro-preview），专门为综合研究优化，质量可能优于通用 Gemini 3.1 Pro。

## 完整工作流程

### Phase 1: 解析请求

1. 识别模型路由（openai/gemini/claude/默认）
2. 提取研究主题
3. 主题太模糊时，最多追问 1 个问题

### Phase 2: 规划子问题

将主题拆解为 4-6 个独立可搜索的子问题。

### Phase 3: 多轮搜索

对每个子问题调用 `web_search`（每次最多 10 条结果），共 4-6 轮搜索。

### Phase 4: 深度抓取

从搜索结果选 3-5 个最有价值的 URL，用 `web_fetch(url, maxChars=8000)` 读全文。

选择标准：学术论文 > 官方报告 > 权威媒体 > 行业分析 > 博客

### Phase 5: 二次深挖

分析已有资料，对信息不足的子问题补搜 1-2 轮。

### Phase 6: 综合分析（模型路由）

**默认路由（gemini-dr）**：调用 Google Deep Research Pro API（异步 Interactions API），自带搜索能力，无需额外搜索。

**claude 路由**：直接用当前 Claude 模型综合生成报告。

**gemini/openai 路由**：
将所有搜集的资料存为临时文件，然后调用综合脚本：

```bash
SKILL_DIR="$(find /home -path "*/company-skills/deep-research" -type d 2>/dev/null | head -1)"
# 先把资料写入临时文件
echo '<所有来源资料JSON>' > /tmp/dr-sources.json
# 调用综合脚本
bash "${SKILL_DIR}/scripts/synthesize.sh" <provider> "<研究主题>" /tmp/dr-sources.json
```

provider = `gemini` 或 `openai`

如果 API 调用失败，降级到 Claude 处理，报告中注明。

### Phase 7: 输出报告

**输出优先级（按顺序尝试）：**

1. **Slack Canvas 可用** → 创建 Canvas 写入完整报告（最佳体验）
   - 需要 Bot 有 `canvases:write` 权限
   - 如果创建失败，提示用户配置 Canvas 权限，然后降级到方式 2
   - Canvas 配置：Slack App → OAuth & Permissions → 添加 `canvases:write`, `canvases:read` scope
2. **报告 >4000 字** → 生成 PDF 上传到 thread
   - 用 Playwright: `npx -y playwright pdf <html_file> <output.pdf>`
   - 通过 Slack 文件上传三步流程发送
3. **报告较短** → 直接 Slack 消息输出（Markdown 格式）

统一报告格式：

```markdown
# [主题]: 深度研究报告
*生成时间: [日期] | 使用模型: [模型名] | 来源数: [N] | 可信度: [高/中/低]*

## 摘要
[3-5 句关键发现]

## 1. [第一个主要发现]
[带内联引用的详细分析]

## 2. [第二个主要发现]
...

## 关键结论
- [可执行洞察]

## 来源列表
1. [标题](url) — [一句话] ✅ 已验证 / ⚠️ 单源

## 研究方法
搜索 [N] 组关键词，分析 [M] 个来源。模型: [名称版本]
```

## 质量标准

1. 每个关键论断必须有来源，无源标注"AI 推断"
2. 重要事实 ≥2 个独立来源确认；单源标注 ⚠️
3. 优先最近 12 个月的来源
4. 信息不足明确说明，不编造
5. 语言匹配用户（中文问中文答）

## 环境变量

| 变量 | 用途 | 何时需要 |
|------|------|---------|
| GEMINI_API_KEY | Gemini 路由 | 用gemini时 |
| AZURE_OPENAI_API_KEY | OpenAI 路由 | 用openai时 |
| AZURE_OPENAI_ENDPOINT | Azure endpoint | 用openai时 |
| AZURE_OPENAI_DEPLOYMENT | 部署名 | 用openai时 |

## 示例

```
深度研究 2026年全球AI芯片市场格局
用gemini深度研究 React vs Vue 2026技术选型
用openai深度研究 东南亚电商市场进入策略
用gemini-dr深度研究 量子计算商业化前景分析
```

## ⚠️ Gemini DR 异步执行（重要！— Sub-Agent 编排模式）

Gemini DR 是长任务（通常 3-10 分钟），**必须用 sub-agent 独立编排，不阻塞主 session**。

脚本已拆分为两个命令：
- `synthesize.sh gemini-dr-start "<topic>" <sources>` → 启动 interaction，**立即返回 interaction ID**
- `synthesize.sh gemini-dr-check "<interaction_id>" <dummy>` → 检查状态。exit 0=完成(报告在stdout)，exit 10=进行中，exit 3=失败

### 正确做法：spawn sub-agent

**主 session 流程：**
1. 回复用户："🔬 深度研究已启动，预计 3-8 分钟，完成后自动发送报告。"
2. 用 `sessions_spawn` 启动 DR orchestrator sub-agent（见下方模板）
3. 主 session 空闲，可以继续做别的事

**Sub-agent 任务模板：**
```
sessions_spawn(
  task: "你是 DR Orchestrator。执行以下步骤：

  1. 启动 Gemini DR:
     SKILL_DIR=$(find /home -path '*/company-skills/deep-research' -type d 2>/dev/null | head -1)
     echo '<研究主题的详细prompt>' > /tmp/dr-sources.json
     ID=$(bash $SKILL_DIR/scripts/synthesize.sh gemini-dr-start '<主题>' /tmp/dr-sources.json)
     记录 interaction ID: $ID

  2. 每 30 秒检查一次:
     bash $SKILL_DIR/scripts/synthesize.sh gemini-dr-check '$ID' /tmp/dr-sources.json
     - exit 10 → stdout 格式: 'status|updated_timestamp'，记录 updated
     - exit 0  → 拿到报告，进入步骤 3
     - exit 3  → 失败，报告错误

  3. 卡死检测（重要！）:
     - 每次 check 记录 updated 时间戳
     - 如果连续 5 分钟 updated 没变化 → interaction 卡死
     - 卡死处理: 放弃当前 interaction，重新 gemini-dr-start 发起新请求
     - 重试最多 2 次，仍卡死则报告失败

  4. 拿到报告后：格式化为标准研究报告格式，通过 announce 发送给用户。

  超时上限: 15 分钟。超时后报告 interaction ID 让用户手动查询。",
  label: "dr-<slug>",
  mode: "run",
  runTimeoutSeconds: 900
)
```

### ❌ 错误做法（会导致丢失结果）
- ❌ 在主 session 用 exec background + process poll 轮询（session 重置后丢失）
- ❌ 用旧的 `synthesize.sh gemini-dr` 同步模式（exec 超时杀进程，interaction ID 丢失）
- ❌ 不保存 interaction ID（脚本被杀后无法恢复）
- ❌ **用 cron 做 DR 轮询**（无状态、需要清理、浪费 token、容易变孤儿 cron）

**DR 轮询必须在 sub-agent 内部循环完成**，不要创建 cron job。sub-agent 完成即自动退出，没有清理问题。

### 🔄 多路并发研究

**⚠️ Google Gemini DR API 有并发限制！** 同时发 5 个 interaction 可能导致后发的被静默排队/卡死（`updated` 时间戳从未变过）。

**并发规则：**
- **最多同时 3 个** Gemini DR interaction
- 超过 3 个子课题 → 分批：先发 3 个，等完成 1 个后再发下一个
- 每个 interaction 必须有卡死检测（5 分钟 updated 不变 → 重试）

**编排方式（推荐：单 orchestrator）：**
1. spawn 一个总 orchestrator sub-agent
2. orchestrator 维护一个队列，最多 3 个并发槽
3. 每 30 秒轮流 check 所有活跃 interaction
4. 检测到卡死 → 重试该 interaction（占用同一个槽）
5. 某个完成 → 释放槽，从队列取下一个启动
6. 全部完成 → 汇总报告 → announce

**为什么不要每个子课题一个 sub-agent：**
- 无法控制总并发数（5 个 sub-agent 同时 start → 触发限流）
- 单 orchestrator 可以全局调度

### 🧹 Cron 清理（硬性规则！）

**DR 过程中如果创建了任何 cron job（监控、轮询等），DR 完成后必须立即删除。**

- sub-agent orchestrator 完成汇总后，最后一步必须 `cron(action="remove", jobId=xxx)` 清理所有 DR 相关 cron
- 如果用了 cron 做定期检查（而非 sub-agent 内部循环），在拿到最终结果后**立刻删除 cron**
- ❌ 禁止留下孤儿 cron（研究完了 cron 还在跑，每 N 分钟空转浪费 token）
- 建议：cron job name 统一前缀 `dr-monitor-`，方便识别和清理

### 💡 旧模式（gemini-dr）仍可用

`synthesize.sh gemini-dr` 保留向后兼容（同步轮询），适用于 sub-agent 内部调用（sub-agent 有独立超时控制）。
但**主 session 禁止直接调用**。
