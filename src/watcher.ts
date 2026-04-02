/**
 * File watcher — monitor file changes and optionally auto-respond.
 * `bobo watch` starts daemon-like mode.
 *
 * Watches CWD for file changes and can:
 * - Auto-run hooks (post-edit)
 * - Log changes
 * - Auto-trigger agent when BOBO.md watch rules match
 */

import { watch, type FSWatcher } from 'node:fs';
import { join, relative } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import chalk from 'chalk';
import { runHooks } from './hooks.js';

interface WatchOptions {
  dir: string;
  recursive: boolean;
  ignore: string[];
  onFileChange?: (event: string, filename: string) => void;
}

let watcher: FSWatcher | null = null;

const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.bobo',
  '__pycache__',
  '.next',
  '.cache',
];

/**
 * Start watching a directory for file changes.
 */
export function startWatch(options: WatchOptions): void {
  if (watcher) {
    stopWatch();
  }

  const { dir, ignore, onFileChange } = options;
  const ignoreSet = new Set([...DEFAULT_IGNORE, ...ignore]);

  console.log(chalk.cyan.bold('\n👁 Bobo Watch Mode\n'));
  console.log(chalk.dim(`  Watching: ${dir}`));
  console.log(chalk.dim(`  Ignoring: ${[...ignoreSet].join(', ')}`));
  console.log(chalk.dim('  Press Ctrl+C to stop\n'));

  try {
    watcher = watch(dir, { recursive: true }, (event, filename) => {
      if (!filename) return;

      // Check ignore patterns
      const parts = filename.split(/[/\\]/);
      if (parts.some(p => ignoreSet.has(p))) return;

      const relPath = relative(dir, join(dir, filename));
      const timestamp = new Date().toLocaleTimeString();

      console.log(chalk.dim(`  [${timestamp}] ${event}: `) + chalk.white(relPath));

      // Run post-edit hooks
      runHooks('post-edit', { BOBO_FILE: relPath, BOBO_EVENT: event });

      // Call custom handler
      if (onFileChange) {
        onFileChange(event, relPath);
      }
    });

    watcher.on('error', (err) => {
      console.error(chalk.red(`Watch error: ${err.message}`));
    });
  } catch (err) {
    console.error(chalk.red(`Failed to start watcher: ${(err as Error).message}`));

    // Fallback: manual polling for systems without recursive watch
    console.log(chalk.yellow('Falling back to polling mode...'));
    startPollingWatch(options);
  }
}

/**
 * Fallback polling watcher for systems without fs.watch recursive support.
 */
function startPollingWatch(options: WatchOptions): void {
  const fileTimestamps = new Map<string, number>();

  function scanDir(dir: string): void {
    try {
      for (const entry of readdirSync(dir)) {
        if (DEFAULT_IGNORE.includes(entry)) continue;
        const full = join(dir, entry);
        try {
          const stat = statSync(full);
          if (stat.isDirectory()) {
            scanDir(full);
          } else {
            fileTimestamps.set(full, stat.mtimeMs);
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  // Initial scan
  scanDir(options.dir);

  const interval = setInterval(() => {
    const oldMap = new Map(fileTimestamps);
    fileTimestamps.clear();
    scanDir(options.dir);

    for (const [path, mtime] of fileTimestamps) {
      const oldMtime = oldMap.get(path);
      if (oldMtime === undefined) {
        const rel = relative(options.dir, path);
        console.log(chalk.dim(`  [${new Date().toLocaleTimeString()}] created: `) + chalk.white(rel));
        if (options.onFileChange) options.onFileChange('create', rel);
      } else if (oldMtime !== mtime) {
        const rel = relative(options.dir, path);
        console.log(chalk.dim(`  [${new Date().toLocaleTimeString()}] changed: `) + chalk.white(rel));
        runHooks('post-edit', { BOBO_FILE: rel, BOBO_EVENT: 'change' });
        if (options.onFileChange) options.onFileChange('change', rel);
      }
    }
  }, 2000);

  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(chalk.dim('\nWatch stopped.'));
    process.exit(0);
  });
}

/**
 * Stop the file watcher.
 */
export function stopWatch(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
