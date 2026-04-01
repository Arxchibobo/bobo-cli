---
id: "performance"
title: "Performance Optimization"
category: "root"
tags: ["performance optimization", "model selection strategy", "context window management", "ultrathink + plan mode", "build troubleshooting"]
source: "C:/Users/Administrator/.claude/rules/performance.md"
---

# Performance Optimization

> **新增**: Cache Management (2026-04-01) — 详见 `domain/cache-management.md`

## Cache & Token Optimization (优先级最高)

**立即应用**:

1. **使用 cc-cache-fix** — 安装 `claude-patched` 替代 `claude`
   - 补丁1: Delta 附件持久化 → +30% 缓存命中
   - 补丁2: Hash 稳定性 → +20% 缓存命中
   - 补丁3: TTL 1小时 → +15% 缓存命中
   - **总计**: ~60% token 节省

2. **按需加载 Context** — 不全量加载 CLAUDE.md
   - Layer 0: 核心规则 (20KB)
   - Layer 1: Task Router (3KB)
   - Layer 2: 相关能力 (15-30KB)
   - Layer 3: 具体案例 (按需)

3. **会话分割** — 长任务 (>1小时) 分成 3-5 个短会话
   - 每个会话独立缓存
   - 使用 `task_plan.md` 保存进度
   - 总 token 节省 30-40%

4. **缓存预热** — 会话开始时加载常用上下文
   - 加载 CLAUDE.md + 核心规则 + 记忆
   - 预计算常见操作
   - 首次操作 token -30%

**验证效果**:
```bash
claude-patched
python cc-cache-fix/test_cache.py
python cc-cache-fix/usage_audit.py
```

**预期结果**: 60-70% token 节省（相对基准）

---

## Model Selection Strategy

**Haiku 4.5** (90% of Sonnet capability, 3x cost savings):

- Lightweight agents with frequent invocation
- Pair programming and code generation
- Worker agents in multi-agent systems

**Sonnet 4.5** (Best coding model):

- Main development work
- Orchestrating multi-agent workflows
- Complex coding tasks

**Opus 4.5** (Deepest reasoning):

- Complex architectural decisions
- Maximum reasoning requirements
- Research and analysis tasks

## Context Window Management

Avoid last 20% of context window for:

- Large-scale refactoring
- Feature implementation spanning multiple files
- Debugging complex interactions

Lower context sensitivity tasks:

- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

## Ultrathink + Plan Mode

For complex tasks requiring deep reasoning:

1. Use `ultrathink` for enhanced thinking
2. Enable **Plan Mode** for structured approach
3. "Rev the engine" with multiple critique rounds
4. Use split role sub-agents for diverse analysis

## Build Troubleshooting

If build fails:

1. Use **build-error-resolver** agent
2. Analyze error messages
3. Fix incrementally
4. Verify after each fix
