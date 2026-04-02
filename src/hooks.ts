/**
 * Hook system — run shell commands before/after agent actions.
 * Config in BOBO.md frontmatter or ~/.bobo/hooks.json
 *
 * Hooks:
 *   pre-edit    — before file edit (write_file, edit_file)
 *   post-edit   — after file edit
 *   pre-shell   — before shell command
 *   post-shell  — after shell command
 *   pre-commit  — before git commit (triggered by git_commit tool)
 *   post-commit — after git commit
 *   session-end — when REPL exits
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config.js';

export type HookEvent =
  | 'pre-edit'
  | 'post-edit'
  | 'pre-shell'
  | 'post-shell'
  | 'pre-commit'
  | 'post-commit'
  | 'session-end';

interface HookConfig {
  [event: string]: string[]; // event -> list of shell commands
}

let cachedHooks: HookConfig | null = null;

/**
 * Load hooks from ~/.bobo/hooks.json or project .bobo/hooks.json
 */
export function loadHooks(): HookConfig {
  if (cachedHooks) return cachedHooks;

  const sources = [
    join(getConfigDir(), 'hooks.json'),
    join(process.cwd(), '.bobo', 'hooks.json'),
  ];

  const merged: HookConfig = {};

  for (const source of sources) {
    if (existsSync(source)) {
      try {
        const raw = JSON.parse(readFileSync(source, 'utf-8'));
        for (const [event, cmds] of Object.entries(raw)) {
          if (Array.isArray(cmds)) {
            merged[event] = [...(merged[event] || []), ...(cmds as string[])];
          } else if (typeof cmds === 'string') {
            merged[event] = [...(merged[event] || []), cmds];
          }
        }
      } catch { /* skip malformed */ }
    }
  }

  cachedHooks = merged;
  return merged;
}

/**
 * Run hooks for a given event. Returns true if all hooks succeeded.
 * Context vars are passed as environment variables.
 */
export function runHooks(
  event: HookEvent,
  context?: Record<string, string>,
): boolean {
  const hooks = loadHooks();
  const cmds = hooks[event];
  if (!cmds || cmds.length === 0) return true;

  const env = { ...process.env, ...context, BOBO_HOOK_EVENT: event };

  let allOk = true;
  for (const cmd of cmds) {
    try {
      execSync(cmd, {
        env,
        timeout: 30000,
        stdio: 'pipe',
        cwd: process.cwd(),
      });
    } catch {
      allOk = false;
    }
  }
  return allOk;
}

/**
 * Clear cached hooks (e.g. when changing directory).
 */
export function clearHookCache(): void {
  cachedHooks = null;
}

/**
 * Initialize default hooks.json template.
 */
export function initHooksTemplate(): string {
  return JSON.stringify({
    'pre-edit': [],
    'post-edit': [],
    'pre-shell': [],
    'post-shell': [],
    'pre-commit': [],
    'post-commit': [],
    'session-end': [],
    '_examples': {
      'pre-edit': ['echo "Editing: $BOBO_FILE"'],
      'post-edit': ['prettier --write $BOBO_FILE'],
      'pre-shell': ['echo "Running: $BOBO_COMMAND"'],
      'pre-commit': ['npm run lint'],
      'post-commit': ['echo "Committed: $BOBO_COMMIT_MSG"'],
    },
  }, null, 2);
}
