# Worker Prompt 编写指南

## 核心原则

> Worker 看不到你的对话。每个 prompt 必须是自包含的。

## 必须包含

1. **具体文件/路径/行号** — 不是"那个文件"，而是 `src/auth/validate.ts:42`
2. **完成标准** — "做完"长什么样
3. **目的陈述** — 帮 Worker 校准深度

## 目的陈述示例
- "这个研究用于写 PR 描述 — 聚焦用户可见的变更"
- "我需要这个来规划实现 — 报告文件路径、行号、类型签名"
- "这是合并前的快速检查 — 只验证 happy path"

## 反模式

```
❌ "修复我们讨论的 bug"
❌ "基于你的发现，实现修复"
❌ "创建最近变更的 PR"
❌ "测试好像出了问题，你看看"
```

## 正确写法

### 实现类
```
修复 src/auth/validate.ts:42 的空指针。
Session 过期时 user 字段为 undefined 但 token 仍在缓存。
在 user.id 访问前加 null check — null 则返回 401 'Session expired'。
运行相关测试和类型检查，提交并报告 hash。
```

### 研究类
```
调查 src/auth/ 模块。找到 session 处理和 token 验证
可能出现空指针的位置。
报告具体文件路径、行号和涉及的类型。
不要修改文件。
```

### 纠正类（Continue）
```
你加的 null check 导致两个测试失败 —
validate.test.ts:58 期望 'Invalid session' 但你改成了 'Session expired'。
修复断言，提交并报告 hash。
```

### Git 操作类
```
从 main 创建分支 'fix/session-expiry'。
只 cherry-pick commit abc123。
Push 并创建 draft PR 指向 main。
报告 PR URL。
```

## Checklist
- [ ] 包含文件路径、行号、错误信息
- [ ] 声明完成标准
- [ ] 实现类：运行测试+类型检查，提交并报告 hash
- [ ] 研究类：报告发现，不要修改文件
- [ ] Git 操作：分支名、commit hash、draft/ready、reviewer
- [ ] Continue 纠正：引用 Worker 做了什么，不是你讨论了什么
