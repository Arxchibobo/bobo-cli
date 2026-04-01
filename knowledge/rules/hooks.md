---
id: "hooks"
title: "Hooks System"
category: "root"
tags: ["hooks system", "hook types", "hook files", "lifecycle coverage", "auto-accept permissions", "todowrite best practices"]
source: "C:/Users/Administrator/.claude/rules/hooks.md"
---

# Hooks System

> **版本**: v2.0 (2026-02-10 更新)

## Hook Types

- **PreToolUse**: Before tool execution (validation, parameter modification)
- **PostToolUse**: After tool execution (auto-format, checks)
- **Stop**: When session ends (final verification)
- **SubagentStop**: When sub-agent completes
- **SessionStart**: When session begins (auto-learning)

## Current Hooks (in ~/.claude/settings.json)

### PreToolUse

| Hook                     | Matcher | Purpose                                 |
| ------------------------ | ------- | --------------------------------------- |
| **pre-bash.sh**          | Bash    | Validate bash commands before execution |
| **pre-edit.sh**          | Edit    | Validate file edits before applying     |
| **enhance-tool-call.sh** | \*      | Enhance all tool calls with context     |
| **vibecraft-hook.js**    | \*      | VibeCraft integration for all tools     |

### PostToolUse

| Hook                  | Matcher | Purpose                                   |
| --------------------- | ------- | ----------------------------------------- |
| **post-bash.sh**      | Bash    | Post-process bash output                  |
| **post-edit.sh**      | Edit    | Auto-format, TypeScript check after edits |
| **vibecraft-hook.js** | \*      | VibeCraft post-processing                 |

### Stop

| Hook                  | Purpose                |
| --------------------- | ---------------------- |
| **vibecraft-hook.js** | Session-end processing |

### SubagentStop

| Hook                  | Purpose                       |
| --------------------- | ----------------------------- |
| **vibecraft-hook.js** | Sub-agent completion tracking |

### SessionStart

| Hook                   | Purpose                                 |
| ---------------------- | --------------------------------------- |
| **learn-patterns.sh**  | Auto-learn coding patterns from session |
| **session-summary.sh** | Initialize session tracking             |

## Hook Files

Located in `~/.claude/hooks/`:

```
~/.claude/hooks/
├── enhance-tool-call.sh    # Context enhancement for all tools
├── learn-patterns.sh       # Auto-learn patterns (SessionStart)
├── post-bash.sh            # Post-bash processing
├── post-edit.sh            # Post-edit formatting & checks
├── pre-bash.sh             # Pre-bash validation
├── pre-edit.sh             # Pre-edit validation
└── session-summary.sh      # Session summary generation
```

## Lifecycle Coverage

```
SessionStart → learn-patterns.sh (auto-learn)
    ↓
PreToolUse → pre-bash/pre-edit + enhance + vibecraft
    ↓
[Tool Execution]
    ↓
PostToolUse → post-bash/post-edit + vibecraft
    ↓
SubagentStop → vibecraft (sub-agent tracking)
    ↓
Stop → vibecraft (session-end)
```

## Auto-Accept Permissions

Use with caution:

- Enable for trusted, well-defined plans
- Disable for exploratory work
- Never use dangerously-skip-permissions flag
- Configure `allowedTools` in `~/.claude.json` instead

## TodoWrite Best Practices

Use TodoWrite tool to:

- Track progress on multi-step tasks
- Verify understanding of instructions
- Enable real-time steering
- Show granular implementation steps
