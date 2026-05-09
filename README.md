<div align="center">

# Bobo CLI

**Portable AI Engineering Assistant**

[![npm version](https://img.shields.io/npm/v/bobo-ai-cli.svg)](https://www.npmjs.com/package/bobo-ai-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An AI-powered terminal assistant with embedded engineering knowledge, skill routing, persistent memory, project context, sub-agents, and verification workflows.

![Bobo CLI intro](https://raw.githubusercontent.com/Arxchibobo/bobo-cli/main/assets/bobo-cli-intro.png)

</div>

---

## Quick Start

```bash
npm install -g bobo-ai-cli

bobo init
bobo config set apiKey <your-api-key>
bobo config set baseUrl https://api.openai.com/v1
bobo config set model gpt-4o

bobo doctor
bobo
bobo -p "summarize this codebase"
```

`bobo` starts the interactive REPL. `bobo -p` runs a non-interactive prompt and also accepts piped input:

```bash
cat src/index.ts | bobo -p "explain the entry point"
```

## What It Does

Bobo CLI is built for project-aware engineering work:

- **Agent loop with tools**: file operations, shell commands, git helpers, web fetch/search, memory, and planning tools.
- **Skill routing**: lightweight built-in skills plus importable `SKILL.md` directories.
- **Structured knowledge**: 16 rules, 125 structured skills, 6 workflows, 22 knowledge files, and 5 memory pattern files.
- **Persistent memory**: durable notes in `~/.bobo/memory.md` and project-level memory in `.bobo/`.
- **Project awareness**: reads local `BOBO.md`, `.bobo/`, `AGENTS.md`, `CLAUDE.md`, and `CONVENTIONS.md` style context.
- **Sub-agents and workflows**: planner, team, verification, interview, ask, autonomous run, and catalog commands.
- **Verification agent**: build/test/lint oriented reports with PASS / FAIL / PARTIAL verdicts.
- **Claude Code bridge**: delegates large refactors to Claude Code when the `claude` CLI is installed.
- **MCP support**: optional local MCP server configuration through `~/.bobo/mcp.json`.

## Core Commands

| Command | Purpose |
| --- | --- |
| `bobo` | Start the interactive REPL |
| `bobo -p "prompt"` | Run a one-shot prompt and print the response |
| `bobo init` | Create `~/.bobo/`, copy bundled knowledge, install bundled skills |
| `bobo doctor` | Check local dependencies and configuration |
| `bobo config list` | Show current config with the API key masked |
| `bobo knowledge` | Show classic knowledge files |
| `bobo kb stats` | Show structured knowledge statistics |
| `bobo rules list` | Browse structured engineering rules |
| `bobo skills list` | Browse structured skills |
| `bobo template project` | Generate a project scaffold |
| `bobo plan "task"` | Generate an execution plan |
| `bobo verify [target]` | Run adversarial verification checks |
| `bobo run "task"` | Run autonomous mode with tool execution |
| `bobo mcp status` | Show configured MCP server status |

## REPL Commands

| Command | Description |
| --- | --- |
| `/help` | Show REPL commands |
| `/status` | Show model, turns, working directory, and session state |
| `/knowledge` | List loaded knowledge files |
| `/skills` | List active skills |
| `/plan` | Show the current task plan |
| `/compact` | Compress conversation context |
| `/dream` | Consolidate memory into structured insights |
| `/verify [task]` | Run the verification agent |
| `/spawn <task>` | Spawn a background sub-agent |
| `/agents` | List sub-agents |
| `/clear` | Clear conversation history |
| `/history` | Show turn count |
| `/quit` | Exit |

## Configuration

Configuration lives in `~/.bobo/config.json`.

```bash
bobo config set apiKey <your-api-key>
bobo config set baseUrl https://api.openai.com/v1
bobo config set model gpt-4o
bobo config set maxTokens 16384
bobo config set effort medium
bobo config set permissionMode ask
bobo config list
```

Bobo uses the OpenAI Chat Completions API shape. Point `baseUrl`, `model`, and `apiKey` at any compatible provider or gateway you use.

Common examples:

```bash
# OpenAI
bobo config set baseUrl https://api.openai.com/v1
bobo config set model gpt-4o

# OpenRouter
bobo config set baseUrl https://openrouter.ai/api/v1
bobo config set model <openrouter-model-id>

# Local Ollama OpenAI-compatible endpoint
bobo config set baseUrl http://localhost:11434/v1
bobo config set model llama3.3
```

## Knowledge And Skills

Bobo has two complementary knowledge systems.

Classic runtime knowledge is loaded into the agent prompt:

- `knowledge/system.md`
- `knowledge/rules.md`
- `knowledge/agent-directives.md`
- on-demand engineering, verification, memory, and task routing files

Structured knowledge powers the `kb`, `rules`, `skills`, and `template` commands:

```bash
bobo kb stats
bobo rules list
bobo rules show blocking-rules
bobo skills list
bobo skills deps review-with-security
```

Bundled runtime skills are copied into `~/.bobo/skills/` by `bobo init`. You can import your own compatible skill directories:

```bash
bobo skill list
bobo skill enable high-agency
bobo skill disable memory-manager
bobo skill import ~/my-skills
```

Each custom skill should be a directory containing `SKILL.md`.

## Project Context

Initialize project-level context inside any repository:

```bash
cd my-project
bobo project init
```

This creates `.bobo/project.json`. Add project-specific Markdown files and reference them from that config. Bobo also checks common instruction files from the project root, including:

- `BOBO.md`
- `.bobo/BOBO.md`
- `AGENTS.md`
- `CLAUDE.md`
- `CONVENTIONS.md`

## Package Contents

The npm package ships:

- compiled CLI files in `dist/`
- structured knowledge in `knowledge/`
- a curated runtime skill bundle in `bundled-skills/`
- `README.md` and `LICENSE`

Source files, tests, temporary folders, local config, and generated tarballs are excluded from the published package.

## Development

```bash
git clone https://github.com/Arxchibobo/bobo-cli.git
cd bobo-cli
npm install

npm run build
npm test
npm run pack:check
npm audit
```

`npm test` builds first, so CLI tests always run against the compiled `dist/index.js` entry point.

For local package testing:

```bash
npm pack
npm install -g ./bobo-ai-cli-*.tgz
bobo --version
bobo --help
```

## Contributing

1. Create a focused branch.
2. Make the smallest useful change.
3. Run `npm test`, `npm run pack:check`, and `npm audit`.
4. Open a pull request with the behavior change, verification evidence, and any known limitations.

## License

MIT — see [LICENSE](LICENSE).
