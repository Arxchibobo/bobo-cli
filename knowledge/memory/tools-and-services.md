---
id: "tools-and-services"
title: "Tools & Services Memory"
type: "custom"
tags: [memory, template]
template: true
---

# Tools & Services Memory
> API configs, MCP servers, external accounts

---

## MCP Servers (Active)

### Bytebase (SQL)
- **Tool**: `mcp__mcphub__bytebase-execute_sql`
- **Databases**: PostgreSQL (Vercel), MySQL (my_shell_prod)
- **Rules**: Always transactional, include rollback

### Playwright (Browser)
- **Tools**: `mcp__plugin_playwright_playwright__*`
- **Screenshots**: Save to `./CCimages/screenshots/`
- **Version fix**: If chromium error → `npx playwright@latest install chromium`
- **Manual symlink**: `cd ~/AppData/Local/ms-playwright && cmd //c "mklink /J chromium-1200 chromium-1181"`

### Stitch (UI Design)
- **Tools**: `mcp__stitch__*`
- **Purpose**: UI design generation and editing

## External Accounts

### Moltbook
- **Account**: u/BoboClaudeHelper
- **URL**: https://www.moltbook.com/u/BoboClaudeHelper
- **Stats**: 15 karma, 6 followers, 29 comments, 6 posts
- **Rate limits**: 30min between posts, 20sec between comments
- **Details**: → `memory/moltbook.md`

### MyShell
- **Owner**: Bobo Zhou (@Arxchibo_shell, 830 followers)
- **Platform**: https://www.moltbook.com references MyShell.ai
- **Products**: AI Portrait Generator, various bots

### EvoMap
- **Status**: Active contributor
- **Reputation**: ~67.55/100 (pre-2026-02-23 session)
- **Published**: 5 Capsules (all accepted)
- **Tools**:
  - Scan: `bash scripts/detect-bug-patterns.sh`
  - Publish: `node scripts/publish-*-fix.js`
  - Dashboard: `node scripts/dashboard.js`
  - Search: `node scripts/search-evomap.js`

## Skills Quick Reference

### Most Used
| Skill | Trigger | Purpose |
|-------|---------|---------|
| /commit | Git commit | Generate commit message |
| /create-pr | PR creation | Analyze & create PR |
| seedance-prompt | Video keywords | Seedance 2.0 prompts |
| ui-ux-pro-max | UI design | Design intelligence |
| nano-banana-pro | Image gen/edit | Image generation |

### Domain-Specific
| Skill | Domain | When |
|-------|--------|------|
| frontend-design | UI | Creating interfaces |
| backend-expert | API | Backend development |
| docker-expert | DevOps | Container work |
| testing-expert | QA | Test strategies |
| security-audit-expert | Security | Vulnerability checks |

## Scripts Directory (E:\Bobo's Coding cache\scripts\)
- `detect-bug-patterns.sh` - Auto bug scanning
- `publish-*-fix.js` - EvoMap Capsule publishing (9+ scripts)
- `search-evomap.js` - EvoMap solution search
- `dashboard.js` - EvoMap reputation monitor
- `ask-opus.py/sh` - Opus model queries
- `scrape-myshell-bot.js/py` - MyShell bot scraping
- `runninghub-face-swap.js` - Face swap automation

---
_Updated: 2026-03-02 | Add new services as discovered_
