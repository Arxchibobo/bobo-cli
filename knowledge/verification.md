# 验证协议（对抗性验证 v2）

## 何时必须验证

以下情况完成后**必须**执行验证：
- ≥3 个文件被编辑
- 后端 / API 变更
- 基础设施 / 配置变更
- 任何"应该能工作"的直觉判断

## 三层威胁模型（验证前先选）

灵感来自对抗样本攻击图——同一个 PASS 输出，背后可能有完全不同路径。

### Layer 1: Legal Input（基线）
- 跑测试 / demo input / happy path
- ⚠️ 单独这层 = 验证回避

### Layer 2: White-box Attack（白盒，必做）
- 你刚改完代码、对内部最熟，**漏洞最容易被你自己找出来的窗口**
- 看 if 条件 → 构造刚好不满足的输入
- 看锁/事务范围 → 构造并发竞态
- 看 SQL → 构造孤儿/注入
- 看缓存 key → 构造碰撞
- Bug fix 时强制：先复现原 bug → 修 → 用同 root cause 造变种

### Layer 3: Gray-box Attack（灰盒，高风险叠加）
- Fuzz API 端点
- 重放 prod 错误日志
- Timing attack（认证）
- 大 payload / 慢请求
- 断流 / 中断

## 决策表

| 变更类型 | Legal | White | Gray |
|---|---|---|---|
| 改注释 / 文案 | ✅ | — | — |
| 新增 / 改控制流 | ✅ | ✅ | — |
| Bug fix | ✅ | ✅强制复现 | — |
| API / 后端 | ✅ | ✅ | ✅ |
| 认证 / 授权 | ✅ | ✅ | ✅强制 |
| 钱 / 链上 | ✅ | ✅ | ✅强制+重放 |

## 探测库（按场景挑 ≥1）

边界值 / 幂等性 / 并发 / 孤儿 / 重放 / 越权 / 时序 / 断流 / 格式错配 / 大 payload / 方法错配 / 环境缺失 / 依赖超时 / NULL 注入

## 验证输出格式

```
### Check: [验证什么]
**Layer:** Legal | White-box | Gray-box
**Probe:** [边界值 / 并发 / 越权 / ...]
**Command:** [实际执行]
**Output:** [终端输出 — 复制粘贴]
**Result:** PASS / FAIL (Expected vs Actual)
```

## 反模式（不要做）
- ❌ 只读代码不运行就说"看起来对"
- ❌ 信任子 agent 报告不复跑（fresh venv 复跑）
- ❌ 单层骗自己（Layer 1 通过就交付）
- ❌ 验证 happy path 就收工
- ❌ 脑补示例命令
- ❌ "应该没问题"
- ❌ 写完代码 ≠ 完成（必须实跑过）

## 红旗短语（看到自己写就停）
「逻辑看起来正确」 / 「应该能工作」 / 「我读了代码确认」 / 「测试覆盖了」 / 「大概率没问题」 / 「类似代码之前能工作」 / 「我相信 CC 报告」

## 自检三问（写 VERDICT 前）
1. 报告里有多少行是命令真实输出（不是叙述）？少于 5 → 重做
2. 我做了哪个对抗探测？答不出 → 没做 → 重做
3. 三天后用户报 bug 我能指着报告说"我测过"？不能 → 漏 → 重做

## 工程化收束

- **SSOT**: `Arxchibobo/adversarial-verification` repo（symlink `~/.openclaw/workspace/skills/adversarial-verification/`）
- 详细 references: `references/threat-models.md` / `probe-library.md` / `anti-patterns.md` / `case-studies.md`
