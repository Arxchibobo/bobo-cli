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
import { listKnowledgeFiles } from './knowledge.js';
import { printWelcome, printError, printSuccess, printLine, printWarning } from './ui.js';
import chalk from 'chalk';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
let version = '0.1.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  version = pkg.version;
} catch { /* use default */ }

const program = new Command();

program
  .name('bobo')
  .description('🐕 大波比 — 便携式 AI 工程助手 CLI')
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

// ─── Config subcommand ───────────────────────────────────────

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

// ─── Init subcommand ─────────────────────────────────────────

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

    // Copy all bundled knowledge files
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

    // Create memory directories
    const memoryDir = join(getConfigDir(), 'memory');
    const learningsDir = join(getConfigDir(), '.learnings');
    for (const dir of [memoryDir, learningsDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        printSuccess(`Created ${dir}`);
      }
    }

    printSuccess(`Initialized ${getConfigDir()}`);
    printLine(`知识库: ${knowledgeDir}`);
    printWarning('记得配置 API Key: bobo config set apiKey <your-key>');
  });

// ─── Knowledge subcommand ────────────────────────────────────

program
  .command('knowledge')
  .description('查看知识库信息')
  .action(() => {
    const files = listKnowledgeFiles();
    console.log(chalk.cyan.bold('\n📚 知识库文件:\n'));
    for (const f of files) {
      const typeIcon = f.type === 'always' ? '🔵' : f.type === 'on-demand' ? '🟡' : '🟢';
      const sourceTag = f.source === 'user' ? chalk.green('user') : chalk.dim('bundled');
      console.log(`  ${typeIcon} ${f.file} [${sourceTag}] (${f.type})`);
    }
    console.log(chalk.dim('\n  🔵 always-load  🟡 on-demand  🟢 custom\n'));
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
      const turns = history.filter(m => m.role === 'user').length;
      printLine(`对话轮数: ${turns}`);
      rl.prompt();
      continue;
    }

    if (input === '/compact') {
      // Keep only last 4 user-assistant pairs
      const userMsgs = history.filter(m => m.role === 'user');
      if (userMsgs.length > 4) {
        const lastN = history.slice(-8);
        history = lastN;
        printSuccess(`上下文已压缩: 保留最近 ${Math.min(4, userMsgs.length)} 轮对话`);
      } else {
        printWarning('对话很短，无需压缩');
      }
      rl.prompt();
      continue;
    }

    if (input === '/status') {
      const config = loadConfig();
      printLine(chalk.cyan('📊 Session Status:'));
      printLine(`  Model: ${config.model}`);
      printLine(`  Turns: ${history.filter(m => m.role === 'user').length}`);
      printLine(`  Messages: ${history.length}`);
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

    if (input === '/help') {
      printLine(chalk.cyan('内置命令:'));
      printLine('  /clear     — 清空对话历史');
      printLine('  /compact   — 压缩上下文（保留最近对话）');
      printLine('  /history   — 查看对话轮数');
      printLine('  /status    — 查看会话状态');
      printLine('  /knowledge — 查看加载的知识库');
      printLine('  /quit      — 退出');
      printLine('  /help      — 显示帮助');
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
