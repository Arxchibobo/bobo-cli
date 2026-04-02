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

// ASCII art dog logo (pixel art style, like Claude Code's robot)
const DOG_LOGO = [
  '    ╱▔▔╲   ╱▔▔╲    ',
  '   ▏  ●  ▔▔  ●  ▕   ',
  '   ▏    ▏▔▔▕    ▕   ',
  '    ╲  ╱    ╲  ╱    ',
  '     ▔╲  ▽  ╱▔     ',
  '       ╲▁▁▁╱       ',
];

const BOBO_BANNER = [
  ' ██████╗  ██████╗ ██████╗  ██████╗ ',
  ' ██╔══██╗██╔═══██╗██╔══██╗██╔═══██╗',
  ' ██████╔╝██║   ██║██████╔╝██║   ██║',
  ' ██╔══██╗██║   ██║██╔══██╗██║   ██║',
  ' ██████╔╝╚██████╔╝██████╔╝╚██████╔╝',
  ' ╚═════╝  ╚═════╝ ╚═════╝  ╚═════╝ ',
];

/**
 * Claude Code-style welcome screen with ASCII art logo
 */
export function printWelcome(info: {
  version: string;
  model: string;
  toolCount: number;
  skillsActive: number;
  skillsTotal: number;
  knowledgeCount: number;
  cwd: string;
}): void {
  console.log();

  // Dog logo in yellow/orange (like Claude's red robot)
  for (const line of DOG_LOGO) {
    console.log(chalk.yellow(`    ${line}`));
  }
  console.log();

  // Big banner text
  for (const line of BOBO_BANNER) {
    console.log(chalk.bold.cyan(line));
  }
  console.log();

  // Info line (like Claude Code: "Claude Code v2.1.90")
  console.log(
    `    ${chalk.bold.white('Bobo CLI')} ${chalk.dim(`v${info.version}`)}`
  );

  // Stats line (like "Opus 4.6 (1M context) · API Usage Billing")
  console.log(
    `    ${chalk.white(info.model)} ${chalk.dim('·')} ${chalk.dim(`${info.toolCount} tools`)} ${chalk.dim('·')} ${chalk.dim(`${info.skillsTotal} skills`)}`
  );

  // CWD (like Claude shows the working directory)
  console.log(`    ${chalk.dim(info.cwd)}`);
  console.log();

  // Separator
  console.log(chalk.dim('─'.repeat(60)));
  console.log();
}

function truncate(s: string, maxLen: number): string {
  const oneLine = s.replace(/\n/g, ' ');
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 3) + '...';
}
