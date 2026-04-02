---
id: "memory-evolution-system"
title: "Memory Evolution System"
category: "agent-engineering"
tags: ["memory evolution system", "architecture", "combined workflow", "quick reference", "save a feedback memory", "save a project memory", "evolution check"]
triggers: []
dependencies: []
source: "E:/Bobo's Coding cache/.claude/skills/memory-evolution-system"
---

---
name: memory-evolution-system
description: Unified memory management - combines memory-manager (persistent memory store) + proactive-self-improving (auto-evolve patterns). Use when learning new patterns, saving cross-session context, or evolving capabilities.
---

# Memory Evolution System

> **Merged from**: memory-manager + proactive-self-improving
> **Core principle**: Store → Abstract → Evolve → Apply

## Architecture

```
Session data → Memory Store → Pattern Abstraction → Capability Evolution
                  ↓                                    ↓
            MEMORY.md (index)                    Auto-behavior change
            Topic files (details)                Next session faster
```

## Module 1: Memory Manager

### Memory Types

| Type | Purpose | When to Save | File Pattern |
|------|---------|-------------|--------------|
| **user** | User profile, preferences | Learn any user detail | `memory/user_*.md` |
| **feedback** | Guidance on approach | User corrects or confirms | `memory/feedback_*.md` |
| **project** | Project status, decisions | Learn project context | `memory/project_*.md` |
| **reference** | External resource pointers | Learn about tools/services | `memory/reference_*.md` |

### Storage Format

Each memory file uses this frontmatter:

```markdown
---
name: [memory name]
description: [one-line description for relevance matching]
type: [user|feedback|project|reference]
---

[Content — for feedback/project: rule, then **Why:** and **How to apply:** lines]
```

### MEMORY.md Index Rules

- **Auto-loaded** every conversation
- **<200 lines** hard limit
- **One line per memory**: `- [Title](file.md) — one-line hook`
- Update index when adding/removing memories

### Save Triggers

**Always save when**:
- User corrects approach → `feedback` type
- User confirms non-obvious approach → `feedback` type
- Learn user role/preferences → `user` type
- Project milestone/decision → `project` type
- External resource discovered → `reference` type

**Never save**:
- Code patterns (derivable from codebase)
- Git history (derivable from git)
- Ephemeral task details (session-scoped)
- Anything already in CLAUDE.md

---

## Module 2: Proactive Self-Improvement

### Evolution Cycle

Every session automatically:

```
1. IDENTIFY — Spot reusable patterns
   ↓
2. ABSTRACT — Extract: input? output? invariants? params? failure points?
   ↓
3. INTERNALIZE — Make it a default behavior or high-level option
   ↓
4. VERIFY — Next session must be: faster? more stable? fewer steps?
```

### Pattern Recognition Signals

| Signal | Meaning | Action |
|--------|---------|--------|
| Manually combining same tool sequence | Reusable workflow | Abstract into a pattern |
| User repeats same decision | Default preference | Internalize as default |
| "If only I had a built-in ability" | Missing capability | Design and internalize |
| Same error in multiple sessions | Systemic issue | Create prevention rule |

### Evolution Constraints

- ✅ Must improve success rate or efficiency
- ✅ Must not introduce uncontrollable side effects
- ✅ Must not increase user cognitive load
- ❌ Cannot internalize unstable/patternless behaviors

### Capability Merging

When two capabilities overlap:

```
capability_A + capability_B → merged_capability_C
Properties: wider coverage, lower invocation cost, higher success probability
```

**Goal**: Not more capabilities, but better ones.

---

## Combined Workflow

### Session Start
```
1. Load MEMORY.md (auto)
2. Activate evolution mode (auto)
3. Check relevant memories for current task
4. Apply evolved patterns from previous sessions
```

### During Session
```
1. Execute tasks
2. Monitor for evolution signals
3. When signal detected:
   a. Abstract the pattern
   b. Decide: save as memory? internalize as behavior? both?
   c. Apply immediately if behavior change
4. Track results for next session verification
```

### Session End
```
1. Save new memories (user feedback, project decisions)
2. Update MEMORY.md index
3. Note any capability evolution
4. No explicit reporting — prove through results
```

---

## Quick Reference

```markdown
# Save a feedback memory
Write: memory/feedback_[topic].md
Format: rule → **Why:** → **How to apply:**
Update: memory/MEMORY.md index

# Save a project memory
Write: memory/project_[name].md
Format: fact → **Why:** → **How to apply:**
Update: memory/MEMORY.md index

# Evolution check
Question: Is this session faster/better than last time for similar tasks?
If no → What capability needs strengthening?
If yes → What evolution caused the improvement?
```
