#!/usr/bin/env node

import { Command } from 'commander';
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
  .action(async (promptParts: string[]) => {
    const prompt = promptParts.join(' ').trim();
    if (prompt) {
      await runOneShot(prompt);
    } else {
      await runRepl();
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

    // Copy bundled skills to ~/.bobo/skills/ (including scripts/ subdirs)
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
          // Use cpSync recursive — copies everything including scripts/
          cpSync(src, dest, { recursive: true });
          installed++;
        }
      }
      if (installed > 0) {
        // All skills enabled by default — passive triggering based on context
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

    // Check API key
    const config = loadConfig();
    if (config.apiKey) {
      printLine(`  ${chalk.green('✓')} ${'API Key'.padEnd(12)} ${chalk.dim('configured')}`);
    } else {
      printLine(`  ${chalk.red('✗')} ${'API Key'.padEnd(12)} ${chalk.red('not set — run: bobo config set apiKey <key>')}`);
      allGood = false;
    }

    // Check skills directory
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

// ─── Spawn subcommand (sub-agent) ────────────────────────────

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

// Default agents action: list
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

skillCmd
  .command('list')
  .description('List all skills')
  .action(() => {
    const skills = listSkills();
    console.log(chalk.cyan.bold('\n🧩 Skills:\n'));
    for (const s of skills) {
      const icon = s.enabled ? '✅' : '❌';
      const typeTag = s.type === 'builtin' ? chalk.dim('builtin') : chalk.green('custom');
      console.log(`  ${icon} ${chalk.bold(s.name)} [${typeTag}] — ${s.description}`);
    }
    console.log();
  });

skillCmd
  .command('enable <name>')
  .description('Enable a skill')
  .action((name: string) => {
    const result = setSkillEnabled(name, true);
    console.log(result);
  });

skillCmd
  .command('disable <name>')
  .description('Disable a skill')
  .action((name: string) => {
    const result = setSkillEnabled(name, false);
    console.log(result);
  });

skillCmd
  .command('import <path>')
  .description('Batch import skills from an OpenClaw skills directory')
  .action((path: string) => {
    const resolved = path.startsWith('~')
      ? join(process.env.HOME || '', path.slice(1))
      : path;
    const result = importSkills(resolved);
    console.log(result);
  });

// ─── Structured knowledge commands ──────────────────────────

registerKnowledgeCommand(program);
registerRulesCommand(program);
registerStructuredSkillsCommand(program);
registerStructuredTemplateCommand(program);

// ─── Project subcommand ──────────────────────────────────────

const projectCmd = program.command('project').description('Manage project configuration');

projectCmd
  .command('init')
  .description('Initialize .bobo/ project config in current directory')
  .action(() => {
    const result = initProject();
    printSuccess(result);
  });

// ─── One-shot mode ───────────────────────────────────────────

async function runOneShot(prompt: string): Promise<void> {
  try {
    await runAgent(prompt, []);
  } catch (e) {
    if ((e as Error).message !== 'Aborted') {
      printError((e as Error).message);
      process.exit(1);
    }
  }
}

// ─── REPL mode ───────────────────────────────────────────────

async function runRepl(): Promise<void> {
  const config = loadConfig();
  const skills = listSkills();
  const knowledgeFiles = listKnowledgeFiles();
  const sessionStartTime = Date.now();
  const matchedSkills: string[] = [];

  printWelcome({
    version,
    model: config.model,
    toolCount: toolDefinitions.length,
    skillsActive: skills.filter(s => s.enabled).length,
    skillsTotal: skills.length,
    knowledgeCount: knowledgeFiles.length,
    cwd: process.cwd(),
  });

  if (!config.apiKey) {
    printWarning('API key not configured. Run: bobo config set apiKey <your-key>');
    printLine();
  }

  // Check for resumable session
  let history: ChatCompletionMessageParam[] = [];
  const recentSession = getRecentSession(3600000); // 1 hour
  if (recentSession && recentSession.messages.length > 0) {
    printLine(chalk.yellow(`💾 Found recent session (${recentSession.messageCount} messages, ${recentSession.firstUserMessage.slice(0, 50)}...)`));
    printLine(chalk.dim('   Resume? (y/n)'));

    // Quick y/n prompt
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

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('> '),
  });

  let abortController: AbortController | null = null;

  // Auto-save on exit
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
      rl.prompt();
    } else {
      printLine(chalk.dim('\n(press Ctrl+C again or Ctrl+D to exit)'));
      rl.prompt();
    }
  });

  rl.on('close', () => {
    autoSave();
    printLine(chalk.dim('\nGoodbye! 🐕'));
    process.exit(0);
  });

  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      continue;
    }

    if (input === '/quit' || input === '/exit') {
      autoSave();
      printLine(chalk.dim('Goodbye! 🐕'));
      process.exit(0);
    }

    if (input === '/clear' || input === '/new') {
      history = [];
      matchedSkills.length = 0;
      resetPlan();
      printSuccess('Conversation cleared');
      rl.prompt();
      continue;
    }

    if (input === '/history') {
      printLine(`Turns: ${history.filter(m => m.role === 'user').length}`);
      rl.prompt();
      continue;
    }

    // ─── /resume ───
    if (input === '/resume') {
      const sessions = listSessions(10);
      if (sessions.length === 0) {
        printWarning('No saved sessions.');
        rl.prompt();
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
      rl.prompt();
      continue;
    }

    // ─── /insight ───
    if (input === '/insight') {
      printLine(generateInsight(history, sessionStartTime, [...new Set(matchedSkills)]));
      rl.prompt();
      continue;
    }

    // ─── /agents or /bg ───
    if (input === '/agents' || input === '/bg') {
      const agents = listSubAgents(10);
      if (agents.length === 0) {
        printLine(chalk.dim('No sub-agents. Use: bobo spawn "task" or type: /spawn <task>'));
      } else {
        printLine(chalk.cyan.bold('\n🤖 Sub-Agents:\n'));
        for (const a of agents) {
          const icon = a.status === 'completed' ? '✅' : a.status === 'failed' ? '❌' : '⏳';
          const task = a.task.slice(0, 60) + (a.task.length > 60 ? '...' : '');
          printLine(`  ${icon} ${chalk.bold(a.id)} — ${task} ${chalk.dim(`[${a.status}]`)}`);
        }
      }
      printLine();
      rl.prompt();
      continue;
    }

    // ─── /agents show <id> ───
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
      rl.prompt();
      continue;
    }

    // ─── /spawn <task> ───
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
      rl.prompt();
      continue;
    }

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
            { signal: abortController.signal },
          );
          history = [
            { role: 'user', content: 'Below is a compressed summary of our prior conversation. Continue from here.' },
            { role: 'assistant', content: compactResult.response },
          ];
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
      rl.prompt();
      continue;
    }

    if (input === '/dream') {
      abortController = new AbortController();
      try {
        const result = await runAgent(
          'Perform memory consolidation: scan recent memories and conversations, extract recurring patterns and promote to long-term memory, merge redundant entries, clean up completed tasks. Use search_memory and save_memory tools. Report what you consolidated.',
          history,
          { signal: abortController.signal },
        );
        history = result.history;
      } catch (e) {
        if ((e as Error).message !== 'Aborted') printError((e as Error).message);
      }
      abortController = null;
      printLine();
      rl.prompt();
      continue;
    }

    if (input === '/status') {
      const cfg = loadConfig();
      const turns = history.filter(m => m.role === 'user').length;
      printLine(chalk.cyan('📊 Session Status:'));
      printLine(`  Model:    ${cfg.model}`);
      printLine(`  Turns:    ${turns}`);
      printLine(`  Messages: ${history.length}`);
      printLine(`  CWD:      ${process.cwd()}`);
      rl.prompt();
      continue;
    }

    if (input === '/plan') {
      printLine(getCurrentPlan());
      rl.prompt();
      continue;
    }

    if (input === '/knowledge') {
      const files = listKnowledgeFiles();
      for (const f of files) {
        const icon = f.type === 'always' ? '🔵' : f.type === 'on-demand' ? '🟡' : '🟢';
        printLine(`  ${icon} ${f.file} (${f.type})`);
      }
      rl.prompt();
      continue;
    }

    if (input === '/skills') {
      const sklls = listSkills();
      for (const s of sklls) {
        const icon = s.enabled ? '✅' : '❌';
        printLine(`  ${icon} ${s.name} — ${s.description}`);
      }
      rl.prompt();
      continue;
    }

    if (input === '/help') {
      printLine(chalk.cyan.bold('Commands:'));
      printLine('');
      printLine(chalk.dim('  Session'));
      printLine('  /new       — Start new conversation');
      printLine('  /clear     — Clear conversation history');
      printLine('  /compact   — Compress context (nine-section)');
      printLine('  /resume    — Restore a previous session');
      printLine('  /quit      — Exit');
      printLine('');
      printLine(chalk.dim('  Analysis'));
      printLine('  /insight   — Session analytics (tokens, tools, skills)');
      printLine('  /status    — Session status');
      printLine('  /plan      — Show current task plan');
      printLine('');
      printLine(chalk.dim('  Sub-Agents'));
      printLine('  /spawn <task> — Run a task in background sub-agent');
      printLine('  /agents       — List sub-agents');
      printLine('  /agents show <id> — Show sub-agent result');
      printLine('');
      printLine(chalk.dim('  Knowledge'));
      printLine('  /knowledge — List knowledge files');
      printLine('  /skills    — List skills');
      printLine('  /dream     — Memory consolidation');
      printLine('  /help      — Show this help');
      rl.prompt();
      continue;
    }

    abortController = new AbortController();
    try {
      const result = await runAgent(input, history, {
        signal: abortController.signal,
        matchedSkills,
      });
      history = result.history;
    } catch (e) {
      if ((e as Error).message !== 'Aborted') {
        printError((e as Error).message);
      }
    }
    abortController = null;

    printLine();
    rl.prompt();
  }
}

program.parse();
