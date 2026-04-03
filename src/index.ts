#!/usr/bin/env node

import { Command, Option } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChatCompletionMessageParam } from 'openai/resources/index.js';
import { loadConfig, type EffortLevel, type PermissionMode } from './config.js';
import { runAgent } from './agent.js';
import { printError } from './ui.js';
import { registerCommands } from './cli.js';
import { startRepl } from './repl.js';

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
      await startRepl({
        continueSession: opts.continue,
        resumeId: opts.resume,
        model: opts.model,
        effort: opts.effort as EffortLevel | undefined,
        permissionMode,
        version,
      });
    }
  });

// Register all CLI subcommands
registerCommands(program);

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

program.parse();
