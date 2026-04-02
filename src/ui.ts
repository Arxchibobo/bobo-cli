import chalk from 'chalk';

export function printStreaming(text: string): void {
  process.stdout.write(text);
}

export function printLine(text: string = ''): void {
  console.log(text);
}

export function printAssistant(text: string): void {
  console.log(chalk.cyan(text));
}

export function printError(text: string): void {
  console.error(chalk.red(`✗ ${text}`));
}

export function printWarning(text: string): void {
  console.log(chalk.yellow(`⚠ ${text}`));
}

export function printSuccess(text: string): void {
  console.log(chalk.green(`✓ ${text}`));
}

export function printToolCall(name: string, args: string): void {
  console.log(chalk.dim(`  ⚙ ${name}(${truncate(args, 80)})`));
}

export function printToolResult(result: string): void {
  const lines = result.split('\n');
  const preview = lines.slice(0, 5).join('\n');
  if (lines.length > 5) {
    console.log(chalk.dim(preview + `\n  ... (${lines.length - 5} more lines)`));
  } else {
    console.log(chalk.dim(preview));
  }
}

/**
 * Claude Code-style boxed welcome screen
 */
export function printWelcome(info: {
  version: string;
  model: string;
  toolCount: number;
  skillsActive: number;
  skillsTotal: number;
  knowledgeCount: number;
}): void {
  const width = 48;
  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - stripAnsi(s).length));
  const line = (content: string) => {
    const stripped = stripAnsi(content);
    const padding = Math.max(0, width - 4 - stripped.length);
    return `${chalk.cyan('│')}  ${content}${' '.repeat(padding)}${chalk.cyan('│')}`;
  };
  const empty = `${chalk.cyan('│')}${' '.repeat(width - 2)}${chalk.cyan('│')}`;

  const title = `${chalk.bold.white('🐕 Bobo CLI')}`;
  const ver = chalk.dim(`v${info.version}`);
  const titleLine = `${title}${' '.repeat(Math.max(1, width - 4 - stripAnsi(title).length - stripAnsi(ver).length))}${ver}`;

  console.log();
  console.log(`${chalk.cyan('╭')}${'─'.repeat(width - 2)}${chalk.cyan('╮')}`);
  console.log(`${chalk.cyan('│')}  ${titleLine}  ${chalk.cyan('│')}`);
  console.log(line(chalk.dim('Portable AI Engineering Assistant')));
  console.log(empty);
  console.log(line(`Model:     ${chalk.white(info.model)}`));
  console.log(line(`Tools:     ${chalk.white(String(info.toolCount))} available`));
  console.log(line(`Skills:    ${chalk.green(String(info.skillsActive))} active ${chalk.dim('/')} ${info.skillsTotal} total`));
  console.log(line(`Knowledge: ${chalk.white(String(info.knowledgeCount))} files loaded`));
  console.log(empty);
  console.log(line(chalk.dim('Type /help for commands, Ctrl+D to exit')));
  console.log(`${chalk.cyan('╰')}${'─'.repeat(width - 2)}${chalk.cyan('╯')}`);
  console.log();
}

function truncate(s: string, maxLen: number): string {
  const oneLine = s.replace(/\n/g, ' ');
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 3) + '...';
}

// Strip ANSI escape codes for length calculation
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}
