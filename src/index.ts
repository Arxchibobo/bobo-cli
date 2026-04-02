#!/usr/bin/env node

import { Command, Option } from 'commander';
import { createInterface } from 'node:readline';
import { readFileSync, existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, statSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import type { ChatCompletionMessageParam } from 'openai/resources/index.js';
import {
  loadConfig,
  setConfigValue,
  getConfigValue,
  listConfig,
  ensureConfigDir,
  getConfigDir,
  resolveKnowledgeDir,
  saveConfig,
  type EffortLevel,
  type PermissionMode,
} from './config.js';
import { runAgent } from './agent.js';
import { listKnowledgeFiles } from './knowledge.js';
import { listSkills, setSkillEnabled, initSkills, importSkills } from './skills.js';
import { initProject } from './project.js';
import { getCurrentPlan, resetPlan } from './planner.js';
import { toolDefinitions } from './tools/index.js';
import { printWelcome, printError, printSuccess, printLine, printWarning } from './ui.js';
import { registerKnowledgeCommand } from './knowledge-commands.js';
import { registerRulesCommand } from './rules-commands.js';
import { registerStructuredSkillsCommand } from './structured-skills-commands.js';
import { registerStructuredTemplateCommand } from './structured-template-commands.js';
import { saveSession, listSessions, loadSession, getRecentSession } from './sessions.js';
import { generateInsight } from './insight.js';
import { spawnSubAgent, listSubAgents, getSubAgent } from './sub-agents.js';
import { enableStatusBar, disableStatusBar, updateStatusBar, setupResizeHandler, renderStatusBar } from './statusbar.js';
import { slashCompleter } from './completer.js';
import { runHooks, initHooksTemplate } from './hooks.js';
import { initMcpServers, shutdownMcpServers, getMcpStatus } from './mcp-client.js';
import { startWatch } from './watcher.js';
import { runAutonomous } from './autonomous.js';
import { killAllProcesses } from './tools/process-manager.js';
import { getCompactStatus, compressHistory } from './compactor.js';
import chalk from 'chalk';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
let version = '0.1.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  version = pkg.version;
} catch { /* use default */ }

const program = new Command();

program
  .name('bobo')
  .description('🐕 Bobo CLI — Portable AI Engineering Assistant')
  .version(version)
  .argument('[prompt...]', 'Run a one-shot prompt without entering REPL')
  .addOption(new Option('-p, --print', 'Non-interactive mode: print response and exit (supports piped input)'))
  .addOption(new Option('-c, --continue', 'Continue most recent conversation'))
  .addOption(new Option('-r, --resume <session>', 'Resume a specific session by ID'))
  .addOption(new Option('--model <model>', 'Override model for this session'))
  .addOption(new Option('--effort <level>', 'Set effort level').choices(['low', 'medium', 'high']))
  .addOption(new Option('--full-auto', 'Auto-approve all tool calls'))
  .addOption(new Option('--yolo', 'No sandbox, no approvals (dangerous!)'))
  .action(async (promptParts: string[], opts: {
    print?: boolean;
    continue?: boolean;
    resume?: string;
    model?: string;
    effort?: string;
    fullAuto?: boolean;
    yolo?: boolean;
  }) => {
    const prompt = promptParts.join(' ').trim();

    // Determine permission mode
    let permissionMode: PermissionMode = 'ask';
    if (opts.fullAuto) permissionMode = 'auto';
    if (opts.yolo) permissionMode = 'yolo';

    // -p mode: non-interactive, supports piped input
    if (opts.print) {
      await runPrintMode(prompt, {
        model: opts.model,
        effort: opts.effort as EffortLevel | undefined,
        permissionMode,
      });
      return;
    }

    // Interactive mode
    if (prompt) {
      await runOneShot(prompt, {
        model: opts.model,
        effort: opts.effort as EffortLevel | undefined,
        permissionMode,
      });
    } else {
      await runRepl({
        continueSession: opts.continue,
        resumeId: opts.resume,
        model: opts.model,
        effort: opts.effort as EffortLevel | undefined,
        permissionMode,
      });
    }
  });

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

    // Copy bundled skills (including scripts/ subdirs)
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

    // Create BOBO.md template if not exists
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

    // Check BOBO.md
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

// ─── Watch command (file watcher / daemon mode) ─────────────

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

// ─── Run command (autonomous agent loop) ─────────────────────

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

// ─── Print mode (-p) ─────────────────────────────────────────

interface ModeOptions {
  model?: string;
  effort?: EffortLevel;
  permissionMode: PermissionMode;
}

async function runPrintMode(prompt: string, opts: ModeOptions): Promise<void> {
  // Read piped stdin if available
  let input = prompt;
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const piped = Buffer.concat(chunks).toString('utf-8');
    input = piped + (prompt ? `\n\n${prompt}` : '');
  }

  if (!input.trim()) {
    printError('No input provided. Usage: bobo -p "query" or cat file | bobo -p "explain"');
    process.exit(1);
  }

  try {
    await runAgent(input, [], {
      quiet: false,
      model: opts.model,
      effort: opts.effort,
      permissionMode: opts.permissionMode,
    });
  } catch (e) {
    if ((e as Error).message !== 'Aborted') {
      printError((e as Error).message);
      process.exit(1);
    }
  }
}

// ─── One-shot mode ───────────────────────────────────────────

async function runOneShot(prompt: string, opts: ModeOptions): Promise<void> {
  try {
    await runAgent(prompt, [], {
      model: opts.model,
      effort: opts.effort,
      permissionMode: opts.permissionMode,
    });
  } catch (e) {
    if ((e as Error).message !== 'Aborted') {
      printError((e as Error).message);
      process.exit(1);
    }
  }
}

// ─── REPL mode ───────────────────────────────────────────────

interface ReplOptions extends ModeOptions {
  continueSession?: boolean;
  resumeId?: string;
}

async function runRepl(opts: ReplOptions): Promise<void> {
  const config = loadConfig();
  const skills = listSkills();
  const knowledgeFiles = listKnowledgeFiles();
  const sessionStartTime = Date.now();
  const matchedSkills: string[] = [];

  // Initialize MCP servers in background
  initMcpServers().catch(() => { /* MCP init failures are non-fatal */ });

  // Runtime overrides
  let currentModel = opts.model || config.model;
  let currentEffort: EffortLevel = opts.effort || config.effort;
  let currentPermissionMode: PermissionMode = opts.permissionMode || config.permissionMode;
  let sessionName = '';

  printWelcome({
    version,
    model: currentModel,
    toolCount: toolDefinitions.length,
    skillsActive: skills.filter(s => s.enabled).length,
    skillsTotal: skills.length,
    knowledgeCount: knowledgeFiles.length,
    cwd: process.cwd(),
  });

  // Check BOBO.md
  const boboMdExists = existsSync(join(process.cwd(), 'BOBO.md'));
  if (boboMdExists) {
    printLine(chalk.dim('  📋 BOBO.md loaded'));
  }

  if (!config.apiKey) {
    printWarning('API key not configured. Run: bobo config set apiKey <your-key>');
    printLine();
  }

  // Restore session
  let history: ChatCompletionMessageParam[] = [];

  if (opts.continueSession) {
    // -c flag: continue most recent session
    const recent = getRecentSession(86400000); // 24 hours
    if (recent && recent.messages.length > 0) {
      history = recent.messages;
      printSuccess(`Continuing session (${history.length} messages, "${recent.firstUserMessage.slice(0, 40)}...")`);
    } else {
      printWarning('No recent session found.');
    }
  } else if (opts.resumeId) {
    // -r flag: resume specific session
    const session = loadSession(opts.resumeId);
    if (session) {
      history = session.messages;
      printSuccess(`Resumed session ${opts.resumeId} (${history.length} messages)`);
    } else {
      printWarning(`Session not found: ${opts.resumeId}`);
    }
  } else {
    // Auto-resume prompt
    const recentSession = getRecentSession(3600000);
    if (recentSession && recentSession.messages.length > 0) {
      printLine(chalk.yellow(`💾 Found recent session (${recentSession.messageCount} messages, ${recentSession.firstUserMessage.slice(0, 50)}...)`));
      printLine(chalk.dim('   Resume? (y/n)'));

      const answer = await new Promise<string>((resolve) => {
        const tmpRl = createInterface({ input: process.stdin, output: process.stdout });
        tmpRl.question(chalk.green('> '), (ans) => {
          tmpRl.close();
          resolve(ans.trim().toLowerCase());
        });
      });

      if (answer === 'y' || answer === 'yes') {
        history = recentSession.messages;
        printSuccess(`Resumed session (${history.length} messages)`);
      }
    }
  }

  // Enable status bar
  if (process.stdout.isTTY) {
    setupResizeHandler();
    enableStatusBar({
      model: currentModel,
      thinkingLevel: currentEffort,
      skillsCount: skills.filter(s => s.enabled).length,
      cwd: process.cwd(),
    });
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('> '),
    completer: slashCompleter,
  });

  let abortController: AbortController | null = null;
  let lastResponse = '';
  let autoCompactTriggered = false;

  // Wrapper that renders status bar before prompt
  const showPrompt = () => {
    const bar = renderStatusBar();
    if (bar) printLine(bar);
    rl.prompt();
  };

  const autoSave = () => {
    if (history.length > 0) {
      const id = saveSession(history, process.cwd());
      printLine(chalk.dim(`\n💾 Session saved: ${id}`));
    }
  };

  rl.on('SIGINT', () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
      printLine(chalk.dim('\n(cancelled)'));
      showPrompt();
    } else {
      printLine(chalk.dim('\n(press Ctrl+C again or Ctrl+D to exit)'));
      showPrompt();
    }
  });

  rl.on('close', () => {
    autoSave();
    runHooks('session-end');
    shutdownMcpServers();
    killAllProcesses();
    disableStatusBar();
    printLine(chalk.dim('\nGoodbye! 🐕'));
    process.exit(0);
  });

  showPrompt();

  for await (const line of rl) {
    const input = line.trim();

    if (!input) {
      showPrompt();
      continue;
    }

    // ─── Exit ───
    if (input === '/quit' || input === '/exit') {
      autoSave();
      runHooks('session-end');
      shutdownMcpServers();
      killAllProcesses();
      disableStatusBar();
      printLine(chalk.dim('Goodbye! 🐕'));
      process.exit(0);
    }

    // ─── /new, /clear ───
    if (input === '/clear' || input === '/new') {
      history = [];
      matchedSkills.length = 0;
      lastResponse = '';
      autoCompactTriggered = false;
      resetPlan();
      printSuccess('Conversation cleared');
      showPrompt();
      continue;
    }

    // ─── /model [name] ───
    if (input.startsWith('/model')) {
      const newModel = input.replace('/model', '').trim();
      if (!newModel) {
        printLine(chalk.cyan('Current model: ') + currentModel);
        printLine(chalk.dim('Usage: /model <model-name>'));
        printLine(chalk.dim('  Examples: claude-sonnet-4-20250514, gpt-4o, deepseek-chat'));
      } else {
        currentModel = newModel;
        updateStatusBar({ model: currentModel });
        printSuccess(`Model switched to: ${currentModel}`);
      }
      showPrompt();
      continue;
    }

    // ─── /effort [level] ───
    if (input.startsWith('/effort')) {
      const level = input.replace('/effort', '').trim().toLowerCase();
      if (!level) {
        printLine(chalk.cyan('Current effort: ') + currentEffort);
        printLine(chalk.dim('  /effort low    — Quick, concise answers'));
        printLine(chalk.dim('  /effort medium — Balanced (default)'));
        printLine(chalk.dim('  /effort high   — Deep analysis, thorough'));
      } else if (['low', 'medium', 'high'].includes(level)) {
        currentEffort = level as EffortLevel;
        updateStatusBar({ thinkingLevel: currentEffort });
        printSuccess(`Effort level: ${currentEffort}`);
      } else {
        printError('Invalid effort level. Use: low, medium, high');
      }
      showPrompt();
      continue;
    }

    // ─── /copy [n] ───
    if (input.startsWith('/copy')) {
      const indexStr = input.replace('/copy', '').trim();
      let textToCopy = lastResponse;

      if (indexStr) {
        const idx = parseInt(indexStr, 10);
        const assistantMsgs = history.filter(m => m.role === 'assistant' && typeof m.content === 'string');
        if (idx > 0 && idx <= assistantMsgs.length) {
          textToCopy = (assistantMsgs[assistantMsgs.length - idx] as { content: string }).content;
        }
      }

      if (!textToCopy) {
        printWarning('Nothing to copy.');
      } else {
        // Try platform clipboard
        try {
          const clipCmd = process.platform === 'darwin' ? 'pbcopy'
            : process.platform === 'win32' ? 'clip'
            : 'xclip -selection clipboard';
          execSync(clipCmd, { input: textToCopy, timeout: 3000 });
          printSuccess('Copied to clipboard!');
        } catch {
          // Fallback: write to file
          const copyPath = join(getConfigDir(), 'last-copy.txt');
          writeFileSync(copyPath, textToCopy);
          printWarning(`Clipboard unavailable. Saved to ${copyPath}`);
        }
      }
      showPrompt();
      continue;
    }

    // ─── /context ───
    if (input === '/context') {
      const msgCount = history.length;
      let totalChars = 0;
      let toolResultChars = 0;
      const roleCounts: Record<string, number> = {};

      for (const msg of history) {
        const content = typeof msg.content === 'string' ? msg.content : '';
        totalChars += content.length;
        roleCounts[msg.role] = (roleCounts[msg.role] || 0) + 1;
        if (msg.role === 'tool') toolResultChars += content.length;
      }

      const estTokens = Math.ceil(totalChars / 3.5);
      const maxContext = 200000; // approximate
      const usage = (estTokens / maxContext * 100).toFixed(1);

      printLine(chalk.cyan.bold('\n📊 Context Analysis\n'));
      printLine(`  Messages:     ${msgCount}`);
      printLine(`  Est. Tokens:  ~${estTokens.toLocaleString()} / ${maxContext.toLocaleString()} (${usage}%)`);
      printLine('');
      for (const [role, count] of Object.entries(roleCounts)) {
        printLine(`  ${role.padEnd(12)} ${count} messages`);
      }

      if (toolResultChars > totalChars * 0.6) {
        printLine(chalk.yellow('\n  ⚠ Tool results are >60% of context. Consider /compact to free space.'));
      }
      if (estTokens > maxContext * 0.75) {
        printLine(chalk.red('\n  🔴 Context usage >75%. Run /compact soon!'));
      } else if (estTokens > maxContext * 0.5) {
        printLine(chalk.yellow('\n  🟡 Context usage >50%. Keep an eye on it.'));
      } else {
        printLine(chalk.green('\n  🟢 Context usage healthy.'));
      }
      printLine();
      showPrompt();
      continue;
    }

    // ─── /rename <name> ───
    if (input.startsWith('/rename')) {
      const name = input.replace('/rename', '').trim();
      if (!name) {
        printLine(chalk.dim(`Current name: ${sessionName || '(unnamed)'}`));
        printLine(chalk.dim('Usage: /rename <name>'));
      } else {
        sessionName = name;
        printSuccess(`Session renamed: ${sessionName}`);
      }
      showPrompt();
      continue;
    }

    if (input === '/history') {
      printLine(`Turns: ${history.filter(m => m.role === 'user').length}`);
      showPrompt();
      continue;
    }

    // ─── /resume ───
    if (input === '/resume') {
      const sessions = listSessions(10);
      if (sessions.length === 0) {
        printWarning('No saved sessions.');
        showPrompt();
        continue;
      }
      printLine(chalk.cyan.bold('\n💾 Recent Sessions:\n'));
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        const date = s.startedAt ? new Date(s.startedAt).toLocaleString() : 'unknown';
        printLine(`  ${chalk.bold(String(i + 1).padStart(2))} ${chalk.dim(date)} — ${s.firstUserMessage.slice(0, 50)} (${s.messageCount} msgs)`);
      }
      printLine(chalk.dim('\n  Enter number to restore, or press Enter to cancel:'));

      const pick = await new Promise<string>((resolve) => {
        const tmpRl = createInterface({ input: process.stdin, output: process.stdout });
        tmpRl.question(chalk.green('> '), (ans) => {
          tmpRl.close();
          resolve(ans.trim());
        });
      });

      const idx = parseInt(pick, 10) - 1;
      if (idx >= 0 && idx < sessions.length) {
        const session = loadSession(sessions[idx].id);
        if (session) {
          history = session.messages;
          printSuccess(`Restored session (${history.length} messages)`);
        } else {
          printError('Failed to load session.');
        }
      }
      showPrompt();
      continue;
    }

    // ─── /insight ───
    if (input === '/insight') {
      printLine(generateInsight(history, sessionStartTime, [...new Set(matchedSkills)]));
      showPrompt();
      continue;
    }

    // ─── /agents, /bg ───
    if (input === '/agents' || input === '/bg') {
      const agents = listSubAgents(10);
      if (agents.length === 0) {
        printLine(chalk.dim('No sub-agents. Use: /spawn <task>'));
      } else {
        printLine(chalk.cyan.bold('\n🤖 Sub-Agents:\n'));
        for (const a of agents) {
          const icon = a.status === 'completed' ? '✅' : a.status === 'failed' ? '❌' : '⏳';
          const task = a.task.slice(0, 60) + (a.task.length > 60 ? '...' : '');
          printLine(`  ${icon} ${chalk.bold(a.id)} — ${task} ${chalk.dim(`[${a.status}]`)}`);
        }
      }
      printLine();
      showPrompt();
      continue;
    }

    if (input.startsWith('/agents show ')) {
      const id = input.replace('/agents show ', '').trim();
      const agent = getSubAgent(id);
      if (!agent) {
        printError(`Sub-agent not found: ${id}`);
      } else {
        printLine(chalk.cyan.bold(`\n🤖 ${agent.id} [${agent.status}]`));
        printLine(chalk.dim(`Task: ${agent.task}`));
        if (agent.result) printLine(`\n${agent.result}`);
        if (agent.error) printLine(chalk.red(`Error: ${agent.error}`));
      }
      printLine();
      showPrompt();
      continue;
    }

    if (input.startsWith('/spawn ')) {
      const task = input.replace('/spawn ', '').trim();
      if (!task) {
        printWarning('Usage: /spawn <task description>');
      } else {
        const result = spawnSubAgent(task);
        if (result.error) {
          printError(result.error);
        } else {
          printSuccess(`Sub-agent ${result.id} spawned! Check with /agents`);
        }
      }
      showPrompt();
      continue;
    }

    // ─── /compact ───
    if (input === '/compact') {
      const userCount = history.filter(m => m.role === 'user').length;
      if (userCount > 4) {
        printLine(chalk.dim('Compacting context...'));
        abortController = new AbortController();
        try {
          const compactResult = await runAgent(
            'Perform a nine-section context compression. Analyze the conversation so far and produce a structured summary covering: ' +
            '1. Main requests/intent 2. Key technical concepts 3. Files and code 4. Errors and fixes 5. Problem resolution ' +
            '6. All user messages 7. Pending tasks 8. Current work state 9. Next steps (with citations). ' +
            'Output the summary directly, do not call any tools.',
            history,
            { signal: abortController.signal, model: currentModel, effort: currentEffort },
          );
          history = [
            { role: 'user', content: 'Below is a compressed summary of our prior conversation. Continue from here.' },
            { role: 'assistant', content: compactResult.response },
          ];
          autoCompactTriggered = false;
          printSuccess('Context compacted (nine-section summary)');
        } catch (e) {
          if ((e as Error).message !== 'Aborted') {
            history = history.slice(-8);
            printSuccess('Context compacted (truncated)');
          }
        }
        abortController = null;
      } else {
        printWarning('Conversation too short to compact');
      }
      showPrompt();
      continue;
    }

    // ─── /dream ───
    if (input === '/dream') {
      abortController = new AbortController();
      try {
        const result = await runAgent(
          'Perform memory consolidation: scan recent memories and conversations, extract recurring patterns and promote to long-term memory, merge redundant entries, clean up completed tasks. Use search_memory and save_memory tools. Report what you consolidated.',
          history,
          { signal: abortController.signal, model: currentModel },
        );
        history = result.history;
      } catch (e) {
        if ((e as Error).message !== 'Aborted') printError((e as Error).message);
      }
      abortController = null;
      printLine();
      showPrompt();
      continue;
    }

    // ─── /status ───
    if (input === '/status') {
      const turns = history.filter(m => m.role === 'user').length;
      const mcpServers = getMcpStatus();
      const compactInfo = getCompactStatus(history);
      printLine(chalk.cyan('📊 Session Status:'));
      printLine(`  Model:      ${currentModel}`);
      printLine(`  Effort:     ${currentEffort}`);
      printLine(`  Permission: ${currentPermissionMode}`);
      printLine(`  Turns:      ${turns}`);
      printLine(`  Messages:   ${history.length}`);
      printLine(`  Tokens:     ~${compactInfo.tokens.toLocaleString()} (${compactInfo.urgency})`);
      printLine(`  CWD:        ${process.cwd()}`);
      if (sessionName) printLine(`  Name:       ${sessionName}`);
      if (mcpServers.length > 0) {
        printLine(`  MCP:        ${mcpServers.filter(s => s.ready).length}/${mcpServers.length} servers (${mcpServers.reduce((a, s) => a + s.toolCount, 0)} tools)`);
      }
      showPrompt();
      continue;
    }

    if (input === '/plan') {
      printLine(getCurrentPlan());
      showPrompt();
      continue;
    }

    if (input === '/knowledge') {
      const files = listKnowledgeFiles();
      for (const f of files) {
        const icon = f.type === 'always' ? '🔵' : f.type === 'on-demand' ? '🟡' : '🟢';
        printLine(`  ${icon} ${f.file} (${f.type})`);
      }
      showPrompt();
      continue;
    }

    if (input === '/skills') {
      const sklls = listSkills();
      for (const s of sklls) {
        const icon = s.enabled ? '✅' : '❌';
        printLine(`  ${icon} ${s.name} — ${s.description}`);
      }
      showPrompt();
      continue;
    }

    // ─── /mcp ───
    if (input === '/mcp') {
      const mcpServers = getMcpStatus();
      if (mcpServers.length === 0) {
        printLine(chalk.dim('No MCP servers. Configure in ~/.bobo/mcp.json'));
        printLine(chalk.dim('Run: bobo mcp init'));
      } else {
        printLine(chalk.cyan.bold('\n🔌 MCP Servers:\n'));
        for (const s of mcpServers) {
          const icon = s.ready ? chalk.green('●') : chalk.red('●');
          printLine(`  ${icon} ${chalk.bold(s.name)} [${s.transport}] — ${s.toolCount} tools`);
        }
      }
      printLine();
      showPrompt();
      continue;
    }

    // ─── /bg (background processes) ───
    if (input === '/bg') {
      const { executeProcessTool } = await import('./tools/process-manager.js');
      printLine(executeProcessTool('bg_list', {}));
      showPrompt();
      continue;
    }

    // ─── /help ───
    if (input === '/help') {
      printLine(chalk.cyan.bold('Commands:'));
      printLine('');
      printLine(chalk.dim('  Session'));
      printLine('  /new         Start new conversation');
      printLine('  /clear       Clear conversation history');
      printLine('  /compact     Compress context (nine-section)');
      printLine('  /resume      Restore a previous session');
      printLine('  /rename <n>  Rename current session');
      printLine('  /quit        Exit');
      printLine('');
      printLine(chalk.dim('  Model & Effort'));
      printLine('  /model <n>   Switch model');
      printLine('  /effort <l>  Set thinking effort (low/medium/high)');
      printLine('');
      printLine(chalk.dim('  Analysis'));
      printLine('  /insight     Session analytics (tokens, tools, skills)');
      printLine('  /context     Context usage analysis');
      printLine('  /status      Session status');
      printLine('  /copy [n]    Copy last response to clipboard');
      printLine('  /plan        Show current task plan');
      printLine('');
      printLine(chalk.dim('  Sub-Agents'));
      printLine('  /spawn <t>   Run task in background sub-agent');
      printLine('  /agents      List sub-agents');
      printLine('  /agents show <id>  Show sub-agent result');
      printLine('');
      printLine(chalk.dim('  Knowledge & Integrations'));
      printLine('  /knowledge   List knowledge files');
      printLine('  /skills      List skills');
      printLine('  /mcp         MCP server status');
      printLine('  /bg          Background process list');
      printLine('  /dream       Memory consolidation');
      printLine('');
      printLine(chalk.dim('  CLI Commands'));
      printLine('  bobo -p "q"  Non-interactive (supports piping)');
      printLine('  bobo -c      Continue last conversation');
      printLine('  bobo -r <id> Resume specific session');
      printLine('  bobo --full-auto  Auto-approve tool calls');
      printLine('  bobo --yolo  No sandbox, no approvals');
      printLine('  bobo watch   File watcher (daemon mode)');
      printLine('  bobo mcp     MCP server management');
      printLine('  bobo hooks   Lifecycle hook management');
      printLine('  bobo doctor  Environment check');
      showPrompt();
      continue;
    }

    // ─── Run agent ───
    abortController = new AbortController();
    try {
      const result = await runAgent(input, history, {
        signal: abortController.signal,
        matchedSkills,
        model: currentModel,
        effort: currentEffort,
        permissionMode: currentPermissionMode,
        onAutoCompact: () => {
          if (!autoCompactTriggered) {
            autoCompactTriggered = true;
            printLine(chalk.yellow('\n⚠ Context is getting large. Consider running /compact to free space.\n'));
          }
        },
      });
      history = result.history;
      lastResponse = result.response;

      // Auto-compact check
      const compactInfo = getCompactStatus(history);
      if (compactInfo.urgency === 'critical') {
        printWarning(`Context at ${compactInfo.tokens} tokens — auto-compressing...`);
        history = compressHistory(history, 8);
        printSuccess(`Compressed to ${getCompactStatus(history).tokens} tokens`);
      } else if (compactInfo.urgency === 'high') {
        printWarning(`⚠ Context at ${compactInfo.tokens} tokens. Run /compact to compress.`);
      }
    } catch (e) {
      if ((e as Error).message !== 'Aborted') {
        printError((e as Error).message);
      }
    }
    abortController = null;

    printLine();
    showPrompt();
  }
}

program.parse();
