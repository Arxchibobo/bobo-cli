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
  console.log(chalk.cyan.bold('\n🐕 大波比 CLI — 你的便携 AI 助手'));
  console.log(chalk.dim('输入问题开始对话，Ctrl+D 退出，Ctrl+C 取消当前请求\n'));
}

function truncate(s: string, maxLen: number): string {
  const oneLine = s.replace(/\n/g, ' ');
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen - 3) + '...';
}
