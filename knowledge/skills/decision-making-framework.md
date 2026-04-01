---
id: "decision-making-framework"
title: "Decision Making Framework"
category: "agent-engineering"
tags: ["decision making framework", "decision modes", "decision triggers", "high-agency behaviors", "structured decision template", "anti-patterns (avoid)", "integration with work mode"]
triggers: []
dependencies: []
source: "E:/Bobo's Coding cache/.claude/skills/decision-making-framework"
---

---
name: decision-making-framework
description: Unified decision framework - combines high-agency (autonomous decisions) + structured-decision-alignment (systematic decision-making). Use when facing complex choices, architectural decisions, or conflicting requirements.
---

# Decision Making Framework

> **Merged from**: high-agency + structured-decision-alignment
> **Core principle**: Decide fast, decide well, decide once

## Decision Modes

### Mode 1: Autonomous (95% of decisions)

For decisions where the codebase, conventions, or best practices provide clear guidance:

```
1. Check existing patterns in codebase
2. Apply the most common convention
3. Execute without asking
4. Document the choice in commit message
```

**Examples**: File naming, code style, dependency versions, UI details, test strategy

### Mode 2: Structured (4% of decisions)

For decisions with multiple valid approaches:

```
1. State the decision clearly
2. List top 2-3 options with trade-offs
3. Apply scoring matrix
4. Choose highest-scoring option
5. Document reasoning
```

**Scoring Matrix**:
| Criterion | Weight |
|-----------|--------|
| Maintains existing patterns | 3x |
| Simpler implementation | 2x |
| Better performance | 2x |
| Easier to test | 1x |
| More flexible | 1x |

### Mode 3: Blocking (1% of decisions)

Only 4 situations require user input:
1. **Missing credentials** — API keys, passwords, private keys
2. **Opposing approaches** — REST vs GraphQL, SQL vs NoSQL
3. **Contradictory requirements** — "Fast but perfect"
4. **Irreversible risk** — Delete production data, force push

---

## Decision Triggers

| Signal | Mode | Action |
|--------|------|--------|
| Codebase has existing pattern | Autonomous | Follow it |
| Best practice is clear | Autonomous | Apply it |
| Language convention exists | Autonomous | Use it |
| 2+ equally valid approaches | Structured | Score and choose |
| Requirements contradict | Blocking | Ask user |
| Risk is irreversible | Blocking | Confirm with user |

---

## High-Agency Behaviors

### Do Immediately (No Permission Needed)
- Create files following project conventions
- Install needed dependencies
- Run tests to verify changes
- Fix obvious bugs encountered
- Refactor to follow existing patterns

### Do After Documenting Intent
- Architecture changes (document in commit)
- New feature additions (document in plan)
- Performance optimizations (document why)

### Never Do Without Explicit Permission
- Delete production data
- Force push to shared branches
- Modify CI/CD pipelines
- Send messages to external services
- Upload sensitive content

---

## Structured Decision Template

When facing a non-trivial decision:

```markdown
## Decision: [What needs to be decided]

### Context
[Why this decision is needed]

### Options Considered
1. **Option A**: [Description]
   - Pros: [...]
   - Cons: [...]
   - Score: [X/10]

2. **Option B**: [Description]
   - Pros: [...]
   - Cons: [...]
   - Score: [X/10]

### Decision
**Chosen**: Option [X]
**Reason**: [Why]
**Trade-off**: [What we give up]
```

---

## Anti-Patterns (Avoid)

1. **Analysis Paralysis** — Spending more time deciding than doing
2. **Premature Abstraction** — Designing for hypothetical futures
3. **Bikeshedding** — Debating trivial details
4. **Decision Reversal** — Reopening closed decisions without new information

---

## Integration with Work Mode

```
Receive task
  ↓
Quick plan → TodoList
  ↓
For each step:
  ├─ Can decide autonomously? → Execute
  ├─ Need structured analysis? → Score and choose
  └─ Hit blocking condition? → Ask user (4 types only)
  ↓
Complete and verify
```
