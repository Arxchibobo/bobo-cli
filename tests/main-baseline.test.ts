import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const cliPath = join(process.cwd(), 'dist', 'index.js');

function runCli(args: string[]): string {
  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf-8',
  });
}

describe('main branch baseline CLI', () => {
  it('shows top-level help', () => {
    const output = runCli(['--help']);
    expect(output).toContain('大波比');
    expect(output).toContain('config');
    expect(output).toContain('skill');
  });

  it('shows knowledge command output', () => {
    const output = runCli(['knowledge']);
    expect(output).toContain('知识库文件');
  });

  it('shows skill list output', () => {
    const output = runCli(['skill', 'list']);
    expect(output).toContain('Skills');
    expect(output).toContain('coding');
    expect(output).toContain('research');
  });

  it('shows structured knowledge stats command', () => {
    const output = runCli(['kb', 'stats']);
    expect(output).toContain('Knowledge Base Statistics');
    expect(output).toContain('Rules:');
  });

  it('shows structured rules command', () => {
    const output = runCli(['rules', 'show', 'blocking-rules']);
    expect(output).toContain('致命阻塞规则');
  });
});
