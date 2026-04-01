---
id: "evomap-content-guidelines"
title: "EvoMap Content Guidelines"
category: "root"
tags: ["evomap content guidelines", "🚨 content length error", "✅ 内容优化策略", "📊 content budget分配", "🛠️ 实践清单", "💡 实战技巧", "📝 模板示例", "⚠️ 常见错误", "🎯 质量vs长度平衡", "🔧 自动化检查"]
source: "E:/Bobo's Coding cache/.claude/rules/evomap-content-guidelines.md"
---

# EvoMap Content Guidelines

> **关键限制**: Capsule content字段 **最大8000字符**，超出会被拒绝（HTTP 400）

---

## 🚨 Content Length Error

### 错误示例 (Capsule #8 首次提交)

```json
{
  "error": "field_too_long: \"assets[1].content\" exceeds 8000 chars (9703)"
}
```

**原因**: fixDescription包含完整代码示例（~200行），超出限制

---

## ✅ 内容优化策略

### 1. 精简代码示例

**❌ 不好 - 完整实现代码**:
```typescript
// 包含完整的函数实现（80-100行）
export async function POST(request: Request) {
  // ... 完整代码
}
```

**✅ 好 - 关键代码片段**:
```typescript
// 只展示核心逻辑（10-15行）
export async function POST(req: Request) {
  const { rules } = await req.json();
  if (!rules) return error(400);
  await fs.writeFile('rules.json', JSON.stringify(rules));
  return { success: true };
}
```

---

### 2. 分离详细说明

**结构化内容**（按优先级）:

```
1. Problem (150字)          - 问题描述
2. Root Cause (100字)       - 根本原因 + 代码位置
3. Impact (150字)           - 影响列表（bullet points）
4. Solution (300字)         - 核心解决方案
5. Key Code (500字)         - 关键代码片段
6. Testing (200字)          - 测试策略概要
7. Deployment (100字)       - 部署注意事项

总计: ~1500字符（预留buffer）
```

---

### 3. 使用简洁语言

**❌ 冗长描述**:
```
This is a critical production-breaking security vulnerability that affects
the entire rate limiting system by causing all users to share the same
hardcoded IP address value of 127.0.0.1 which results in the complete
failure of the rate limiting mechanism...
```

**✅ 简洁描述**:
```
CRITICAL: All users share hardcoded 127.0.0.1 IP, breaking rate limiting.
Enables DDoS attacks and abuse.
```

---

### 4. 避免重复内容

**❌ 重复的示例代码**:
- 完整的Before代码
- 完整的After代码
- 完整的Alternative方案
- 完整的测试代码

**✅ 精简内容**:
- Before: 仅问题行（2-3行）
- After: 仅修复代码（5-10行）
- Testing: 测试策略（文字描述）

---

## 📊 Content Budget分配

总限制: 8000字符

### 推荐分配 (保守估计)

| 部分 | 字符数 | 百分比 |
|------|--------|--------|
| Problem描述 | 500 | 6% |
| Root Cause | 400 | 5% |
| Impact列表 | 600 | 8% |
| Solution说明 | 800 | 10% |
| 核心代码（Before/After） | 1500 | 19% |
| Testing策略 | 500 | 6% |
| Benefits | 300 | 4% |
| Deployment | 200 | 3% |
| **Total** | **4800** | **60%** |
| **Buffer** | **3200** | **40%** |

**原则**: 使用60%，保留40% buffer

---

## 🛠️ 实践清单

### 编写前
- [ ] 估算内容总长度（包括代码）
- [ ] 确定核心message（1-2句话）
- [ ] 选择最关键的代码片段（≤3个）

### 编写中
- [ ] 每个section限制字符数
- [ ] 移除重复描述
- [ ] 用bullet points代替段落
- [ ] 缩短代码示例（保留核心逻辑）

### 提交前
- [ ] 统计总字符数: `wc -c fixDescription.txt`
- [ ] 确保 <7000字符（安全阈值）
- [ ] 删除非必要的Alternative方案
- [ ] 删除过长的测试代码

---

## 💡 实战技巧

### 技巧1: 代码压缩
```typescript
// Before (verbose)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // ... 20行代码
  } catch (error) {
    // ... 5行错误处理
  }
}

// After (compressed)
export async function POST(req: Request) {
  const { rules } = await req.json();
  await save(rules);  // 核心逻辑
  return { success: true };
}
```

### 技巧2: 引用而非复制
```markdown
❌ 不好:
完整复制3个测试用例代码（每个50行）

✅ 好:
**Testing**:
1. Unit test: API validation (see test/api.test.ts)
2. E2E test: User workflow persistence
3. Integration: Rules application verification
```

### 技巧3: 链接外部资源
```markdown
**Complete implementation**: See GitHub gist: https://gist.github.com/...
**Deployment guide**: See docs: https://docs.example.com/deploy
```

（注意：EvoMap可能不支持外部链接，谨慎使用）

---

## 📝 模板示例

### 精简模板 (4000-5000字符)

```markdown
Fix [BUG_TYPE]: [ONE_LINE_DESCRIPTION]

**Problem**: [LOCATION] - [WHAT_HAPPENS]

**Root Cause**:
Line X in file.ts: `code snippet (2-3 lines)`

**Impact**:
- [Impact 1]
- [Impact 2]
- [Impact 3]

**Solution**:
[APPROACH_DESCRIPTION (100-200 words)]

**Code (Before)**:
\`\`\`typescript
// 5-10 lines
\`\`\`

**Code (After)**:
\`\`\`typescript
// 10-20 lines核心修复
\`\`\`

**Testing**: [Strategy description (no full code)]

**Deployment**: [Notes]
```

---

## ⚠️ 常见错误

### 错误1: 包含完整文件
```
❌ 包含整个API route文件（200行）
✅ 只包含修改的函数（20行）
```

### 错误2: 多个完整示例
```
❌ 3个Alternative方案，每个80行
✅ 1个主方案（20行）+ 1个Alternative概述（文字）
```

### 错误3: 详细测试代码
```
❌ 完整的测试文件（100行）
✅ 测试策略描述 + 1个示例（15行）
```

### 错误4: 重复说明
```
❌ Problem, Impact, Solution都重复描述同一问题
✅ 每个section独特信息，互补而非重复
```

---

## 🎯 质量vs长度平衡

### 高质量内容 ≠ 长内容

**关键要素**:
1. ✅ 清晰的问题定义
2. ✅ 准确的根本原因
3. ✅ 可执行的解决方案
4. ✅ 核心代码示例
5. ✅ 验证策略

**非必要**:
- ❌ 完整的文件内容
- ❌ 多个Alternative方案
- ❌ 详细的实现细节
- ❌ 完整的测试套件

### Confidence不受长度影响

```
短内容 (3000字符) + 清晰方案 = 95% confidence ✅
长内容 (9000字符) + 冗余信息 = 拒绝提交 ❌
```

---

## 🔧 自动化检查

### 脚本: check-content-length.js

```javascript
const fs = require('fs');

function checkContentLength(fixDescription) {
  const length = fixDescription.length;
  const limit = 8000;
  const safeLimit = 7000;

  if (length > limit) {
    console.error(`❌ Content too long: ${length} chars (limit: ${limit})`);
    return false;
  } else if (length > safeLimit) {
    console.warn(`⚠️ Near limit: ${length} chars (safe: ${safeLimit})`);
  } else {
    console.log(`✅ Content OK: ${length} chars`);
  }

  return true;
}

// 在publish前检查
const bugInfo = { fixDescription: '...' };
if (!checkContentLength(bugInfo.fixDescription)) {
  console.log('\n💡 Tips:');
  console.log('  - Shorten code examples');
  console.log('  - Remove duplicate content');
  console.log('  - Use bullet points');
  process.exit(1);
}
```

### 集成到publish scripts

```javascript
// 在publishBugFix()前添加
const contentLength = bugInfo.fixDescription.length;
if (contentLength > 7500) {
  console.warn(`⚠️ Content approaching limit: ${contentLength}/8000 chars`);
  console.warn('Consider shortening before publication.');
}
```

---

## 📖 参考实例

### 实例1: Capsule #8 (Before optimization - 失败)
- **长度**: 9703 字符
- **问题**: 包含3个完整代码示例 + 3个测试用例完整代码
- **结果**: HTTP 400 拒绝

### 实例2: Capsule #8 (After optimization - 成功)
- **长度**: ~4500 字符
- **优化**: 移除Alternative方案，缩短测试代码为描述，保留核心代码
- **结果**: 100% 接受, 95% confidence

### 实例3: Capsule #9 (Optimized from start)
- **长度**: ~3200 字符
- **策略**: 简洁描述 + 核心代码（15行）+ 测试策略（文字）
- **结果**: 100% 接受, 94% confidence

---

**版本**: v1.0
**创建日期**: 2026-02-23
**教训来源**: Capsule #8提交失败经验
**状态**: Active - 所有publish scripts必须遵守
