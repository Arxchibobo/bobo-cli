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

describe('structured knowledge commands on main', () => {
  it('shows kb stats', () => {
    const output = runCli(['kb', 'stats']);
    expect(output).toContain('Knowledge Base Statistics');
    expect(output).toContain('Rules:');
    expect(output).toContain('Skills:');
  });

  it('shows a structured rule by id', () => {
    const output = runCli(['rules', 'show', 'blocking-rules']);
    expect(output).toContain('致命阻塞规则');
    expect(output).toContain('只在这4种情况下提问');
  });
});
