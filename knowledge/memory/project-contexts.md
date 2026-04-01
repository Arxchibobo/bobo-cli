---
id: "project-contexts"
title: "Project Contexts Memory"
type: "custom"
tags: [memory, template]
template: true
---

# Project Contexts Memory
> Track active project state across sessions

---

## Workspace: E:\Bobo's Coding cache

### Git Status
- **Branch**: master (main branch: main)
- **Monorepo**: package.json + pnpm-lock.yaml at root
- **Packages**: eslint-config, tsconfig (under packages/)

### Active Subprojects

#### bo-work/vibecraft
- **Type**: 3D visualization platform
- **Tech**: React + Three.js / R3F
- **Key files**: Check for scene components, layout algorithms
- **Notes**: Has VibeCraft hooks integration (.claude/hooks/vibecraft-hook.js)

#### bo-work/claude-reconstruction
- **Type**: Claude system reconstruction
- **Status**: Modified (see git status)

#### reconstruction-3d
- **Type**: 3D reconstruction project
- **Tech**: Three.js related

#### evomap/
- **Type**: EvoMap reputation building system
- **Status**: Active development
- **Scripts**: scripts/publish-*-fix.js, scripts/detect-bug-patterns.sh
- **Last session**: 2026-02-23 (5 Capsules published)

#### openclaw/
- **Type**: OpenClaw integration
- **Status**: New/in progress

### Archived/Completed
- `dog-interview-video/` - Remotion video project (deleted from git)
- `myshell-work-automation/` - Work automation tools (deleted from git)
- Various bot JSON downloads (deleted from git)

---

## Key Config Files
- `.claude/settings.local.json` - Local Claude settings
- `.claude/rules/remotion-auto-production.md` - Remotion automation (1112 lines)
- `package.json` / `pnpm-lock.yaml` - Root monorepo config

## Database Connections
- **PostgreSQL** (Vercel): Via Bytebase MCP
- **MySQL** (my_shell_prod): Via Bytebase MCP
- **Query tool**: `mcp__mcphub__bytebase-execute_sql`

## Deployment
- **Frontend**: Likely Vercel (check project configs)
- **Backend**: Check individual subproject configs

---
_Updated: 2026-03-02 | Refresh when project state changes significantly_
