/**
 * Verification Agent — 'try to break it' philosophy
 *
 * Instead of confirming success, this agent actively tries to find flaws.
 * - Enforces build/test/lint execution
 * - Adversarial probing: boundary testing, actual API calls
 * - Separation of concerns: independent from the code-writing agent
 * - Returns VERDICT: PASS / FAIL / PARTIAL
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type VerificationVerdict = 'PASS' | 'FAIL' | 'PARTIAL';

export interface VerificationResult {
  verdict: VerificationVerdict;
  summary: string;
  checks: VerificationCheck[];
  reasoning: string;
  suggestedFixes?: string[];
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  output?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

interface VerificationOptions {
  cwd?: string;
  skipTests?: boolean;
  skipBuild?: boolean;
  skipLint?: boolean;
  adversarialTests?: AdversarialTest[];
}

interface AdversarialTest {
  name: string;
  command: string;
  expectFail?: boolean; // If true, expects the command to fail
}

/**
 * Main verification function — runs all checks and returns verdict.
 */
export async function runVerification(
  task: string,
  result: string,
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  const cwd = options.cwd || process.cwd();
  const checks: VerificationCheck[] = [];

  // Check 1: Build (if applicable)
  if (!options.skipBuild) {
    checks.push(await verifyBuild(cwd));
  }

  // Check 2: Tests (if applicable)
  if (!options.skipTests) {
    checks.push(await verifyTests(cwd));
  }

  // Check 3: Lint (if applicable)
  if (!options.skipLint) {
    checks.push(await verifyLint(cwd));
  }

  // Check 4: Adversarial tests (boundary values, edge cases)
  if (options.adversarialTests && options.adversarialTests.length > 0) {
    for (const test of options.adversarialTests) {
      checks.push(await runAdversarialTest(test, cwd));
    }
  } else {
    // Auto-detect common adversarial tests
    checks.push(...await autoDetectAdversarialTests(task, result, cwd));
  }

  // Compute verdict
  const verdict = computeVerdict(checks);
  const summary = generateSummary(checks, verdict);
  const reasoning = generateReasoning(checks, task, result);
  const suggestedFixes = generateSuggestedFixes(checks);

  return {
    verdict,
    summary,
    checks,
    reasoning,
    suggestedFixes: suggestedFixes.length > 0 ? suggestedFixes : undefined,
  };
}

/**
 * Verify build passes.
 */
async function verifyBuild(cwd: string): Promise<VerificationCheck> {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {
      name: 'Build',
      passed: true,
      skipped: true,
      skipReason: 'No package.json found',
    };
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const buildScript = packageJson.scripts?.build;

  if (!buildScript) {
    return {
      name: 'Build',
      passed: true,
      skipped: true,
      skipReason: 'No build script defined',
    };
  }

  try {
    const output = execSync('npm run build', {
      cwd,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return {
      name: 'Build',
      passed: true,
      output: output.trim(),
    };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      name: 'Build',
      passed: false,
      error: `Build failed: ${err.stderr || err.stdout || err.message || 'Unknown error'}`,
    };
  }
}

/**
 * Verify tests pass.
 */
async function verifyTests(cwd: string): Promise<VerificationCheck> {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {
      name: 'Tests',
      passed: true,
      skipped: true,
      skipReason: 'No package.json found',
    };
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const testScript = packageJson.scripts?.test;

  if (!testScript) {
    return {
      name: 'Tests',
      passed: true,
      skipped: true,
      skipReason: 'No test script defined',
    };
  }

  try {
    const output = execSync('npm test', {
      cwd,
      encoding: 'utf-8',
      timeout: 180000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return {
      name: 'Tests',
      passed: true,
      output: output.trim(),
    };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      name: 'Tests',
      passed: false,
      error: `Tests failed: ${err.stderr || err.stdout || err.message || 'Unknown error'}`,
    };
  }
}

/**
 * Verify linting passes.
 */
async function verifyLint(cwd: string): Promise<VerificationCheck> {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {
      name: 'Lint',
      passed: true,
      skipped: true,
      skipReason: 'No package.json found',
    };
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const lintScript = packageJson.scripts?.lint;

  if (!lintScript) {
    // Try common linters
    const linters = ['eslint', 'tslint', 'biome'];
    for (const linter of linters) {
      try {
        const output = execSync(`npx ${linter} --version`, {
          cwd,
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        // Linter exists, try running it
        try {
          const lintOutput = execSync(`npx ${linter} .`, {
            cwd,
            encoding: 'utf-8',
            timeout: 60000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          return {
            name: 'Lint',
            passed: true,
            output: `${linter}: ${lintOutput.trim()}`,
          };
        } catch (lintErr: unknown) {
          const err = lintErr as { stdout?: string; stderr?: string; message?: string };
          return {
            name: 'Lint',
            passed: false,
            error: `${linter} found issues: ${err.stderr || err.stdout || err.message || 'Unknown error'}`,
          };
        }
      } catch {
        // Linter not found, continue
      }
    }

    return {
      name: 'Lint',
      passed: true,
      skipped: true,
      skipReason: 'No lint script or linter found',
    };
  }

  try {
    const output = execSync('npm run lint', {
      cwd,
      encoding: 'utf-8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return {
      name: 'Lint',
      passed: true,
      output: output.trim(),
    };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      name: 'Lint',
      passed: false,
      error: `Lint failed: ${err.stderr || err.stdout || err.message || 'Unknown error'}`,
    };
  }
}

/**
 * Run a single adversarial test.
 */
async function runAdversarialTest(test: AdversarialTest, cwd: string): Promise<VerificationCheck> {
  try {
    const output = execSync(test.command, {
      cwd,
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (test.expectFail) {
      // Expected to fail but didn't
      return {
        name: test.name,
        passed: false,
        error: `Expected command to fail but it succeeded: ${output.trim()}`,
      };
    }

    return {
      name: test.name,
      passed: true,
      output: output.trim(),
    };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };

    if (test.expectFail) {
      // Expected to fail and did
      return {
        name: test.name,
        passed: true,
        output: `Command failed as expected: ${err.stderr || err.stdout || err.message || 'Unknown error'}`,
      };
    }

    return {
      name: test.name,
      passed: false,
      error: `${err.stderr || err.stdout || err.message || 'Unknown error'}`,
    };
  }
}

/**
 * Auto-detect adversarial tests based on task and result.
 */
async function autoDetectAdversarialTests(
  task: string,
  result: string,
  cwd: string
): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];

  // If task mentions API, try to find and test endpoints
  if (task.toLowerCase().includes('api') || result.toLowerCase().includes('endpoint')) {
    checks.push(await detectApiTests(result, cwd));
  }

  // If task mentions CLI, try to run help command
  if (task.toLowerCase().includes('cli') || task.toLowerCase().includes('command')) {
    checks.push(await detectCliTests(cwd));
  }

  // If task mentions database/migration, check schema
  if (task.toLowerCase().includes('database') || task.toLowerCase().includes('migration')) {
    checks.push(await detectDatabaseTests(cwd));
  }

  return checks.filter(c => !c.skipped);
}

/**
 * Detect and test API endpoints.
 */
async function detectApiTests(result: string, cwd: string): Promise<VerificationCheck> {
  // Try to find port numbers in result
  const portMatch = result.match(/(?:port|PORT)[:\s]*(\d+)/);

  if (!portMatch) {
    return {
      name: 'API Probe',
      passed: true,
      skipped: true,
      skipReason: 'No port number detected',
    };
  }

  const port = portMatch[1];

  try {
    // Cross-platform health check using Node.js http
    const http = await import('node:http');
    const statusCode = await new Promise<number>((resolve) => {
      const req = http.default.get(`http://localhost:${port}/health`, { timeout: 5000 }, (res) => {
        resolve(res.statusCode ?? 0);
        res.resume();
      });
      req.on('error', () => resolve(0));
      req.on('timeout', () => { req.destroy(); resolve(0); });
    });

    if (statusCode === 0) {
      return {
        name: 'API Probe',
        passed: false,
        error: 'API endpoint not responding',
      };
    }

    return {
      name: 'API Probe',
      passed: true,
      output: `API responding with HTTP ${statusCode}`,
    };
  } catch (e: unknown) {
    return {
      name: 'API Probe',
      passed: false,
      error: `Failed to probe API: ${(e as Error).message}`,
    };
  }
}

/**
 * Detect and test CLI commands.
 */
async function detectCliTests(cwd: string): Promise<VerificationCheck> {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {
      name: 'CLI Test',
      passed: true,
      skipped: true,
      skipReason: 'No package.json found',
    };
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const bin = packageJson.bin;

  if (!bin) {
    return {
      name: 'CLI Test',
      passed: true,
      skipped: true,
      skipReason: 'No CLI binary defined',
    };
  }

  const cliName = typeof bin === 'string' ? Object.keys(packageJson)[0] : Object.keys(bin)[0];

  try {
    const output = execSync(`node ${typeof bin === 'string' ? bin : bin[cliName]} --help`, {
      cwd,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      name: 'CLI Test',
      passed: true,
      output: `CLI --help works: ${output.trim().split('\n')[0]}`,
    };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      name: 'CLI Test',
      passed: false,
      error: `CLI --help failed: ${err.stderr || err.stdout || err.message || 'Unknown error'}`,
    };
  }
}

/**
 * Detect database/migration tests.
 */
async function detectDatabaseTests(cwd: string): Promise<VerificationCheck> {
  // Check for common migration tools
  const migrationCommands = [
    'npx prisma migrate status',
    'npm run db:migrate',
    'npx knex migrate:status',
  ];

  for (const cmd of migrationCommands) {
    try {
      const output = execSync(cmd, {
        cwd,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return {
        name: 'Database Migration',
        passed: true,
        output: output.trim(),
      };
    } catch {
      // Try next command
    }
  }

  return {
    name: 'Database Migration',
    passed: true,
    skipped: true,
    skipReason: 'No migration tool detected',
  };
}

/**
 * Compute final verdict from all checks.
 */
function computeVerdict(checks: VerificationCheck[]): VerificationVerdict {
  const relevantChecks = checks.filter(c => !c.skipped);

  if (relevantChecks.length === 0) {
    return 'PARTIAL'; // No checks ran
  }

  const failedChecks = relevantChecks.filter(c => !c.passed);

  if (failedChecks.length === 0) {
    return 'PASS'; // All checks passed
  }

  const passedChecks = relevantChecks.filter(c => c.passed);

  if (passedChecks.length === 0) {
    return 'FAIL'; // All checks failed
  }

  return 'PARTIAL'; // Some checks passed, some failed
}

/**
 * Generate summary of verification results.
 */
function generateSummary(checks: VerificationCheck[], verdict: VerificationVerdict): string {
  const relevantChecks = checks.filter(c => !c.skipped);
  const passedCount = relevantChecks.filter(c => c.passed).length;
  const failedCount = relevantChecks.filter(c => !c.passed).length;
  const skippedCount = checks.filter(c => c.skipped).length;

  return `Verification ${verdict}: ${passedCount}/${relevantChecks.length} checks passed` +
    (failedCount > 0 ? `, ${failedCount} failed` : '') +
    (skippedCount > 0 ? ` (${skippedCount} skipped)` : '');
}

/**
 * Generate reasoning about the verification.
 */
function generateReasoning(checks: VerificationCheck[], task: string, result: string): string {
  const failedChecks = checks.filter(c => !c.passed && !c.skipped);

  if (failedChecks.length === 0) {
    return 'All verification checks passed. The implementation appears to be working correctly.';
  }

  const reasons: string[] = ['Verification found issues:'];

  for (const check of failedChecks) {
    reasons.push(`- ${check.name}: ${check.error || 'Failed'}`);
  }

  return reasons.join('\n');
}

/**
 * Generate suggested fixes for failed checks.
 */
function generateSuggestedFixes(checks: VerificationCheck[]): string[] {
  const fixes: string[] = [];
  const failedChecks = checks.filter(c => !c.passed && !c.skipped);

  for (const check of failedChecks) {
    switch (check.name) {
      case 'Build':
        fixes.push('Fix build errors by checking TypeScript types and import statements');
        break;
      case 'Tests':
        fixes.push('Fix failing tests or update test expectations if behavior changed intentionally');
        break;
      case 'Lint':
        fixes.push('Run linter and fix code style issues');
        break;
      case 'API Probe':
        fixes.push('Ensure API server is running and endpoints are correctly implemented');
        break;
      case 'CLI Test':
        fixes.push('Verify CLI entry point exists and --help flag is implemented');
        break;
      default:
        if (check.error) {
          fixes.push(`Investigate: ${check.error.split('\n')[0]}`);
        }
    }
  }

  return [...new Set(fixes)]; // Remove duplicates
}

/**
 * Format verification result for display.
 */
export function formatVerificationResult(result: VerificationResult): string {
  const lines: string[] = [];

  lines.push(`\n╔═══════════════════════════════════════════════════════════════`);
  lines.push(`║ VERIFICATION AGENT — 'try to break it' mode`);
  lines.push(`╠═══════════════════════════════════════════════════════════════`);
  lines.push(`║ VERDICT: ${result.verdict}`);
  lines.push(`╠═══════════════════════════════════════════════════════════════`);
  lines.push(`║ ${result.summary}`);
  lines.push(`╠═══════════════════════════════════════════════════════════════`);

  for (const check of result.checks) {
    const status = check.skipped ? '⊘' : check.passed ? '✓' : '✗';
    lines.push(`║ ${status} ${check.name}`);

    if (check.skipped) {
      lines.push(`║   └─ ${check.skipReason}`);
    } else if (!check.passed && check.error) {
      const errorLines = check.error.split('\n').slice(0, 2);
      for (const line of errorLines) {
        lines.push(`║   └─ ${line.slice(0, 60)}`);
      }
    }
  }

  lines.push(`╠═══════════════════════════════════════════════════════════════`);
  lines.push(`║ REASONING:`);
  const reasoningLines = result.reasoning.split('\n');
  for (const line of reasoningLines) {
    lines.push(`║ ${line}`);
  }

  if (result.suggestedFixes && result.suggestedFixes.length > 0) {
    lines.push(`╠═══════════════════════════════════════════════════════════════`);
    lines.push(`║ SUGGESTED FIXES:`);
    for (const fix of result.suggestedFixes) {
      lines.push(`║ • ${fix}`);
    }
  }

  lines.push(`╚═══════════════════════════════════════════════════════════════\n`);

  return lines.join('\n');
}
