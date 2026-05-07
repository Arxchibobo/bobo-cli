# 事件驱动架构模式

## GTM Loop Pattern（跨系统两侧独立 watcher + 事件驱动）

适用于任何"AI agent 建东西 + 人审核 + 后续自动处理"的 pipeline。

### 核心架构
```
Producer (Bot Builder)
  ↓ 事件信号（Slack thread JSON / API status change）
Consumer (LP Builder / Downstream)
```

两侧独立运行，通过共享状态作为触发信号。

### 状态机模式
```
dev_in_progress → submitted_for_review → published/ready → downstream_action
                                       → rejected (with reason)
                                       → blocked (execution failure)
```

### 设计原则
1. **事件驱动 > cron 轮询**：动作由人触发时用 watcher（实时可查），不用长间隔 cron
2. **状态 Literal 不够**：要有运行时类型检查（`status=ready AND int(id) 可解析`）防误触发
3. **两阶段 ID**：开发阶段 UUID → 发布后整数 ID，LP 只在有整数 ID 后才建
4. **守门条件**：下游触发必须满足全部前置条件，不假设上游已完成

### 常见应用
- 内容创建 → 审核 → 翻译 → 发布
- Bot 开发 → submit_review → approve → LP/SEO
- 代码生成 → CI → review → merge → deploy
- 选品 → 建 bot → 上架 → landing page

### 通信协议
- Slack thread 作为事件总线（JSON attachment = 状态变更信号）
- 文件系统 watch（`.approved.json` 出现 = 触发下游）
- API 轮询 + 状态对比（上次 → 本次有 diff = 触发）

### 反模式
- ❌ 所有步骤放一个脚本串行跑（人审核环节会 block 整个链路）
- ❌ 纯时间间隔轮询无状态对比（浪费 + 重复触发）
- ❌ 跳过状态检查直接触发下游（早期数据不完整导致 downstream 失败）
