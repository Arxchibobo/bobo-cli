/**
 * Bottom status bar — fixed at the terminal bottom like Claude Code.
 * Uses ANSI escape sequences to render without disrupting normal output.
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
 * Enable the status bar and render it.
 */
export function enableStatusBar(info: StatusBarInfo): void {
  currentInfo = info;
  enabled = true;

  // Reserve space for status bar — set scrolling region to exclude last 2 lines
  const rows = process.stdout.rows || 24;
  // Set scroll region: lines 1 to (rows-2)
  process.stdout.write(`\x1b[1;${rows - 2}r`);
  // Move cursor to scroll region
  process.stdout.write(`\x1b[${rows - 2};1H`);

  renderStatusBar();
}

/**
 * Update status bar info and re-render.
 */
export function updateStatusBar(partial: Partial<StatusBarInfo>): void {
  if (!currentInfo) return;
  Object.assign(currentInfo, partial);
  if (enabled) renderStatusBar();
}

/**
 * Disable and clear the status bar, restore full terminal.
 */
export function disableStatusBar(): void {
  if (!enabled) return;
  enabled = false;

  // Reset scroll region to full terminal
  process.stdout.write('\x1b[r');

  // Clear the status bar lines
  const rows = process.stdout.rows || 24;
  process.stdout.write(`\x1b7`); // Save cursor
  process.stdout.write(`\x1b[${rows - 1};1H\x1b[2K`); // Clear line rows-1
  process.stdout.write(`\x1b[${rows};1H\x1b[2K`); // Clear line rows
  process.stdout.write(`\x1b8`); // Restore cursor
}

/**
 * Render the status bar at the bottom of the terminal.
 */
function renderStatusBar(): void {
  if (!currentInfo || !enabled) return;

  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;

  // Build status line
  const sep = chalk.dim(' · ');
  const permLabel = chalk.yellow('▸▸') + ' ' + chalk.yellow('all permissions') + chalk.dim(' (shift+tab to cycle)');
  const thinkLabel = chalk.dim('●') + ' ' + chalk.white(currentInfo.thinkingLevel);
  const modelLabel = chalk.green(currentInfo.model.split('/').pop() || currentInfo.model);

  const leftPart = permLabel;
  const rightPart = `${thinkLabel}${sep}/effort${sep.trim()} ${modelLabel}`;

  // Separator line
  const separatorLine = chalk.dim('─'.repeat(cols));

  // Content line — pad to fill width
  const leftLen = stripAnsi(leftPart).length;
  const rightLen = stripAnsi(rightPart).length;
  const gap = Math.max(1, cols - leftLen - rightLen);
  const contentLine = leftPart + ' '.repeat(gap) + rightPart;

  // Save cursor, draw at bottom, restore cursor
  process.stdout.write('\x1b7'); // save cursor
  process.stdout.write(`\x1b[${rows - 1};1H`); // move to row rows-1
  process.stdout.write('\x1b[2K'); // clear line
  process.stdout.write(separatorLine);
  process.stdout.write(`\x1b[${rows};1H`); // move to last row
  process.stdout.write('\x1b[2K'); // clear line
  process.stdout.write(contentLine);
  process.stdout.write('\x1b8'); // restore cursor
}

/**
 * Strip ANSI escape codes for length calculation.
 */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Handle terminal resize — re-render status bar.
 */
export function setupResizeHandler(): void {
  process.stdout.on('resize', () => {
    if (enabled && currentInfo) {
      // Reset scroll region for new size
      const rows = process.stdout.rows || 24;
      process.stdout.write(`\x1b[1;${rows - 2}r`);
      renderStatusBar();
    }
  });
}
