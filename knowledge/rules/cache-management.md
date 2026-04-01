---
id: "cache-management"
title: "Cache Management & Token Optimization"
category: "domain"
tags: ["🔥 token 燃烧根本原因", "✅ 解决方案矩阵", "🎯 优先级规则", "📊 监控和验证", "每个会话开始时运行", "输出示例", "周期性审计", "🔧 集成到工作流", "1. 检查 cc-cache-fix 是否安装", "2. 运行缓存预热"]
source: "E:/Bobo's Coding cache/.claude/rules/domain/cache-management.md"
---

# Cache Management & Token Optimization

> **版本**: v1.0 (2026-04-01)
> **来源**: cc-cache-fix 集成 + Claude Code 缓存分析
> **目标**: 减少 60-70% token 燃烧，提升缓存命中率

---

## 🔥 Token 燃烧根本原因

### 问题1: Prompt Cache 利用率极低
- **症状**: `cacheCreationInputTokens` = 0, `cacheReadInputTokens` << total input
- **原因**: Delta 附件丢失、Hash 不稳定、TTL 过短
- **影响**: 每次对话重新计算，浪费 70% tokens

### 问题2: 会话恢复缓存丢失
- **症状**: 恢复会话后，缓存完全失效
- **原因**: `deferred_tools_delta` 和 `mcp_instructions_delta` 未持久化
- **影响**: 长期项目中每次恢复都是冷启动

### 问题3: Hash 不稳定
- **症状**: 相同内容不同 turn 的缓存键不同
- **原因**: 注入的元数据（时间戳、ID）影响 hash
- **影响**: 缓存失效率 40-50%

### 问题4: TTL 过短
- **症状**: 5分钟后缓存过期，需要重新计算
- **原因**: Claude Code 默认 TTL 设置
- **影响**: 中等长度会话（>5分钟）缓存无效

---

## ✅ 解决方案矩阵

### 方案A: 使用 cc-cache-fix（快速修复）

**安装**:
```bash
git clone https://github.com/Rangizingo/cc-cache-fix.git
cd cc-cache-fix
./install.sh
```

**使用**:
```bash
claude-patched  # 替代 claude 命令
```

**效果**:
- ✅ 补丁1: 会话恢复缓存保留 → +30% 缓存命中
- ✅ 补丁2: Hash 稳定性 → +20% 缓存命中
- ✅ 补丁3: TTL 1小时 → +15% 缓存命中
- **总计**: ~60% token 节省（相对基准）

**验证**:
```bash
python test_cache.py      # 检查缓存健康度
python usage_audit.py     # 审计读取效率
```

---

### 方案B: Context 压缩（根本优化）

**触发条件**: 任何会话开始时

**执行步骤**:

1. **加载必需文档**（按需加载，不全量）
   ```
   Layer 0: CLAUDE.md (5KB) + 核心规则 (15KB)
   Layer 1: Task Router (3KB)
   Layer 2: 相关能力文档 (15-30KB)
   Layer 3: 具体案例 (按需)
   ```

2. **压缩 CLAUDE.md**
   - 删除重复内容
   - 提取关键规则到 `rules/domain/`
   - 保留索引，不保留详细内容

3. **分离项目级规则**
   - 全局规则: `~/.claude/rules/`
   - 项目规则: `.claude/rules/`
   - 不混合加载

4. **使用 Context Manager**
   - 自动识别任务类型
   - 按需加载相关文档
   - 保持 context 清洁

**效果**: 减少 40-50% 初始 context 大小

---

### 方案C: 会话分割（长任务优化）

**触发条件**: 任务预计 >1小时

**执行步骤**:

1. **分割策略**
   ```
   长任务 (>1小时)
     ↓
   分成 3-5 个短会话 (15-20分钟)
     ↓
   每个会话独立缓存
     ↓
   总 token 节省 30-40%
   ```

2. **会话间数据传递**
   - 使用 `task_plan.md` 保存进度
   - 使用 `notes.md` 保存发现
   - 下一个会话加载这两个文件

3. **缓存预热**
   - 会话开始时加载前一个会话的关键上下文
   - 避免重复计算

**效果**: 长任务 token 节省 30-40%

---

### 方案D: 缓存预热（会话开始优化）

**执行时机**: 每个会话开始

**步骤**:

1. **加载常用上下文**
   ```typescript
   // 会话开始时自动加载
   const warmupContext = [
     'CLAUDE.md',           // 核心规则
     'rules/core/',         // 核心规则
     'memory/MEMORY.md',    // 持久化记忆
     'task_plan.md',        // 当前任务计划
   ];
   ```

2. **预计算常见操作**
   - 加载项目结构
   - 初始化工具链
   - 预加载常用代码片段

3. **缓存验证**
   ```bash
   # 会话开始时运行
   python usage_audit.py --check-warmup
   ```

**效果**: 会话启动时间 -50%, 首次操作 token -30%

---

## 🎯 优先级规则

### 立即应用（所有会话）

```
1. 使用 claude-patched（cc-cache-fix）
   ↓
2. 按需加载 context（不全量）
   ↓
3. 会话开始时缓存预热
   ↓
4. 长任务自动分割
```

### 按任务类型应用

| 任务类型 | 推荐方案 | 预期节省 |
|---------|---------|---------|
| 简单任务 (<15分钟) | A + B | 40-50% |
| 中等任务 (15-60分钟) | A + B + D | 50-60% |
| 长任务 (>1小时) | A + B + C + D | 60-70% |
| 复杂多文件 | A + B + D + 分割 | 60-70% |

---

## 📊 监控和验证

### 缓存健康检查

```bash
# 每个会话开始时运行
python cc-cache-fix/test_cache.py

# 输出示例
✅ Attachment persistence: PASS
✅ Hash stability: PASS
✅ TTL extension: PASS (1h)
📊 Cache hit rate: 78%
💾 Token saved: 2,340 / 3,200 (73%)
```

### 使用审计

```bash
# 周期性审计
python cc-cache-fix/usage_audit.py

# 输出示例
Session: 2026-04-01 10:00
├─ Total input tokens: 3,200
├─ Cache read tokens: 2,340 (73%)
├─ Cache creation tokens: 860 (27%)
├─ Efficiency: 73% ✅
└─ Recommendation: Maintain current strategy
```

### 告警阈值

| 指标 | 正常 | 警告 | 严重 |
|------|------|------|------|
| Cache hit rate | >70% | 50-70% | <50% |
| Token efficiency | >65% | 45-65% | <45% |
| TTL utilization | >80% | 60-80% | <60% |

---

## 🔧 集成到工作流

### 会话开始 Hook

```bash
# ~/.claude/hooks/session-start-cache-warmup.sh

#!/bin/bash

# 1. 检查 cc-cache-fix 是否安装
if ! command -v claude-patched &> /dev/null; then
  echo "⚠️ cc-cache-fix not installed. Install with:"
  echo "  git clone https://github.com/Rangizingo/cc-cache-fix.git && cd cc-cache-fix && ./install.sh"
fi

# 2. 运行缓存预热
python cc-cache-fix/test_cache.py --warmup

# 3. 加载持久化记忆
if [ -f "~/.claude/projects/e--bobo-s-coding-cache/memory/MEMORY.md" ]; then
  echo "✅ Memory loaded"
fi

# 4. 检查 context 大小
CONTEXT_SIZE=$(wc -c < "CLAUDE.md")
if [ $CONTEXT_SIZE -gt 50000 ]; then
  echo "⚠️ CLAUDE.md too large ($CONTEXT_SIZE bytes). Consider splitting."
fi
```

### 任务执行 Hook

```bash
# ~/.claude/hooks/task-execution-cache-monitor.sh

#!/bin/bash

# 监控任务执行期间的缓存效率
python cc-cache-fix/usage_audit.py --monitor --interval 5m
```

---

## 📝 最佳实践清单

### 每个会话

- [ ] 使用 `claude-patched` 而非 `claude`
- [ ] 会话开始时运行 `test_cache.py --warmup`
- [ ] 加载 `memory/MEMORY.md`
- [ ] 检查 CLAUDE.md 大小 (<50KB)

### 每个任务

- [ ] 预估任务时长
- [ ] 如果 >1小时，分割成多个会话
- [ ] 使用 `task_plan.md` 保存进度
- [ ] 使用 `notes.md` 保存发现

### 每周

- [ ] 运行 `usage_audit.py` 审计
- [ ] 检查缓存命中率趋势
- [ ] 优化低效会话
- [ ] 更新 CLAUDE.md（删除过期内容）

### 每月

- [ ] 审视 context 结构
- [ ] 合并重复规则
- [ ] 更新技能索引
- [ ] 评估 token 节省效果

---

## 🚀 快速开始

### 1分钟快速设置

```bash
# 1. 安装 cc-cache-fix
git clone https://github.com/Rangizingo/cc-cache-fix.git
cd cc-cache-fix
./install.sh

# 2. 验证安装
claude-patched --version

# 3. 测试缓存
python test_cache.py

# 4. 从现在开始使用 claude-patched
alias claude=claude-patched
```

### 验证效果

```bash
# 运行两个相同的会话，对比 token 使用

# 会话1（冷启动）
claude-patched
# 输入相同的任务
# 记录 input tokens

# 会话2（热启动）
claude-patched
# 输入相同的任务
# 记录 input tokens

# 对比：会话2 应该节省 40-60% tokens
```

---

## ⚠️ 已知限制

### cc-cache-fix 的限制

- ✅ 解决 Delta 附件丢失
- ✅ 解决 Hash 不稳定
- ✅ 解决 TTL 过短
- ❌ 不能解决 Prompt Cache 设计缺陷
- ❌ 不能解决 MCP 指令重复加载
- ❌ 不能解决跨会话缓存共享

### 需要手动优化的

- Context 压缩（按需加载）
- 会话分割（长任务）
- 缓存预热（会话开始）
- 规则去重（定期维护）

---

## 📚 相关文档

- `performance.md` - 模型选择和性能优化
- `engineering-workflows.md` - 工程化工作流
- `context-budget-analyzer` - Context 预算分析工具
- `context-compressor` - Context 压缩工具

---

**版本**: v1.0
**创建**: 2026-04-01
**状态**: Active
**下一步**: 集成到 performance.md 和 engineering-workflows.md
