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

export function printWelcome(): void {
  const border = chalk.cyan('╭──────────────────────────────────────────────────────────────╮');
  const footer = chalk.cyan('╰──────────────────────────────────────────────────────────────╯');
  const title = chalk.cyan.bold('🐕  大波比 CLI');
  const subtitle = chalk.dim('便携式 AI 工程助手 · REPL + 结构化知识库 + Scaffold');
  const commands = chalk.dim('试试: /help  ·  bobo kb stats  ·  bobo rules show blocking-rules');
  const controls = chalk.dim('输入问题开始对话，Ctrl+D 退出，Ctrl+C 取消当前请求');

  console.log('');
  console.log(border);
  console.log(chalk.cyan('│ ') + title.padEnd(58) + chalk.cyan('│'));
  console.log(chalk.cyan('│ ') + subtitle.padEnd(58) + chalk.cyan('│'));
  console.log(chalk.cyan('│ ') + ''.padEnd(58) + chalk.cyan('│'));
  console.log(chalk.cyan('│ ') + commands.padEnd(58) + chalk.cyan('│'));
  console.log(chalk.cyan('│ ') + controls.padEnd(58) + chalk.cyan('│'));
  console.log(footer);
  console.log('');
}

function truncate(s: string, maxLen: number): string {
  const oneLine = s.replace(/\n/g, ' ');
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 3) + '...';
}
