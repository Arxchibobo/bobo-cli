/**
 * Autonomous run mode — give a task, let Bobo run until done.
 * Like Claude Code's long-running agent loop.
 *
 * Features:
 * - Higher iteration limit (50 vs REPL's 20)
 * - Auto-recovery on errors (retry up to 3 times)
 * - Progress logging to file
 * - Graceful Ctrl+C handling (saves progress)
 */

import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatCompletionMessageParam } from 'openai/resources/index.js';
import { runAgent } from './agent.js';
import { getConfigDir, type EffortLevel, type PermissionMode } from './config.js';
import { printLine, printSuccess, printError, printWarning } from './ui.js';
import { Spinner } from './spinner.js';

export interface RunOptions {
  task: string;
  model?: string;
  effort?: EffortLevel;
  permissionMode?: PermissionMode;
  maxIterations?: number;
  logFile?: string;
}

export async function runAutonomous(options: RunOptions): Promise<void> {
  const {
    task,
    model,
    effort,
    permissionMode = 'auto', // Auto-approve by default in run mode
    maxIterations = 5,
    logFile,
  } = options;

  const startTime = Date.now();
  const logDir = join(getConfigDir(), 'runs');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = logFile || join(logDir, `${runId}.md`);

  printLine(chalk.cyan.bold('\n🚀 Bobo Run Mode — Autonomous Execution\n'));
  printLine(chalk.dim(`  Task: ${task.slice(0, 100)}${task.length > 100 ? '...' : ''}`));
  printLine(chalk.dim(`  Model: ${model || 'default'}`));
  printLine(chalk.dim(`  Effort: ${effort || 'medium'}`));
  printLine(chalk.dim(`  Max iterations: ${maxIterations}`));
  printLine(chalk.dim(`  Log: ${logPath}`));
  printLine(chalk.dim(`  Permission: ${permissionMode} (auto-approve)`));
  printLine(chalk.dim('  Press Ctrl+C to abort (saves progress)\n'));
  printLine(chalk.dim('─'.repeat(60)));
  printLine();

  const log: string[] = [];
  log.push(`# Bobo Run: ${runId}`);
  log.push(`Task: ${task}`);
  log.push(`Started: ${new Date().toISOString()}`);
  log.push(`Model: ${model || 'default'}`);
  log.push('');

  let history: ChatCompletionMessageParam[] = [];
  let aborted = false;
  let iteration = 0;
  let retries = 0;
  const maxRetries = 3;

  // Handle Ctrl+C gracefully
  const abortHandler = () => {
    if (aborted) {
      printLine(chalk.red('\nForce quit.'));
      process.exit(1);
    }
    aborted = true;
    printLine(chalk.yellow('\n⚠ Aborting... saving progress.'));
  };
  process.on('SIGINT', abortHandler);

  // Build the autonomous prompt
  const autonomousTask = `You are in AUTONOMOUS mode. Complete the following task end-to-end without asking questions.
Make decisions yourself. If something fails, try a different approach.
Use tools to read files, write code, run tests, and verify your work.
When the task is fully complete, say "TASK COMPLETE" and summarize what you did.

TASK: ${task}`;

  const spinner = new Spinner();

  for (iteration = 0; iteration < maxIterations && !aborted; iteration++) {
    const iterMsg = iteration === 0 ? autonomousTask : 'Continue working on the task. If done, say "TASK COMPLETE".';

    printLine(chalk.cyan(`\n── Iteration ${iteration + 1}/${maxIterations} ──\n`));
    log.push(`\n## Iteration ${iteration + 1}`);

    try {
      const result = await runAgent(iterMsg, history, {
        model,
        effort: effort || 'high', // Default to high effort in autonomous mode
        permissionMode,
      });

      history = result.history;
      log.push(result.response.slice(0, 2000));

      // Check if task is complete
      if (result.response.includes('TASK COMPLETE')) {
        printLine(chalk.green('\n✅ Task completed!'));
        log.push('\n## Result: COMPLETE');
        break;
      }

      retries = 0; // Reset retry counter on success
    } catch (e) {
      const errorMsg = (e as Error).message;
      log.push(`ERROR: ${errorMsg}`);

      if (errorMsg === 'Aborted') {
        break;
      }

      retries++;
      if (retries >= maxRetries) {
        printError(`Failed after ${maxRetries} retries. Last error: ${errorMsg}`);
        log.push(`\n## Result: FAILED (${maxRetries} retries exhausted)`);
        break;
      }

      printWarning(`Error (retry ${retries}/${maxRetries}): ${errorMsg}`);
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
      iteration--; // Don't count failed iterations
    }
  }

  // Save progress
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  log.push(`\nCompleted: ${new Date().toISOString()}`);
  log.push(`Duration: ${elapsed}s`);
  log.push(`Iterations: ${iteration + 1}`);

  writeFileSync(logPath, log.join('\n'));

  // Cleanup
  process.removeListener('SIGINT', abortHandler);

  printLine();
  printLine(chalk.dim('─'.repeat(60)));
  printLine();
  printLine(chalk.cyan('📊 Run Summary:'));
  printLine(`  Duration:    ${elapsed}s`);
  printLine(`  Iterations:  ${iteration + 1}/${maxIterations}`);
  printLine(`  Log:         ${logPath}`);
  printLine();
}
