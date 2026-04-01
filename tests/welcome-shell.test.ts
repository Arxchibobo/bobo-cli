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

describe('welcome and product shell', () => {
  it('shows a polished help surface', () => {
    const output = runCli(['--help']);
    expect(output).toContain('大波比');
    expect(output).toContain('kb');
    expect(output).toContain('rules');
    expect(output).toContain('skills');
    expect(output).toContain('template');
  });
});
