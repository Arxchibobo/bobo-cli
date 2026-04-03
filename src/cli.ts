/**
 * CLI command registration — all commander subcommands.
 */

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, statSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import {
  setConfigValue,
  getConfigValue,
  listConfig,
  ensureConfigDir,
  getConfigDir,
  resolveKnowledgeDir,
  loadConfig,
} from './config.js';
import { listKnowledgeFiles } from './knowledge.js';
import { listSkills, setSkillEnabled, initSkills, importSkills } from './skills.js';
import { initProject } from './project.js';
import { toolDefinitions } from './tools/index.js';
import { printWelcome, printError, printSuccess, printLine, printWarning } from './ui.js';
import { registerKnowledgeCommand } from './knowledge-commands.js';
import { registerRulesCommand } from './rules-commands.js';
import { registerStructuredSkillsCommand } from './structured-skills-commands.js';
import { registerStructuredTemplateCommand } from './structured-template-commands.js';
import { spawnSubAgent, listSubAgents, getSubAgent } from './sub-agents.js';
import { initHooksTemplate } from './hooks.js';
import { initMcpServers, shutdownMcpServers, getMcpStatus } from './mcp-client.js';
import { startWatch } from './watcher.js';
import { runAutonomous } from './autonomous.js';
import { runTeamWorkflow, runPlanWorkflow, runVerifyWorkflow, runInterviewWorkflow, runAskWorkflow } from './workflows/index.js';
import { getAllAgentRoles } from './agents/catalog.js';
import type { EffortLevel } from './config.js';

/**
 * Register all CLI subcommands on the program.
 */
export function registerCommands(program: Command): void {
  // ─── Config subcommand ───────────────────────────────────────
  const configCmd = program.command('config').description('Manage configuration');

  configCmd
    .command('set <key> <value>')
    .description('Set a config value')
    .action((key: string, value: string) => {
      try {
        setConfigValue(key, value);
        printSuccess(`${key} = ${key === 'apiKey' ? '***' : value}`);
      } catch (e) {
        printError((e as Error).message);
        process.exit(1);
      }
    });

  configCmd
    .command('get <key>')
    .description('Get a config value')
    .action((key: string) => {
      const value = getConfigValue(key);
      if (value === undefined) {
        printError(`Unknown key: ${key}`);
        process.exit(1);
      }
      console.log(value);
    });

  configCmd
    .command('list')
    .description('Show all configuration')
    .action(() => {
      const config = listConfig();
      for (const [k, v] of Object.entries(config)) {
        console.log(`${chalk.cyan(k)}: ${v}`);
      }
    });

  // ─── Init subcommand ─────────────────────────────────────────
  program
    .command('init')
    .description('Initialize ~/.bobo/ directory and knowledge base')
    .action(() => {
      ensureConfigDir();
      const config = loadConfig();
      const knowledgeDir = resolveKnowledgeDir(config);

      if (!existsSync(knowledgeDir)) {
        mkdirSync(knowledgeDir, { recursive: true });
      }

      // Import __dirname equivalent
      const __dirname = new URL('.', import.meta.url).pathname;
      const bundledDir = join(__dirname, '..', 'knowledge');
      if (existsSync(bundledDir)) {
        const files = readdirSync(bundledDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          const target = join(knowledgeDir, file);
          const source = join(bundledDir, file);
          if (!existsSync(target)) {
            copyFileSync(source, target);
            printSuccess(`Created ${target}`);
          }
        }
      }

      const memoryDir = join(getConfigDir(), 'memory');
      const learningsDir = join(getConfigDir(), '.learnings');
      const sessionsDir = join(getConfigDir(), 'sessions');
      const agentsDir = join(getConfigDir(), 'agents');
      for (const dir of [memoryDir, learningsDir, sessionsDir, agentsDir]) {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
          printSuccess(`Created ${dir}`);
        }
      }

      initSkills();

      // Copy bundled skills
      const bundledSkillsDir = join(__dirname, '..', 'bundled-skills');
      const userSkillsDir = join(getConfigDir(), 'skills');
      if (existsSync(bundledSkillsDir)) {
        if (!existsSync(userSkillsDir)) {
          mkdirSync(userSkillsDir, { recursive: true });
        }
        let installed = 0;
        for (const skillName of readdirSync(bundledSkillsDir)) {
          const src = join(bundledSkillsDir, skillName);
          const dest = join(userSkillsDir, skillName);
          try {
            if (!statSync(src).isDirectory()) continue;
          } catch { continue; }
          if (!existsSync(dest)) {
            cpSync(src, dest, { recursive: true });
            installed++;
          }
        }
        if (installed > 0) {
          const manifestPath = join(getConfigDir(), 'skills-manifest.json');
          let manifest: Record<string, unknown> = {};
          try {
            manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          } catch { manifest = { version: 1, skills: {} }; }
          const skills = (manifest.skills || {}) as Record<string, { enabled: boolean }>;
          for (const skillName of readdirSync(userSkillsDir)) {
            if (!skills[skillName]) {
              skills[skillName] = { enabled: true };
            }
          }
          manifest.skills = skills;
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
          printSuccess(`${installed} skills installed (all enabled, passive triggering)`);
        }
      }

      // Create BOBO.md template
      const boboMdPath = join(process.cwd(), 'BOBO.md');
      if (!existsSync(boboMdPath)) {
        writeFileSync(boboMdPath, `# Project Instructions

<!-- Bobo reads this file at the start of every session. -->
<!-- Add coding standards, architecture decisions, and project-specific rules here. -->

## Build & Test
<!-- e.g.: npm run build, npm test -->

## Style Guide
<!-- e.g.: Use TypeScript strict mode, prefer const over let -->
`);
        printSuccess('Created BOBO.md (project instructions)');
      }

      printSuccess(`Initialized ${getConfigDir()}`);
      printLine(`Knowledge: ${knowledgeDir}`);
      printWarning('Configure your API key: bobo config set apiKey <your-key>');
    });

  // ─── Doctor subcommand ───────────────────────────────────────
  program
    .command('doctor')
    .description('Check environment dependencies for skills')
    .action(() => {
      printLine(chalk.cyan.bold('\n🩺 Bobo Doctor — Environment Check\n'));

      const checks: Array<{ name: string; cmd: string; required: boolean }> = [
        { name: 'Node.js', cmd: 'node --version', required: true },
        { name: 'Python 3', cmd: 'python3 --version', required: false },
        { name: 'pip3', cmd: 'pip3 --version', required: false },
        { name: 'Git', cmd: 'git --version', required: true },
        { name: 'ffmpeg', cmd: 'ffmpeg -version', required: false },
        { name: 'npm', cmd: 'npm --version', required: true },
        { name: 'curl', cmd: 'curl --version', required: false },
      ];

      let allGood = true;
      for (const check of checks) {
        try {
          const output = execSync(check.cmd, { timeout: 5000, stdio: 'pipe' }).toString().trim().split('\n')[0];
          printLine(`  ${chalk.green('✓')} ${check.name.padEnd(12)} ${chalk.dim(output)}`);
        } catch {
          const icon = check.required ? chalk.red('✗') : chalk.yellow('○');
          const label = check.required ? chalk.red('MISSING (required)') : chalk.yellow('not found (optional)');
          printLine(`  ${icon} ${check.name.padEnd(12)} ${label}`);
          if (check.required) allGood = false;
        }
      }

      const config = loadConfig();
      if (config.apiKey) {
        printLine(`  ${chalk.green('✓')} ${'API Key'.padEnd(12)} ${chalk.dim('configured')}`);
      } else {
        printLine(`  ${chalk.red('✗')} ${'API Key'.padEnd(12)} ${chalk.red('not set — run: bobo config set apiKey <key>')}`);
        allGood = false;
      }

      const boboMd = existsSync(join(process.cwd(), 'BOBO.md'));
      printLine(`  ${boboMd ? chalk.green('✓') : chalk.yellow('○')} ${'BOBO.md'.padEnd(12)} ${boboMd ? chalk.dim('found') : chalk.yellow('not found — run: bobo init')}`);

      const skillsDir = join(getConfigDir(), 'skills');
      if (existsSync(skillsDir)) {
        const count = readdirSync(skillsDir).filter(f => {
          try { return statSync(join(skillsDir, f)).isDirectory(); } catch { return false; }
        }).length;
        printLine(`  ${chalk.green('✓')} ${'Skills'.padEnd(12)} ${chalk.dim(`${count} installed`)}`);
      } else {
        printLine(`  ${chalk.yellow('○')} ${'Skills'.padEnd(12)} ${chalk.yellow('none — run: bobo init')}`);
      }

      printLine();
      if (allGood) {
        printSuccess('All required dependencies are available! 🐕');
      } else {
        printWarning('Some required dependencies are missing.');
      }
      printLine();
    });

  // ─── Spawn subcommand ────────────────────────────────────────
  program
    .command('spawn <task>')
    .description('Spawn a background sub-agent to run a task')
    .action((task: string) => {
      const result = spawnSubAgent(task);
      if (result.error) {
        printError(result.error);
        process.exit(1);
      }
      printSuccess(`Sub-agent ${result.id} spawned!`);
      printLine(chalk.dim(`  Task: ${task.slice(0, 80)}${task.length > 80 ? '...' : ''}`));
      printLine(chalk.dim(`  Check status: bobo agents`));
    });

  // ─── Agents subcommand ───────────────────────────────────────
  const agentsCmd = program.command('agents').description('Manage sub-agents');

  agentsCmd
    .command('list')
    .description('List all sub-agents')
    .action(() => {
      const agents = listSubAgents();
      if (agents.length === 0) {
        printLine(chalk.dim('No sub-agents. Spawn one with: bobo spawn "task"'));
        return;
      }
      printLine(chalk.cyan.bold('\n🤖 Sub-Agents:\n'));
      for (const a of agents) {
        const icon = a.status === 'completed' ? '✅' : a.status === 'failed' ? '❌' : '⏳';
        const task = a.task.slice(0, 60) + (a.task.length > 60 ? '...' : '');
        printLine(`  ${icon} ${chalk.bold(a.id)} — ${task}`);
        printLine(`     ${chalk.dim(a.startedAt)} ${chalk.dim(`[${a.status}]`)}`);
      }
      printLine();
    });

  agentsCmd
    .command('show <id>')
    .description('Show sub-agent result')
    .action((id: string) => {
      const agent = getSubAgent(id);
      if (!agent) {
        printError(`Sub-agent not found: ${id}`);
        return;
      }
      printLine(chalk.cyan.bold(`\n🤖 Sub-Agent: ${agent.id}\n`));
      printLine(`  Status:  ${agent.status}`);
      printLine(`  Task:    ${agent.task}`);
      printLine(`  Started: ${agent.startedAt}`);
      if (agent.completedAt) printLine(`  Done:    ${agent.completedAt}`);
      if (agent.result) {
        printLine(`\n${chalk.dim('─'.repeat(50))}\n`);
        printLine(agent.result);
      }
      if (agent.error) {
        printLine(`\n${chalk.red('Error:')} ${agent.error}`);
      }
      printLine();
    });

  agentsCmd.action(() => {
    const agents = listSubAgents();
    if (agents.length === 0) {
      printLine(chalk.dim('No sub-agents. Spawn one with: bobo spawn "task"'));
      return;
    }
    printLine(chalk.cyan.bold('\n🤖 Sub-Agents:\n'));
    for (const a of agents) {
      const icon = a.status === 'completed' ? '✅' : a.status === 'failed' ? '❌' : '⏳';
      const task = a.task.slice(0, 60) + (a.task.length > 60 ? '...' : '');
      printLine(`  ${icon} ${chalk.bold(a.id)} — ${task}`);
    }
    printLine();
  });

  // ─── Knowledge subcommand ────────────────────────────────────
  program
    .command('knowledge')
    .description('Show knowledge base files')
    .action(() => {
      const files = listKnowledgeFiles();
      console.log(chalk.cyan.bold('\n📚 Knowledge Base:\n'));
      for (const f of files) {
        const typeIcon = f.type === 'always' ? '🔵' : f.type === 'on-demand' ? '🟡' : '🟢';
        const sourceTag = f.source === 'user' ? chalk.green('user') : chalk.dim('bundled');
        console.log(`  ${typeIcon} ${f.file} [${sourceTag}] (${f.type})`);
      }
      console.log(chalk.dim('\n  🔵 always-load  🟡 on-demand  🟢 custom\n'));
    });

  // ─── Skill subcommand ────────────────────────────────────────
  const skillCmd = program.command('skill').description('Manage skills');

  skillCmd.command('list').description('List all skills').action(() => {
    const skills = listSkills();
    console.log(chalk.cyan.bold('\n🧩 Skills:\n'));
    for (const s of skills) {
      const icon = s.enabled ? '✅' : '❌';
      const typeTag = s.type === 'builtin' ? chalk.dim('builtin') : chalk.green('custom');
      console.log(`  ${icon} ${chalk.bold(s.name)} [${typeTag}] — ${s.description}`);
    }
    console.log();
  });

  skillCmd.command('enable <name>').description('Enable a skill').action((name: string) => {
    console.log(setSkillEnabled(name, true));
  });

  skillCmd.command('disable <name>').description('Disable a skill').action((name: string) => {
    console.log(setSkillEnabled(name, false));
  });

  skillCmd.command('import <path>').description('Batch import skills').action((path: string) => {
    const resolved = path.startsWith('~') ? join(process.env.HOME || '', path.slice(1)) : path;
    console.log(importSkills(resolved));
  });

  // ─── Workflow commands ──────────────────────────────────────
  program
    .command('team <spec> <task>')
    .description('Run a team workflow, e.g. bobo team 3:executor "build REST API"')
    .action(async (spec: string, task: string) => {
      const [countRaw, roleRaw] = spec.split(':');
      const teamSize = Number.parseInt(countRaw, 10);
      const roles = getAllAgentRoles();
      if (!Number.isFinite(teamSize) || teamSize <= 0) {
        printError('Invalid team size. Use format: <N>:<role>');
        process.exit(1);
      }
      if (roleRaw && !roles.includes(roleRaw)) {
        printError(`Invalid role: ${roleRaw}. Available: ${roles.join(', ')}`);
        process.exit(1);
      }
      const result = await runTeamWorkflow(task, teamSize, roleRaw as never);
      printSuccess(result.summary);
      printLine(`Plan: ${result.planPath}`);
      printLine(`PRD: ${result.prdPath}`);
      printLine(`Artifact: ${result.teamPath}`);
    });

  program
    .command('plan <task>')
    .description('Create a structured execution plan')
    .action(async (task: string) => {
      const result = await runPlanWorkflow(task);
      printSuccess(`Planned with ${result.role} (${result.model})`);
      printLine(result.path);
    });

  program
    .command('verify [target]')
    .description('Create an adversarial verification artifact')
    .action(async (target?: string) => {
      const result = await runVerifyWorkflow(target);
      printSuccess(`Verification scaffold created (${result.verdict})`);
      printLine(result.path);
    });

  program
    .command('interview <topic>')
    .description('Run a deep interview scaffold')
    .action(async (topic: string) => {
      const result = await runInterviewWorkflow(topic);
      printSuccess('Interview scaffold created');
      printLine(result.path);
      result.questions.forEach((q, i) => printLine(`${i + 1}. ${q}`));
    });

  program
    .command('ask <model> <prompt>')
    .description('Create a cross-model ask artifact')
    .action(async (model: string, prompt: string) => {
      const result = await runAskWorkflow(model, prompt);
      printSuccess(`Ask scaffold created for ${result.model}`);
      printLine(result.path);
    });

  // ─── Watch command ───────────────────────────────────────────
  program
    .command('watch')

    .description('Watch files for changes and auto-run hooks (daemon-like mode)')
    .option('--ignore <patterns>', 'Additional ignore patterns (comma-separated)', '')
    .action((opts: { ignore: string }) => {
      const ignore = opts.ignore ? opts.ignore.split(',').map(s => s.trim()) : [];
      startWatch({
        dir: process.cwd(),
        recursive: true,
        ignore,
      });
    });

  // ─── Run command ─────────────────────────────────────────────
  program
    .command('run <task>')
    .description('Autonomous mode: give a task, Bobo runs until done (like Claude Code agent loop)')
    .option('--model <model>', 'Override model')
    .option('--effort <level>', 'Effort level (low/medium/high)', 'high')
    .option('--max-iterations <n>', 'Maximum iterations', '5')
    .option('--log <path>', 'Log file path')
    .action(async (task: string, opts: { model?: string; effort?: string; maxIterations?: string; log?: string }) => {
      await runAutonomous({
        task,
        model: opts.model,
        effort: (opts.effort || 'high') as EffortLevel,
        permissionMode: 'auto',
        maxIterations: parseInt(opts.maxIterations || '5', 10),
        logFile: opts.log,
      });
    });

  // ─── Evolve command ──────────────────────────────────────────
  program
    .command('evolve [focus]')
    .description('Self-improvement: use Claude Code to enhance Bobo CLI itself')
    .option('--dry-run', 'Show what would be improved without making changes')
    .action(async (focus: string | undefined, opts: { dryRun?: boolean }) => {
      const { isClaudeCodeAvailable: ccAvailable, executeClaudeCodeTool: ccExec } = await import('./tools/claude-code.js');

      if (!ccAvailable()) {
        printError('Claude Code not found. Install: npm install -g @anthropic-ai/claude-code');
        return;
      }

      const areas = focus || 'streaming output quality, error handling, test coverage';
      const dryRun = opts.dryRun ? ' List the improvements but DO NOT make changes.' : '';

      printLine(chalk.cyan.bold('\n🧬 Bobo Evolve — Self-Improvement Mode\n'));
      printLine(chalk.dim(`  Focus: ${areas}`));
      printLine(chalk.dim(`  Mode: ${opts.dryRun ? 'dry-run (preview only)' : 'live (will modify code)'}`));
      printLine(chalk.dim('  Using Claude Code as implementation engine\n'));

      const task = `You are improving Bobo CLI (an AI coding assistant CLI tool).
The source code is in the current directory.
Focus on: ${areas}

Instructions:
1. Read the relevant source files
2. Identify specific improvements
3. Implement the improvements${dryRun}
4. Run \`npm run build\` to verify
5. Summarize what you changed and why

Keep changes minimal and focused. Do not break existing functionality.`;

      printLine(chalk.dim('Delegating to Claude Code...'));
      const result = ccExec('claude_code', { task, cwd: process.cwd() });
      printLine(result);
    });

  // ─── MCP command ─────────────────────────────────────────────
  const mcpCmd = program.command('mcp').description('Manage MCP (Model Context Protocol) servers');

  mcpCmd
    .command('status')
    .description('Show MCP server status')
    .action(async () => {
      await initMcpServers();
      const status = getMcpStatus();
      if (status.length === 0) {
        printLine(chalk.dim('No MCP servers configured.'));
        printLine(chalk.dim('Create ~/.bobo/mcp.json to add servers.'));
        return;
      }
      printLine(chalk.cyan.bold('\n🔌 MCP Servers:\n'));
      for (const s of status) {
        const icon = s.ready ? chalk.green('●') : chalk.red('●');
        printLine(`  ${icon} ${chalk.bold(s.name)} [${s.transport}] — ${s.toolCount} tools`);
      }
      printLine();
      shutdownMcpServers();
    });

  mcpCmd
    .command('init')
    .description('Create MCP configuration template')
    .action(() => {
      const configPath = join(getConfigDir(), 'mcp.json');
      if (existsSync(configPath)) {
        printWarning('mcp.json already exists');
        return;
      }
      writeFileSync(configPath, JSON.stringify({
        servers: [
          {
            name: 'example',
            transport: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
            _comment: 'Replace with your MCP server',
          },
        ],
      }, null, 2) + '\n');
      printSuccess(`Created ${configPath}`);
    });

  // ─── Hooks command ───────────────────────────────────────────
  program
    .command('hooks')
    .description('Manage lifecycle hooks')
    .option('--init', 'Create hooks.json template')
    .action((opts: { init?: boolean }) => {
      if (opts.init) {
        const hooksPath = join(getConfigDir(), 'hooks.json');
        if (existsSync(hooksPath)) {
          printWarning('hooks.json already exists');
          return;
        }
        writeFileSync(hooksPath, initHooksTemplate() + '\n');
        printSuccess(`Created ${hooksPath}`);
        printLine(chalk.dim('  Available hooks: pre-edit, post-edit, pre-shell, post-shell, pre-commit, post-commit, session-end'));
        return;
      }
      // Show current hooks
      const hooksPath = join(getConfigDir(), 'hooks.json');
      if (!existsSync(hooksPath)) {
        printLine(chalk.dim('No hooks configured. Run: bobo hooks --init'));
        return;
      }
      try {
        const hooks = JSON.parse(readFileSync(hooksPath, 'utf-8'));
        printLine(chalk.cyan.bold('\n🪝 Hooks:\n'));
        for (const [event, cmds] of Object.entries(hooks)) {
          if (event.startsWith('_')) continue;
          const arr = Array.isArray(cmds) ? cmds : [cmds];
          if (arr.length === 0) continue;
          printLine(`  ${chalk.bold(event)}`);
          for (const cmd of arr) {
            printLine(`    → ${chalk.dim(String(cmd))}`);
          }
        }
        printLine();
      } catch {
        printError('Failed to parse hooks.json');
      }
    });

  // ─── Structured knowledge commands ──────────────────────────
  registerKnowledgeCommand(program);
  registerRulesCommand(program);
  registerStructuredSkillsCommand(program);
  registerStructuredTemplateCommand(program);

  // ─── Project subcommand ──────────────────────────────────────
  const projectCmd = program.command('project').description('Manage project configuration');
  projectCmd.command('init').description('Initialize .bobo/ project config').action(() => {
    printSuccess(initProject());
  });
}
