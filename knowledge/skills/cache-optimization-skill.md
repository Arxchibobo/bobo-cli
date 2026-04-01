---
id: "cache-optimization-skill"
title: "Cache Optimization Skill"
category: "agent-engineering"
tags: ["cache optimization skill", "what the patches do", "installation status", "installed location", "patched cli", "usage", "cache health monitoring", "optimization strategy matrix", "troubleshooting", "restore from backup"]
triggers: []
dependencies: []
source: "E:/Bobo's Coding cache/.claude/skills/cache-optimization-skill"
---

---
name: cache-optimization-skill
description: Token cache optimization based on cc-cache-fix. Auto-applies 3 patches (attachment persistence, hash stability, 1h TTL) and monitors cache health. Use when starting sessions, resuming conversations, or auditing token usage.
---

# Cache Optimization Skill

> **Source**: cc-cache-fix by Rangizingo
> **Effect**: ~60-70% token savings via 3 targeted patches
> **Status**: Installed as `claude-patched` (v2.1.81)

## What The Patches Do

### Patch 1: Attachment Persistence (db8 filter)
**Problem**: Claude Code drops `deferred_tools_delta` and `mcp_instructions_delta` attachments on save, breaking cache on resume.

**Fix**: Allow these attachment types through the filter:
```javascript
// Before: only hook_additional_context passes
if(A.attachment.type==="hook_additional_context") return!0;
return!1;

// After: also allow delta types
if(A.attachment.type==="deferred_tools_delta") return!0;
if(A.attachment.type==="mcp_instructions_delta") return!0;
return!1;
```

**Effect**: +30% cache hit rate on session resume.

### Patch 1b: Fingerprint Meta Skip
**Problem**: First user message (including meta/system messages) is used for cache fingerprinting, causing different fingerprints for identical content.

**Fix**: Skip meta user messages in fingerprint selector:
```javascript
// Before: finds first user message regardless of meta status
let q = A.find((_) => _.type === "user");

// After: skip meta messages
let q = A.find((_) => _.type === "user" && !("isMeta" in _ && _.isMeta));
```

**Effect**: More stable cache keys across turns.

### Patch 2: Force 1-Hour Cache TTL
**Problem**: Default 5-minute TTL is too short for most tasks. The `sjY()` function checks subscription/feature flags to gate 1h TTL.

**Fix**: Bypass the check entirely:
```javascript
// Before: conditional TTL based on plan
function sjY(A) { if(QA()==="bedrock" ... }

// After: always allow 1h TTL
function sjY(A) { return!0; if(QA()==="bedrock" ... }
```

**Effect**: Cache lives 12x longer, reducing recomputation.

---

## Installation Status

```bash
# Installed location
E:/Bobo's Coding cache/cc-cache-fix/

# Patched CLI
claude-patched.cmd  → node cli.js (patched v2.1.81)

# Usage
claude-patched          # Start patched Claude Code
claude-patched --version  # Verify: "2.1.81 (Claude Code)"
```

## Cache Health Monitoring

### Quick Check
```bash
cd "E:/Bobo's Coding cache/cc-cache-fix"
python test_cache.py
```

### Usage Audit
```bash
python usage_audit.py
```

### Health Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Cache hit rate | >70% | 50-70% | <50% |
| Token efficiency | >65% | 45-65% | <45% |
| TTL utilization | >80% | 60-80% | <60% |

---

## Optimization Strategy Matrix

### With cc-cache-fix (default)
```
Strategy: Trust the cache, minimize re-reads
- Read files once, trust they'll be cached
- Resume sessions confidently (delta attachments preserved)
- Work in longer sessions (1h TTL)
```

### Without cc-cache-fix (fallback)
```
Strategy: Minimize context, split sessions
- Use Grep instead of full file reads
- Split long tasks into 15-20 min sessions
- Compress context before it exceeds 70%
```

---

## Combined with Other Optimizations

| Optimization | Token Savings | Requires |
|-------------|---------------|----------|
| **cc-cache-fix** | 60-70% | `claude-patched` |
| **Context compression** | 90-95% of context size | Manual trigger |
| **Session splitting** | 30-40% for long tasks | Task planning |
| **Cache warmup** | 30% on first operation | Session start |
| **Total combined** | ~80% overall | All above |

---

## Troubleshooting

### Patch Not Applied
```bash
cd "E:/Bobo's Coding cache/cc-cache-fix"
# Restore from backup
cp node/node_modules/@anthropic-ai/claude-code/cli.js.orig node/node_modules/@anthropic-ai/claude-code/cli.js
# Re-apply
python patches/apply-patches.py node/node_modules/@anthropic-ai/claude-code/cli.js
```

### Version Mismatch After Claude Code Update
```bash
# The patch targets specific function names (db8, sjY, FA9)
# If these change in a new version, the patch will fail gracefully
# Check: python patches/apply-patches.py --dry-run <path-to-new-cli.js>
```

### Revert to Stock
```bash
# Simply use 'claude' instead of 'claude-patched'
claude  # Unpatched version
```

---

## Maintenance

### Weekly
- Run `usage_audit.py` to track cache efficiency trends
- Check for cc-cache-fix updates: `cd cc-cache-fix && git pull`

### Monthly
- Verify patch status: `python test_cache.py`
- Re-run installer if Claude Code updated: `powershell -File install-windows.ps1`

### On Claude Code Major Update
- Check if patches still apply
- Wait for cc-cache-fix update if function names changed
- Fall back to `claude` (stock) if patches fail
