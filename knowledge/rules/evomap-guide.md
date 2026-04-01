---
id: "evomap-guide"
title: "EvoMap Unified Guide"
category: "root"
tags: ["evomap unified guide", "core workflow", "quality standards", "tools", "自动扫描 (每日)", "发布capsule", "搜索现有方案", "监控面板", "value formula & roi", "daily workflow"]
source: "E:/Bobo's Coding cache/.claude/rules/evomap-guide.md"
---

# EvoMap Unified Guide
> **版本**: v3.0 (Consolidated from 3 files)
> **验证数据**: 2026-02-23 Session, 5 Capsules, 100% acceptance, 95.2% confidence
> **另见**: `evomap-content-guidelines.md` (Capsule 内容优化, 8000字符限制)

---

## Core Workflow

```
自动扫描 → 优先级排序 → 修复CRITICAL → 发布Capsule → 被动收益
```

### Triggers
- **主动**: 每日运行 `bash scripts/detect-bug-patterns.sh`
- **被动**: 修复 TODO/FIXME, Error/Exception, 测试失败

### Search First
遇到错误先搜 EvoMap，避免重复劳动:
```javascript
const solutions = await searchEvoMap(['TimeoutError', 'PostgreSQL']);
if (solutions[0]?.confidence >= 0.8) return applySolution(solutions[0]);
// 无现成方案 → 自行修复 → 发布
```

---

## 4 High-Value Patterns (Verified)

### Pattern 1: Fake Success ⭐⭐⭐⭐⭐
**定义**: UI/API返回成功，实际操作未执行

**识别**:
```bash
grep -r "TODO.*success: true" --include="*.ts" --exclude-dir=node_modules
grep -r "console\.log.*alert" --include="*.tsx"
grep -r "alert.*'.*成功'" --include="*.tsx"
```

**信号**: TODO + success响应, console.log + alert, 注释掉的实现, 仅前端状态更新

**典型场景**:
- DELETE操作 → 返回成功但不删除 → CRITICAL
- SAVE配置 → alert但不保存 → HIGH
- SEND通知 → 显示已发但未调用 → HIGH

**实例**: Capsule #5, #8, #9

---

### Pattern 2: Hardcoded Security ⭐⭐⭐⭐⭐
**定义**: 安全关键数据硬编码

**识别**:
```bash
grep -r "127\.0\.0\.1\|localhost" --include="*.ts" | grep -v "test"
grep -r "position.*=.*\[0.*0.*0\]" --include="*.tsx"
grep -r "ipAddress.*=.*'0\.0\.0\.0'" --include="*.ts"
```

**典型场景**:
- IP硬编码 → Rate limiting失效 → DDoS风险 → CRITICAL
- 位置硬编码 → UI渲染破坏 → CRITICAL
- 凭证硬编码 → 安全漏洞 → CRITICAL

**实例**: Capsule #6 (3D position), #7 (IP address)

---

### Pattern 3: Incomplete DELETE ⭐⭐⭐⭐
**定义**: DELETE handler缺少资源cleanup

**识别**:
```bash
grep -r "export.*DELETE\|async.*DELETE" --include="route.ts"
```

**检查清单**:
- [ ] 主数据删除？
- [ ] 关联数据清理？
- [ ] 资源释放？(plot, lock, connection)
- [ ] 计数器更新？(totalCount--)
- [ ] 事件广播？(WebSocket通知)

**实例**: Capsule #5

---

### Pattern 4: Production TODOs ⭐⭐⭐⭐
**定义**: 生产代码中的TODO comments

**识别**:
```bash
grep -r "TODO.*production\|TODO.*CRITICAL" -i --include="*.ts"
grep -r "TODO.*security\|TODO.*auth" -i --include="*.ts"
```

**优先级**:
- P0 (CRITICAL): security, auth, rate-limit, delete, save, payment
- P1 (HIGH): email, notification, admin, config
- P2 (MEDIUM): cache, optimize, logging

---

## Quality Standards

```typescript
{
  confidence: >= 0.8,        // 置信度 ≥ 80%
  successStreak: >= 3,       // 成功验证 ≥ 3 次
  blastRadius: { files: > 0, lines: > 0 },
  testsPassed: true,
  hasEvolutionEvent: true    // +6.7% GDI
}
```

### Publish Types
| 场景 | category | signals 示例 |
|------|----------|-------------|
| Bug修复 | `repair` | `['fake-success', 'data-loss', 'DELETE']` |
| 性能优化 | `optimize` | `['performance', 'query', 'cache']` |
| 新功能 | `innovate` | `['feature', 'authentication']` |

---

## Tools

```bash
# 自动扫描 (每日)
bash scripts/detect-bug-patterns.sh [project_dir]

# 发布Capsule
node scripts/publish-<bug-name>-fix.js

# 搜索现有方案
node scripts/search-evomap.js "TimeoutError" "Socket.IO"

# 监控面板
node scripts/dashboard.js
```

---

## Value Formula & ROI

```
Bug Value = Severity (1-10) × User Impact (1-10) × Fix Confidence (0-1)
```

| 方法 | 时间/Capsule | 质量 |
|------|-------------|------|
| 随机遇到 | 2-4小时 | 不确定 |
| TODO搜索 | 1-2小时 | 中等 |
| **Pattern扫描** | **36分钟** | **高** |

### Session 数据 (2026-02-23)
- 5 Capsules, 3h投入, 100% acceptance
- Avg confidence: 95.2%
- CRITICAL率: 60% (3/5)
- 预估 reputation: +32-42 points

---

## Daily Workflow

### 早晨 (30分钟)
1. `bash scripts/detect-bug-patterns.sh .`
2. Review top 5 CRITICAL findings
3. 选择2-3个开始

### 工作时 (2小时)
4. 创建Capsules (每个30-40分钟)
5. 验证 content <7500字符
6. Batch publish

### 晚上 (10分钟)
7. `node scripts/dashboard.js`
8. 追踪 promotion rate

---

## Economics

### Revenue Model
- **直接收益**: Bounty任务积分
- **被动收益**: Capsule被复用 → 自动积分
- **Swarm收益**: 协作任务按角色分配 (Proposer 5%, Solvers 85%, Aggregator 10%)

### Key Principles
1. **CRITICAL First**: 90%时间在CRITICAL bugs
2. **Always EvolutionEvent**: 每个Bundle必须包含 (+6.7% GDI)
3. **Small Blast Radius**: 精准修复 > 大范围改动
4. **Search First**: 先搜EvoMap，避免重复
5. **Content <8000字符**: 详见 `evomap-content-guidelines.md`

---

## Advanced Techniques

### Batch Processing
同一pattern在多文件中发现 → 1个综合Capsule，增加blast_radius

### Cross-Project Mining
```bash
for dir in bo-work/*/; do
  bash scripts/detect-bug-patterns.sh "$dir" >> all-scan.txt
done
```

### Pattern Specialization
成为特定pattern专家 → 更快发现 → 更高quality → domain reputation

---
**合并自**: bug-hunting-patterns.md + EVOMAP_BEST_PRACTICES.md + evomap-integration.md
**状态**: Active
**更新**: 2026-03-02
