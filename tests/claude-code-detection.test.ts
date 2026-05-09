import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isClaudeCodeAvailable } from '../src/tools/claude-code.js';

describe('Claude Code detection', () => {
  it('does not create a literal nul file when Claude Code is unavailable', async () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'bobo-claude-detect-'));
    const missingBin = join(sandbox, 'missing-bin');
    const previousCwd = process.cwd();
    const previousPath = process.env.PATH;

    mkdirSync(missingBin);
    process.chdir(sandbox);
    process.env.PATH = missingBin;

    try {
      expect(isClaudeCodeAvailable()).toBe(false);
      expect(existsSync(join(sandbox, 'nul'))).toBe(false);
    } finally {
      process.chdir(previousCwd);
      if (previousPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = previousPath;
      }
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
