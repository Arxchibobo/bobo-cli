<div align="center">

# 🐕 Bobo CLI

**Portable AI Engineering Assistant**

[![npm version](https://img.shields.io/npm/v/bobo-cli.svg)](https://www.npmjs.com/package/bobo-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An AI-powered CLI assistant with embedded engineering knowledge, a pluggable skill system, persistent memory, and project-aware context — designed to be your pair-programming partner in the terminal.

![Bobo CLI 介绍](assets/bobo-cli-intro.png)

</div>

---

## Quick Start

```bash
# Install
npm install -g bobo-ai-cli

# Initialize
bobo init
bobo config set apiKey sk-your-anthropic-key

# Start interactive REPL
bobo

# Or run a one-shot prompt
bobo "explain this codebase"
```

## Features

### ⚡ Claude Code Architecture (v2.1.0)
Bobo CLI v2.1.0 implements advanced AI agent patterns inspired by Claude Code:

- **🔍 Verification Agent** — 'Try to break it' philosophy with adversarial testing (build/test/lint + boundary probing)
- **🎭 Role-Based Sub-Agents** — Explore (read-only), Plan (strategy), Worker (execution), Verify (validation)
- **🗜️ Three-Tier Compression** — Microcompact (tool result clearing) → Auto-compact (87% threshold + circuit breaker) → Full compact (LLM summary)
- **🛡️ Tool Governance Pipeline** — Input validation → Risk classification → Permission checks → Execution hooks → Telemetry
- **💾 Cache Boundary Optimization** — STATIC/DYNAMIC prompt separation for provider caching (Anthropic prompt caching compatible)
- **🌙 KAIROS Dream Mode** — Automated memory consolidation (reads logs → LLM distillation → structured insights)

### 🧠 Knowledge System
9 built-in knowledge files that shape the assistant's behavior and engineering methodology:

| File | Type | Description |
|------|------|-------------|
| `system.md` | always | Core identity, work mode, and personality |
| `rules.md` | always | Coding standards, honest reporting, git workflow |
| `agent-directives.md` | always | 10 mechanical override rules (edit safety, context decay, phased execution) |
| `engineering.md` | on-demand | Task routing, search strategies, three-file pattern |
| `error-catalog.md` | on-demand | Top 10 high-frequency error patterns with quick fixes |
| `verification.md` | on-demand | Adversarial verification protocol |
| `task-router.md` | on-demand | Task classification and strategy selection |
| `dream.md` | on-demand | Memory consolidation protocol |
| `advanced-patterns.md` | on-demand | Memory taxonomy, compact protocol, sub-agent architecture |

On-demand files are loaded automatically when the user's message matches trigger keywords.

### 🧩 Skill System
47 skills (2 built-in + 45 importable) covering coding, research, verification, context management, self-improvement, and domain-specific tools:

```bash
bobo skill list              # List all skills
bobo skill enable semrush    # Enable a skill
bobo skill disable coding    # Disable a skill
bobo skill import ~/skills/  # Batch import from directory
```

**Core skills (enabled by default):**
- `coding` — Code standards, zero-comment principle, review checklist
- `research` — Search strategies, information synthesis
- `adversarial-verification` — Break-it-don't-confirm-it validation
- `context-compressor` — Nine-section context compression
- `context-budget-analyzer` — Token usage analysis
- `proactive-self-improving` — Automatic experience capture and evolution
- `high-agency` — Sustained motivation and ownership mindset
- `memory-manager` — Structured long-term memory management
- `deep-research` — Multi-model deep research with citations

### 🔧 Tool System
18 tools available to the AI assistant:

| Category | Tools |
|----------|-------|
| **File** | `read_file`, `write_file`, `edit_file`, `search_files`, `list_directory` |
| **Shell** | `shell` |
| **Memory** | `save_memory`, `search_memory` |
| **Git** | `git_status`, `git_diff`, `git_log`, `git_commit`, `git_push` |
| **Planner** | `create_plan`, `update_plan`, `show_plan` |
| **Web** | `web_search`, `web_fetch` |

### 💾 Memory System
Persistent memory across sessions with structured categories:

- **user** — Preferences and habits
- **feedback** — Corrections and confirmations
- **project** — Active tasks and goals
- **reference** — External knowledge not in code
- **experience** — Lessons learned

Memory is stored in `~/.bobo/memory.md` with a 5KB auto-slim cap and daily logs in `~/.bobo/memory/`.

### 📁 Project Awareness
Drop a `.bobo/` directory in any project to provide project-specific context:

```bash
cd my-project
bobo project init    # Creates .bobo/project.json
```

Bobo automatically detects and loads `AGENTS.md`, `CLAUDE.md`, and `CONVENTIONS.md` from the project root.

## Architecture

```
bobo CLI v2.1.0 — Claude Code-inspired Agent Architecture
│
├── System Prompt Assembly (STATIC/DYNAMIC separation)
│   STATIC (cacheable):
│   ① Knowledge (3 always-load + 6 on-demand)
│   ② Skills (active skill prompts)
│   ③ BOBO.md project instructions
│   ━━━━━━━━ DYNAMIC BOUNDARY ━━━━━━━━
│   DYNAMIC (session-specific):
│   ④ Memory (persistent user/project/feedback data)
│   ⑤ Project context (.bobo/ + auto-detected files)
│   ⑥ Environment (CWD + turn count + decay warnings)
│
├── Agent Loop (with governance)
│   ├── Streaming responses with tool calls
│   ├── Tool Governance Pipeline:
│   │   Input validation → Risk classification → PreToolUse Hook →
│   │   Permission check → Execution → PostToolUse Hook → Telemetry
│   ├── Three-tier compression:
│   │   60%: Microcompact (clear old tool results)
│   │   87%: Auto-compact (with circuit breaker)
│   │   95%: Full compact (LLM summary)
│   └── Max 20 iterations per turn
│
├── Sub-Agent System (role-based)
│   ├── explore  — Read-only exploration
│   ├── plan     — Strategy without execution
│   ├── worker   — Full tools + anti-recursion
│   └── verify   — Adversarial validation
│
├── Verification Agent
│   ├── Build/Test/Lint enforcement
│   ├── Adversarial probing (boundary tests, API calls)
│   └── Verdict: PASS / FAIL / PARTIAL
│
├── KAIROS Dream Mode
│   ├── Auto-trigger: 50+ entries or 24h since last dream
│   ├── LLM distillation: Logs → Insights (confidence-scored)
│   └── Memory consolidation: Dedupe + category organization
│
├── Structured Knowledge (advanced)
│   ├── knowledge/rules/     — 15+ domain rule files
│   ├── knowledge/skills/    — 140+ structured skill files
│   ├── knowledge/workflows/ — 6 workflow templates
│   └── knowledge/memory/    — Extracted patterns
│
└── CLI Commands
    ├── bobo [prompt]        — One-shot or REPL mode
    ├── bobo config          — Configuration management
    ├── bobo init            — Initialize ~/.bobo/
    ├── bobo knowledge       — View knowledge base
    ├── bobo skill           — Skill management
    ├── bobo spawn <task>    — Background sub-agent (with role)
    ├── bobo agents          — Manage sub-agents
    ├── bobo kb              — Structured knowledge search
    ├── bobo rules           — Browse engineering rules
    ├── bobo skills          — Structured skill browser
    ├── bobo template        — Project scaffolding
    └── bobo project         — Project configuration
```

## REPL Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/status` | Session status (model, turns, CWD) |
| `/knowledge` | List loaded knowledge files |
| `/skills` | List active skills |
| `/plan` | Show current task plan |
| `/compact` | Compress context (nine-section summary) |
| `/dream` | 🌙 KAIROS memory consolidation (LLM-powered insight extraction) |
| `/verify [task]` | 🔍 Run verification agent with adversarial testing |
| `/spawn <task>` | Spawn background sub-agent (with role support) |
| `/agents` | List all sub-agents and their status |
| `/clear` | Clear conversation history |
| `/history` | Show turn count |
| `/quit` | Exit |

## Configuration

```bash
bobo config set apiKey sk-your-key    # API key (required)
bobo config set model gpt-4o          # Model name
bobo config set baseUrl https://...   # API base URL
bobo config set maxTokens 8192        # Max response tokens
bobo config list                      # Show all config
```

Configuration is stored in `~/.bobo/config.json`. The API key is masked in `config list` output.

### Supported Providers

Bobo CLI uses the OpenAI-compatible API format. It works with:
- **Anthropic** (default) — `baseUrl: https://api.anthropic.com/v1`
- **OpenAI** — `baseUrl: https://api.openai.com/v1`
- **Azure OpenAI** — Set your Azure endpoint as `baseUrl`
- **Any OpenAI-compatible API** — Ollama, Together, Groq, etc.

## Knowledge Customization

### Adding custom knowledge
Place `.md` files in `~/.bobo/knowledge/` — they'll be loaded as custom context:

```bash
echo "# My Team Standards\n\nAlways use TypeScript strict mode." > ~/.bobo/knowledge/team.md
```

### Importing skills from OpenClaw
If you use [OpenClaw](https://github.com/openclaw/openclaw), you can import its skills directly:

```bash
bobo skill import ~/.openclaw/workspace/skills/
```

## Contributing

Contributions are welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Run tests (`npm test`)
4. Ensure the build passes (`npm run build`)
5. Submit a PR

### Development

```bash
git clone https://github.com/Arxchibobo/bobo-cli.git
cd bobo-cli
npm install
npm run dev    # Run with tsx (hot reload)
npm run build  # Compile TypeScript
npm test       # Run tests
```

## License

MIT — see [LICENSE](LICENSE) for details.
