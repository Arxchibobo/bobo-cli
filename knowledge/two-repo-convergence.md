# Two-Repo Convergence Protocol

## Architecture

```
workspace (live runtime)
  ├── AGENTS.md / MEMORY.md / TOOLS.md / SOUL.md (hot config)
  ├── .learnings/ (incremental experience)
  ├── error-book/ (daily error logs)
  ├── claude-Reconstruction/ (structured rules)
  └── skills/ (operational skills)
       ↓ cherry pick → structure → commit
  ┌─────────────────────────────────────────────┐
  │ openclaw-arxchibo (本体知识备份)              │
  │   同步: core md + .learnings + error-book   │
  │   + claude-Reconstruction + infra + skills  │
  └─────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────┐
  │ bobo-cli (产品知识体系)                      │
  │   提炼: knowledge/*.md (按域拆分)            │
  │   + rules/ (blocking rules)                 │
  │   + bundled-skills/                         │
  └─────────────────────────────────────────────┘
```

## Key Principles

1. **Not copy-paste** — raw experience → distilled reusable patterns
2. **Promotion ladder**: MEMORY corrections → AGENTS.md rules → bobo-cli knowledge/ → openclaw-arxchibo claude-Reconstruction/rules/
3. **Trigger**: explicit "工程化收束" command / weekly self-check / after major task completion
4. **Publish**: `cd bobo-cli && npm run build && npm publish` (Automation token, no OTP)

## Knowledge Domains in bobo-cli

| File | Domain |
|------|--------|
| api-integration-patterns.md | RH/Modal/Notion/Semrush/MyShell API patterns |
| event-driven-architecture.md | GTM Loop watcher + state machine |
| external-alignment.md | Don't fabricate stakeholders / don't switch stacks |
| image-generation.md | genimage routing + face swap selection |
| memory-management.md | Structured memory SOP |
| high-agency.md | Contradiction-driven / full-chain audit / recovery |
| self-rationalization-guard.md | Anti-laziness pattern table |
| self-evolution.md | 7 triggers + dedup + promotion |
| worker-prompt-craft.md | Sub-agent prompt self-containment |
| long-task-management.md | Heartbeat/Plans.md/cron/resource |
| code-review-protocol.md | 5-dimension + AI residuals + Git guard |
| error-catalog.md | E001-E015 real-world errors |
| two-repo-convergence.md | This file — meta-protocol |

## Sync Checklist

- [ ] Core files (AGENTS/MEMORY/TOOLS/SOUL/IDENTITY) → openclaw-arxchibo
- [ ] .learnings/*.md → openclaw-arxchibo/.learnings/
- [ ] error-book/*.md → openclaw-arxchibo/error-book/
- [ ] New reusable patterns → bobo-cli/knowledge/*.md
- [ ] New blocking rules → bobo-cli/knowledge/rules/
- [ ] `npm run build && npm publish` (if knowledge changed)
- [ ] git commit + push both repos
