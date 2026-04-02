# Memory Manager — 进阶配置

## 自定义阈值

| 参数 | 默认值 | 说明 |
|------|--------|------|
| MEMORY_MAX_SIZE | 5KB | MEMORY.md 上限 |
| MAX_EXPERIENCES | 15 | 业务经验最大条数 |
| MAX_CORRECTIONS | 10 | 纠正记录最大条数 |
| SUMMARY_TTL_DAYS | 7 | 对话摘要保留天数 |
| CORRECTION_PROMOTE_COUNT | 2 | 相似纠正几次后晋升 |

## 与其他 Skill 的协作

### + Self-Improving / Proactive Self-Improving
Memory Manager 负责记忆存储结构，Self-Improving 负责错误/学习捕获。两者互补：
- Self-Improving 捕获 → Memory Manager 存储和瘦身
- 纠正记录共享 `.learnings/corrections.md`

### + Lossless-Claw (LCM)
LCM 处理对话级持久化（SQLite + DAG 摘要），Memory Manager 处理知识级持久化（MEMORY.md + daily logs）。
- LCM = 对话不丢失
- Memory Manager = 知识不丢失

### + High Agency / PUA
当 Agent 被纠正时，Memory Manager 确保教训被记录，High Agency 确保态度正确。

## 记忆写入决策流程图

```
用户发了一条消息
│
├── 包含"记住" → 分类写入 MEMORY.md
├── 纠正了你 → corrections.md + MEMORY.md 纠正区
├── 表达偏好 → MEMORY.md 用户偏好区
├── 做了决策 → MEMORY.md 对话摘要区
├── 新概念(≥3轮) → MEMORY.md 业务经验区
├── 任务搁置 → MEMORY.md 活跃任务区
└── 普通对话 → 不写入
```

## 瘦身决策流程图

```
检查 MEMORY.md 大小
│
├── ≤ 5KB → 不操作
└── > 5KB
    ├── 1. 删已完成活跃任务
    ├── 2. 精简 >7天对话摘要
    ├── 3. 删已晋升纠正记录
    ├── 4. 合并相似业务经验
    └── 5. 仍超限 → 归档最老的业务经验到 memory/archive/
```

## 常见问题

**Q: 用户没说"记住"，我该不该写入？**
A: 看触发条件表。被纠正、表达偏好、做决策 → 自动写入。

**Q: MEMORY.md 和 daily log 有什么区别？**
A: MEMORY.md = 精炼的长期知识（每次加载）。Daily log = 原始事件流（按需查询）。

**Q: 两个 Agent 的 MEMORY.md 会冲突吗？**
A: 每个 Agent 有独立的 workspace，不会冲突。共享知识走 `/shared/` 目录。
