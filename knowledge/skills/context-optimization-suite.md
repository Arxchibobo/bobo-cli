---
id: "context-optimization-suite"
title: "Context Optimization Suite"
category: "agent-engineering"
tags: ["context optimization suite", "when to use", "compressed context", "combined workflow", "quick reference"]
triggers: []
dependencies: []
source: "E:/Bobo's Coding cache/.claude/skills/context-optimization-suite"
---

---
name: context-optimization-suite
description: Unified context management - combines context-budget-analyzer (token budget tracking) + context-compressor (95% context compression). Use when context is tight, approaching limits, or when resuming long sessions.
---

# Context Optimization Suite

> **Merged from**: context-budget-analyzer + context-compressor
> **Token savings**: Up to 95% context reduction while preserving critical information

## When to Use

- Context window approaching 70%+ capacity
- Resuming a long session with accumulated context
- Before compaction to preserve key information
- When `cacheCreationInputTokens` = 0 (cache miss)

---

## Module 1: Budget Analyzer

### Budget Threshold System

| Level | Usage | Action |
|-------|-------|--------|
| Green | <50% | Normal operation |
| Yellow | 50-75% | Efficiency awareness, prefer targeted tools |
| Orange | 75-90% | Consider compaction or session split |
| Red | >90% | Immediate compaction required |

### Token Category Tracking

Monitor these categories:
- **Human messages**: User input tokens
- **Assistant messages**: AI response tokens
- **Tool requests**: Tool call tokens
- **Tool results**: Tool output tokens (often the biggest waste)
- **Attachments**: File attachment tokens
- **System/Other**: System message tokens

### Optimization Rules

1. **Cache file contents** after first read — never re-read the same file
2. **Use Grep** instead of full file reads when searching
3. **Compress images** before attachment
4. **Limit bash output** with `head -N` / `tail -N`
5. **Keep assistant responses concise** — no trailing summaries

### Duplicate Detection

Track file reads per session. If a file is read 3+ times, it's a waste signal:
```
File: src/index.ts — Read 4 times — ~8,000 tokens wasted
Action: Cache content after first read
```

---

## Module 2: Context Compressor

### 9-Section Compression Template

When compressing context, produce exactly this structure:

```markdown
## Compressed Context

### 1. User Request
[Original user prompt/goal in 1-2 sentences]

### 2. Key Technical Concepts
- [Concept 1]: [Brief explanation]
- [Concept 2]: [Brief explanation]

### 3. Key Files and Code
- `path/to/file.ts:L42-L58` — [What it does]
- `path/to/other.ts:L10-L25` — [Key function]

### 4. Key Errors and Fixes
- **Error**: [Error message] → **Fix**: [Solution applied]

### 5. Problem-Solving Process
1. [Step 1: What was tried]
2. [Step 2: What worked]
3. [Step 3: Current approach]

### 6. User Messages (condensed)
- [Message 1 summary]
- [Message 2 summary]

### 7. Todos and Tasks
- [ ] [Remaining task 1]
- [x] [Completed task 2]

### 8. Current Work
[What is being worked on RIGHT NOW — 2-3 sentences]

### 9. Next Steps
1. [Immediate next action]
2. [Following action]
3. [Final verification]
```

### Compression Ratios

| Context Size | Compressed Size | Ratio |
|-------------|----------------|-------|
| 100k tokens | ~5k tokens | 95% |
| 50k tokens | ~3k tokens | 94% |
| 20k tokens | ~2k tokens | 90% |

---

## Combined Workflow

```
Session starts
  ↓
Monitor budget (Module 1)
  ↓
Budget > 75%?
  ├─ No → Continue normally
  └─ Yes → Apply compression (Module 2)
       ↓
     Resume with compressed context
       ↓
     Monitor budget again
```

### Cache-Aware Optimization (cc-cache-fix integration)

With cc-cache-fix installed (`claude-patched`):
- Cache TTL extended to 1 hour → fewer re-reads needed
- Delta attachments preserved → resume works better
- Hash stability → same content = same cache hit

**Strategy shift**: With good caching, prioritize keeping referenced files in cache rather than aggressively compressing.

---

## Quick Reference

```bash
# Check context budget (mental model)
# Green:  <50% — proceed normally
# Yellow: 50-75% — be efficient
# Orange: 75-90% — compress soon
# Red:    >90% — compress NOW

# Compress context using the 9-section template
# Output only the compressed version, nothing else
```
