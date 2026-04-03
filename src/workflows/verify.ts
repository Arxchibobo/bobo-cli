import { writeVerify } from '../state/artifacts.js';
import { runVerification, formatVerificationResult, type VerificationVerdict } from '../verification-agent.js';

export interface VerifyResult {
  verdict: VerificationVerdict;
  path: string;
  content: string;
}

/**
 * Run real verification workflow using verification-agent.ts
 * Executes build/test/lint checks and adversarial probing
 */
export async function runVerifyWorkflow(target = 'current workspace'): Promise<VerifyResult> {
  // Run actual verification
  const verificationResult = await runVerification(target, '', {
    cwd: process.cwd(),
  });

  // Format as markdown for artifact
  const content = formatVerificationResult(verificationResult);
  const path = writeVerify(content);

  return {
    verdict: verificationResult.verdict,
    path,
    content,
  };
}
