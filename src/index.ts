#!/usr/bin/env node

import { Command } from 'commander';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
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
import { printWelcome, printError, printSuccess, printLine, printWarning } from './ui.js';
import chalk from 'chalk';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';

// Get package version
const __dirname = fileURLToPath(new URL('.', import.meta.url));
let version = '0.1.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  version = pkg.version;
} catch { /* use default */ }

const program = new Command();

program
  .name('bobo')
  .description('🐕 大波比 — 便携式 AI 助手 CLI')
  .version(version)
  .argument('[prompt...]', '一次性执行的提示词')
  .action(async (promptParts: string[]) => {
    const prompt = promptParts.join(' ').trim();
    if (prompt) {
      await runOneShot(prompt);
    } else {
      await runRepl();
    }
  });

// Config subcommand
const configCmd = program.command('config').description('配置管理');

configCmd
  .command('set <key> <value>')
  .description('设置配置项')
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
  .description('获取配置项')
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
  .description('显示所有配置')
  .action(() => {
    const config = listConfig();
    for (const [k, v] of Object.entries(config)) {
      console.log(`${chalk.cyan(k)}: ${v}`);
    }
  });

// Init subcommand
program
  .command('init')
  .description('初始化 ~/.bobo/ 目录和知识库')
  .action(() => {
    ensureConfigDir();
    const config = loadConfig();
    const knowledgeDir = resolveKnowledgeDir(config);

    if (!existsSync(knowledgeDir)) {
      mkdirSync(knowledgeDir, { recursive: true });
    }

    // Copy bundled knowledge files if user doesn't have them
    const bundledDir = join(__dirname, '..', 'knowledge');
    for (const file of ['system.md', 'rules.md']) {
      const target = join(knowledgeDir, file);
      const source = join(bundledDir, file);
      if (!existsSync(target) && existsSync(source)) {
        copyFileSync(source, target);
        printSuccess(`Created ${target}`);
      }
    }

    printSuccess(`Initialized ${getConfigDir()}`);
    printLine(`知识库: ${knowledgeDir}`);
    printWarning('记得配置 API Key: bobo config set apiKey <your-key>');
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
  printWelcome();

  const config = loadConfig();
  if (!config.apiKey) {
    printWarning('API Key 未配置。运行: bobo config set apiKey <your-key>');
    printLine();
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('你> '),
  });

  let history: ChatCompletionMessageParam[] = [];
  let abortController: AbortController | null = null;

  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
      printLine(chalk.dim('\n(已取消)'));
      rl.prompt();
    } else {
      printLine(chalk.dim('\n(再按一次 Ctrl+C 或 Ctrl+D 退出)'));
      rl.prompt();
    }
  });

  rl.on('close', () => {
    printLine(chalk.cyan('\n再见！汪汪~ 🐕'));
    process.exit(0);
  });

  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      continue;
    }

    // Built-in commands
    if (input === '/quit' || input === '/exit') {
      printLine(chalk.cyan('再见！汪汪~ 🐕'));
      process.exit(0);
    }

    if (input === '/clear') {
      history = [];
      printSuccess('对话历史已清空');
      rl.prompt();
      continue;
    }

    if (input === '/history') {
      printLine(`对话轮数: ${Math.floor(history.length / 2)}`);
      rl.prompt();
      continue;
    }

    if (input === '/help') {
      printLine(chalk.cyan('内置命令:'));
      printLine('  /clear   — 清空对话历史');
      printLine('  /history — 查看对话轮数');
      printLine('  /quit    — 退出');
      printLine('  /help    — 显示帮助');
      rl.prompt();
      continue;
    }

    // Run agent
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
