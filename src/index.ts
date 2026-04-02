#!/usr/bin/env node

import { Command } from 'commander';
import { createInterface } from 'node:readline';
import { readFileSync, existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, statSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
    for (const dir of [memoryDir, learningsDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        printSuccess(`Created ${dir}`);
      }
    }

    initSkills();

    // Copy bundled skills to ~/.bobo/skills/
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

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('> '),
  });

  let history: ChatCompletionMessageParam[] = [];
  let abortController: AbortController | null = null;

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
      printLine(chalk.dim('Goodbye! 🐕'));
      process.exit(0);
    }

    if (input === '/clear') {
      history = [];
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
      printLine(chalk.cyan('Commands:'));
      printLine('  /clear     — Clear conversation history');
      printLine('  /compact   — Compress context (nine-section)');
      printLine('  /dream     — Memory consolidation');
      printLine('  /history   — Show turn count');
      printLine('  /status    — Session status');
      printLine('  /plan      — Show current task plan');
      printLine('  /knowledge — List knowledge files');
      printLine('  /skills    — List skills');
      printLine('  /quit      — Exit');
      printLine('  /help      — Show this help');
      rl.prompt();
      continue;
    }

    abortController = new AbortController();
    try {
      const result = await runAgent(input, history, { signal: abortController.signal });
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
