---
id: "git"
title: "Git Workflow"
category: "domain"
tags: ["git workflow", "commit format", "pr workflow", "feature workflow"]
source: "C:/Users/Administrator/.claude/rules/domain/git.md"
---

# Git Workflow

## Commit Format
```
<type>: <description>

<optional body>
```
Types: feat, fix, refactor, docs, test, chore, perf, ci

Note: Attribution disabled globally via ~/.claude/settings.json.

## PR Workflow
1. Analyze **full** commit history (not just latest)
2. `git diff [base-branch]...HEAD` for all changes
3. Comprehensive PR summary + test plan
4. Push with `-u` flag if new branch

## Feature Workflow
1. **Plan**: Use planner agent → break into phases
2. **Implement**: TDD approach (→ see `testing.md`)
3. **Review**: Use code-reviewer agent immediately after writing
4. **Commit**: Conventional commits format
