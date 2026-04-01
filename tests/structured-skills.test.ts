import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const cliPath = join(process.cwd(), 'dist', 'index.js');

function runCli(args: string[]): string {
  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf-8',
  });
}

describe('structured skill and template commands on main', () => {
  it('shows dependency order for a structured skill', () => {
    const output = runCli(['skills', 'deps', 'review-with-security']);
    expect(output).toContain('Dependency order for review-with-security');
    expect(output).toContain('code-review-expert');
    expect(output).toContain('docker-expert');
    expect(output).toContain('review-with-security');
  });

  it('generates a project scaffold from template command', () => {
    const targetDir = mkdtempSync(join(tmpdir(), 'bobo-main-template-'));

    try {
      const output = runCli(['template', 'project', '--dir', targetDir, '--name', 'Main Demo']);
      expect(output).toContain('Generated project scaffold');
      expect(existsSync(join(targetDir, '.claude', 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(targetDir, '.claude', 'settings.json'))).toBe(true);
      expect(existsSync(join(targetDir, '.claude', 'skills', 'code-review-expert', 'SKILL.md'))).toBe(true);
    } finally {
      rmSync(targetDir, { recursive: true, force: true });
    }
  });
});
