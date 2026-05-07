# Code Review 结构化协议

## 五维审查

| 维度 | 关注点 |
|------|--------|
| Security | 注入/XSS/密钥泄露/权限绕过 |
| Performance | N+1/大表扫/无缓存/阻塞主线程 |
| Quality | 死代码/类型错位/未处理边界 |
| Accessibility | 语义HTML/ARIA/键盘导航 |
| AI Residuals | 硬编码/skip test/mock残留 |

## AI Residuals 扫描

| severity | 模式 | 判定 |
|----------|------|------|
| major | localhost/127.0.0.1 硬编码 | 1件即FAIL |
| major | it.skip/describe.skip/test.skip | 1件即FAIL |
| major | 硬编码密钥/token | 1件即FAIL |
| major | dev/staging 固定URL | 1件即FAIL |
| minor | mockData/dummy/fake 残留 | 标注不FAIL |
| minor | TODO/FIXME 未处理 | 标注不FAIL |
| recommendation | "temporary" 注释 | 建议清理 |

## Verdict 规则

- critical/major ≥1 → `REQUEST_CHANGES`
- minor/recommendation only → `APPROVE`
- 不因"改了更好"而 REQUEST_CHANGES

## 输出格式
```json
{
  "verdict": "APPROVE | REQUEST_CHANGES",
  "observations": [
    {
      "severity": "major|minor|recommendation",
      "category": "security|performance|quality|accessibility|ai-residuals",
      "location": "file:line",
      "issue": "问题描述",
      "suggestion": "修复建议"
    }
  ]
}
```

## Git Guard Rules

| Rule | 动作 |
|------|------|
| `git push --force` / `-f` | 拒绝（无例外）|
| `--no-verify` / `--no-gpg-sign` | 拒绝 |
| `git reset --hard main/master` | 拒绝 |
| 直推 main/master | 警告 |
| 改 package.json/Dockerfile/CI | 警告 |

## "第零步"规则

对 >300 行文件做结构性重构前，先清理：
- 移除死代码（未使用的 props/exports/imports）
- 移除 debug logs
- **单独 commit 清理**，再开始重构

## 分阶段执行

多文件重构：
- 每阶段最多 **5 个文件**
- Phase 完成 → 验证 → 确认 → 下一 Phase
- 不在一次响应中做多文件重构
