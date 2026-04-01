---
id: "quality-assurance-framework"
title: "Quality Assurance Framework"
category: "agent-engineering"
tags: ["quality assurance framework", "pre-commit qa", "combined qa workflow", "quick reference"]
triggers: []
dependencies: []
source: "E:/Bobo's Coding cache/.claude/skills/quality-assurance-framework"
---

---
name: quality-assurance-framework
description: Unified QA - combines adversarial-verification (find vulnerabilities via attack) + self-rationalization-guard (prevent self-deception). Use before commits, after code changes, or when reviewing critical logic.
---

# Quality Assurance Framework

> **Merged from**: adversarial-verification + self-rationalization-guard
> **Core principle**: Attack first, defend assumptions, verify ruthlessly

## Module 1: Adversarial Verification

### Attack Modes

**Mode A: Input Attack** — What inputs break this?
```
- Empty input? null? undefined?
- Extremely large input? (1M chars)
- Special characters? (<script>, SQL injection, path traversal)
- Unicode edge cases? (RTL, zero-width, emoji)
- Concurrent requests?
```

**Mode B: State Attack** — What states break this?
```
- Race conditions between operations
- State transitions out of order
- Partial failures (network timeout mid-write)
- Resource exhaustion (disk full, memory OOM)
- Permission escalation paths
```

**Mode C: Logic Attack** — What assumptions are wrong?
```
- "This API always returns data" → What if it returns null?
- "This file always exists" → What if deleted mid-operation?
- "This operation is atomic" → What if interrupted?
- "This order is guaranteed" → What if reordered?
```

### Verification Checklist

```markdown
## Pre-Commit QA

### Input Validation
- [ ] All user inputs validated at system boundary
- [ ] SQL uses parameterized queries (no string concat)
- [ ] HTML output sanitized (no raw user content)
- [ ] File paths validated (no path traversal)
- [ ] Rate limiting on all public endpoints

### Error Handling
- [ ] All async operations have try/catch
- [ ] Errors are thrown, not silently swallowed
- [ ] Error messages don't leak sensitive data
- [ ] Failed operations clean up resources

### State Safety
- [ ] No race conditions in shared state
- [ ] Atomic operations where needed
- [ ] Proper locking for concurrent access
- [ ] Rollback on partial failures

### Security
- [ ] No hardcoded secrets
- [ ] Authentication verified on protected routes
- [ ] Authorization checked at each level
- [ ] CSRF protection enabled
```

---

## Module 2: Self-Rationalization Guard

### Red Flags (Self-Deception Patterns)

| Pattern | What You Tell Yourself | Reality |
|---------|----------------------|---------|
| **Hand-waving** | "This edge case won't happen" | It will, in production |
| **Scope creep** | "While I'm here, let me also..." | Unrelated changes introduce bugs |
| **Assumption skip** | "The caller will validate this" | They won't |
| **Optimism bias** | "This should work" | Prove it with a test |
| **Sunk cost** | "I've already spent time on this approach" | Switch if a better one exists |
| **Complexity justify** | "It needs to be this complex" | Simpler exists, find it |

### Anti-Deception Protocol

Before marking any task complete:

```
1. Red Team your own code
   → "If I wanted to break this, how would I?"
   → Find at least ONE potential issue

2. Challenge your assumptions
   → List every assumption you made
   → Verify each one is actually true

3. Ask "What would make this fail?"
   → Not "Does this work?"
   → But "Under what conditions does this break?"

4. Simplicity check
   → Could this be done with fewer abstractions?
   → Is every line earning its existence?

5. Test the negative path
   → Don't just test the happy path
   → Test every error/failure scenario
```

---

## Combined QA Workflow

### Before Every Commit

```
1. Adversarial scan (Module 1)
   ├─ Input attack: 2 min
   ├─ State attack: 2 min
   └─ Logic attack: 2 min

2. Self-deception check (Module 2)
   ├─ Red flag scan: 1 min
   ├─ Assumption challenge: 1 min
   └─ Simplicity check: 1 min

3. Automated verification
   ├─ Run tests: npm test
   ├─ Type check: tsc --noEmit
   └─ Lint: eslint .

Total: ~10 minutes per commit
```

### Before Every PR

```
1. Full adversarial verification (Module 1)
2. Self-deception deep dive (Module 2)
3. Security scan (OWASP top 10)
4. Performance check (no regressions)
5. Accessibility check (if UI changes)
```

---

## Quick Reference

```markdown
# 3-Question QA (use for every change)

1. "How would I break this?" → Fix the break point
2. "What assumption am I making?" → Verify the assumption
3. "Could this be simpler?" → Simplify if yes
```
