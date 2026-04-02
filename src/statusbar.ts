/**
 * Bottom status bar — rendered before each prompt (no scroll region tricks).
 * Works on all terminals including Windows CMD/PowerShell.
 */

import chalk from 'chalk';

export interface StatusBarInfo {
  model: string;
  thinkingLevel: string;
  skillsCount: number;
  cwd: string;
}

let currentInfo: StatusBarInfo | null = null;
let enabled = false;

/**
 * Enable the status bar.
 */
export function enableStatusBar(info: StatusBarInfo): void {
  currentInfo = info;
  enabled = true;
}

/**
 * Update status bar info.
 */
export function updateStatusBar(partial: Partial<StatusBarInfo>): void {
  if (!currentInfo) return;
  Object.assign(currentInfo, partial);
}

/**
 * Disable the status bar.
 */
export function disableStatusBar(): void {
  enabled = false;
}

/**
 * Render the status bar string. Call this before each prompt.
 * Returns the string to print, or empty string if disabled.
 */
export function renderStatusBar(): string {
  if (!currentInfo || !enabled) return '';

  const cols = process.stdout.columns || 80;

  const sep = chalk.dim(' · ');

  // Left: permission mode indicator
  const permLabel = chalk.yellow('▸▸') + ' ' + chalk.yellow.dim('auto');

  // Center/Right: effort + model
  const effortDot = currentInfo.thinkingLevel === 'high' ? chalk.green('●')
    : currentInfo.thinkingLevel === 'low' ? chalk.dim('●')
    : chalk.yellow('●');
  const effortLabel = effortDot + ' ' + chalk.white(currentInfo.thinkingLevel);

  const modelShort = currentInfo.model.split('/').pop() || currentInfo.model;
  const modelLabel = chalk.green(modelShort);

  // Build line
  const leftPart = permLabel;
  const rightPart = `${effortLabel}${sep}${modelLabel}`;

  const leftLen = stripAnsi(leftPart).length;
  const rightLen = stripAnsi(rightPart).length;
  const gap = Math.max(1, cols - leftLen - rightLen - 2);

  const bar = chalk.dim('─'.repeat(cols));
  const content = ' ' + leftPart + ' '.repeat(gap) + rightPart + ' ';

  return `${bar}\n${content}`;
}

/**
 * No-op for compatibility (resize handling not needed without scroll regions).
 */
export function setupResizeHandler(): void {
  // No-op — status bar is re-rendered before each prompt
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}
