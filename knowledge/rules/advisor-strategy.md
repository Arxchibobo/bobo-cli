---
id: "advisor-strategy"
title: "Advisor Strategy — 大小模型协作规则"
category: "core"
tags: ["advisor", "模型协作", "成本控制", "Opus", "Sonnet", "Haiku", "escalation", "agent"]
source: "https://claude.com/blog/the-advisor-strategy + https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool"
---

# Advisor Strategy — 大小模型协作规则

> **核心思想**: 小模型（Sonnet/Haiku）端到端驱动，遇到决策瓶颈时请教大模型（Opus）。
> 大模型只给方向，不执行工具、不产出最终结果。

---

## 什么是 Advisor Strategy

**反直觉**: 不是大模型指挥小模型干活（传统 Orchestrator→Worker），而是——

```
小模型 executor（执行者）全程跑
  ↓ 遇到卡点
  → 请教 Opus advisor（顾问）
  ← 拿到方向/计划/纠正
  → 继续自己跑
```

**效果**: Sonnet + Opus Advisor ≈ Opus 质量，成本降 12%。Haiku + Opus Advisor 质量翻倍，成本只有 Sonnet 的 15%。

---

## 在 bobo-cli 中的对应关系

| Advisor Strategy 概念 | bobo-cli 对应 | 说明 |
|---|---|---|
| Executor | `executor` agent（Sonnet） | 端到端执行任务 |
| Advisor | `planner`/`reviewer`/`critic`（Opus） | 只给方向不动手 |
| escalation 时机 | `router.ts` 路由决策 | 什么时候从 executor 升级到 opus |
| max_uses 成本控制 | cost-tracker.ts | 限制高模型调用次数 |

---

## 何时触发 Advisor（escalation 时机）

### ✅ 应该 escalate 的场景

1. **任务开始前的方向规划** — 读完几个文件后、写代码前
2. **卡住了** — 同一错误反复出现、方法不收敛
3. **要变方向** — 当前路径走不通，考虑换方案
4. **任务完成前的最终审视** — 写完代码/跑完测试后，交付前
5. **多步骤长任务** — 至少首尾各 escalate 一次

### ❌ 不需要 escalate 的场景

- 单轮 Q&A（没什么好规划的）
- 纯机械操作（读文件、跑命令、格式化）
- 下一步已经由工具输出决定了

---

## Advisor 行为规范

### Advisor 的职责（只做这些）
- 输出**计划**（接下来该怎么做）
- 输出**纠正**（当前方向有问题，应该怎么改）
- 输出**停止信号**（不该继续了，理由是什么）

### Advisor 的边界（绝不做这些）
- ❌ 不调用工具
- ❌ 不产出用户可见内容
- ❌ 不执行代码
- ❌ 不管理上下文

### Advisor 输出规范
- 100 词以内，用编号步骤
- 不解释理由，只给指令
- 如果 executor 的证据和 advisor 的建议冲突 → executor 再 escalate 一次确认

---

## 成本控制

### max_uses 原则
| 任务类型 | advisor 调用上限 | 说明 |
|---|---|---|
| 简单任务（1-2 步） | 0 | 不需要 advisor |
| 中等任务（3-5 步） | 1-2 | 开头规划 + 结尾审视 |
| 复杂任务（6+ 步） | 2-3 | 开头 + 中途卡点 + 结尾 |
| 调试任务 | 1-3 | 每次方向变化时 |

### 成本跟踪
- executor tokens → executor 模型费率
- advisor tokens → advisor 模型费率（通常 400-700 text tokens）
- **大部分 token 生成在 executor 侧**，所以总成本接近 executor 模型

---

## 与 bobo-cli Agent Catalog 的整合

### 当前模型分配（catalog.ts）
```
explore  → haiku   （搜索/查找）
planner  → opus    （规划）→ 可作为 advisor 角色
executor → sonnet  （实现）→ 主 executor
verifier → sonnet  （验证）
reviewer → opus    （审查）→ 可作为 advisor 角色
tester   → sonnet  （测试）
writer   → haiku   （文档）
critic   → opus    （挑战）→ 可作为 advisor 角色
```

### Advisor Strategy 优化后
```
executor（sonnet）跑全程
  遇到规划需求 → 请教 planner（opus）作为 advisor
  遇到方向质疑 → 请教 critic（opus）作为 advisor
  交付前 → 请教 reviewer（opus）作为 advisor
```

**关键变化**: 不是 planner→executor→verifier 的流水线，而是 executor 自驱 + 按需 escalate。

---

## System Prompt 注入（coding 任务推荐）

在 executor 的 system prompt 中加入以下内容：

### Timing 指导

```
你有一个 advisor 工具，背后是更强的 reviewer 模型。调用时不需要参数——你的完整对话历史会自动传给它。

在实质性工作之前调用 advisor——在写代码、确定解读、或基于假设推进之前。
如果需要先 orientation（找文件、看现状），先做 orientation，然后调用 advisor。

额外调用时机：
- 你认为任务完成时。调用前先持久化结果（写文件/提交），advisor 调用需要时间。
- 卡住时——错误反复出现、方法不收敛。
- 考虑换方向时。

长任务至少调用两次：确定方向前一次 + 交付前一次。
短任务如果下一步已由工具输出决定，不需要重复调用。
```

### 如何对待 Advisor 的建议

```
认真对待 advisor 的建议。如果按建议做了但经验证失败，或你有一手证据与之矛盾（文件内容、论文数据），则调整。
自测通过不能作为 advisor 建议错误的证据——可能是测试没覆盖 advisor 关注的点。

如果你已有数据指向 A 而 advisor 指向 B：不要默默切换，再调用一次 advisor——
"我发现了 X，你建议 Y，哪个约束能决定？"
advisor 看到了你的证据，但可能低估了权重；一次确认调用比走错分支划算。
```

---

## 与现有工作流的关系

| 现有工作流 | Advisor Strategy 如何优化 |
|---|---|
| `bobo team` | team 模式中 executor 可用 advisor 减少中间同步 |
| `bobo plan` | planner 作为 advisor，executor 调用而非独立阶段 |
| `bobo verify` | verifier 可升级为 advisor 角色，在 executor 完成时自动触发 |
| `bobo ask` | 已有的跨模型咨询，与 advisor 理念一致 |
| 四步工作流 | Step 3（执行到底）中内嵌 advisor escalation |

---

## API 调用参考

```python
# Advisor Tool API（Anthropic Messages API beta）
response = client.beta.messages.create(
    model="claude-sonnet-4-6",           # executor
    max_tokens=4096,
    betas=["advisor-tool-2026-03-01"],
    tools=[
        {
            "type": "advisor_20260301",
            "name": "advisor",
            "model": "claude-opus-4-6",  # advisor
            "max_uses": 3,               # 成本控制
            "caching": {"type": "ephemeral", "ttl": "5m"},  # ≥3次调用时开
        },
        # ... 其他工具
    ],
    messages=[...]
)
```

### 关键细节
- `max_uses` — 单请求内 advisor 调用上限
- `caching` — advisor 侧 prompt 缓存，≥3 次调用才划算
- advisor 不 stream，executor 会暂停等 advisor 返回
- advisor 的 `max_tokens` 不受 executor 的限制
- 多轮对话需完整传回 `advisor_tool_result` blocks

---

**版本**: v1.0
**来源**: Anthropic Advisor Strategy Blog + API Docs (2026-04-09)
**状态**: Active
**内化到**: agents/router.ts 路由逻辑、spawn.ts 模型选择、cost-tracker.ts 成本控制
