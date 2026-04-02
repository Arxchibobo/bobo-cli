---
name: context-budget-analyzer
description: 上下文 Token 预算分析 — 按类别统计 token 使用（工具调用/用户消息/附件/重复文件读取），找出浪费点。适用于：(1) 对话快到 context 上限时诊断 (2) 优化长对话的 token 使用 (3) 发现重复文件读取等低效模式。灵感源自 Claude Code contextAnalysis.ts。
---

# Context Budget Analyzer

## 核心理念

> 不知道 token 花在哪里，就无法优化。

## 分析维度

### 1. 按消息类型
```
Human messages:     XXX tokens (XX%)
Assistant messages: XXX tokens (XX%)
Tool requests:      XXX tokens (XX%)
Tool results:       XXX tokens (XX%)
Attachments:        XXX tokens (XX%)
System/Other:       XXX tokens (XX%)
─────────────────────────────────
Total:              XXX tokens
```

### 2. 按工具分布
```
Tool Requests:
  BashTool:     XXX tokens (N 次)
  FileRead:     XXX tokens (N 次)
  FileEdit:     XXX tokens (N 次)
  WebFetch:     XXX tokens (N 次)

Tool Results:
  BashTool:     XXX tokens (N 次)
  FileRead:     XXX tokens (N 次)  ← 通常最大
```

### 3. 重复文件读取检测

**最大浪费源之一：同一文件被 FileRead 多次。**

```
⚠️ Duplicate File Reads:
  src/auth.py:       3 次, ~2400 tokens 浪费
  src/config.ts:     2 次, ~800 tokens 浪费
  Total waste:       ~3200 tokens
```

## 优化建议

| 发现 | 优化 |
|---|---|
| 重复文件读取 | 一次读取后缓存内容，不要再读 |
| Tool results 占比 >50% | 使用更精准的搜索（grep 替代全文件读取）|
| Attachments 占比高 | 压缩前移除图片块 |
| 单个 Bash 输出超大 | 加 `head -N` 或 `\| tail -N` 限制输出 |
| Assistant 消息过长 | 减少重复解释，更简洁 |

## 使用方式

对话中感觉 context 紧张时，做一次快速分析：

1. 回顾本轮对话的工具调用次数
2. 识别是否有同一文件被多次读取
3. 检查 Bash 输出是否过长
4. 决定是否需要 compact

## 预算红线

| 阈值 | 行动 |
|---|---|
| 总 token < 50% 上限 | 正常工作 |
| 总 token 50-75% | 注意效率，避免大文件全量读取 |
| 总 token > 75% | 考虑主动 compact |
| 总 token > 90% | 立即 compact，否则下一轮可能截断 |
