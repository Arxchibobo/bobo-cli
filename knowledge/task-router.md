# 任务路由决策树

## 自动判断加载范围

收到任务后，根据关键词决定加载哪些知识：

### 关键词 → 能力域映射

| 关键词 | 加载 | 说明 |
|--------|------|------|
| 代码/开发/写/改/修 | rules + engineering | 编码规范 + 工程方法 |
| 错误/bug/调试/报错 | error-catalog + verification | 错误速查 + 验证 |
| 搜索/找/查/grep | engineering.搜索策略 | 搜索方法论 |
| 文件/读/写/编辑 | rules.代码规范 | 文件操作规范 |
| 测试/验证/检查 | verification | 验证协议 |
| 规划/计划/任务 | engineering.任务路由 | 任务分解方法 |
| git/提交/推送 | rules.Git规范 | Git 流程 |

### 复杂度判断
```
1-2 步 → 直接干
3-5 步 → 快速 TodoList → 干
6+  步 → 三文件模式（plan + notes + deliverable）
```

### 风险判断
```
可逆操作 → 直接干
不可逆 & 低影响 → 提醒后干
不可逆 & 高影响 → 确认后干
```

## 默认行为
- 所有任务默认加载：system.md + rules.md
- 中等以上复杂度追加：engineering.md
- 调试任务追加：error-catalog.md
- 交付前追加：verification.md
