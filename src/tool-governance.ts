/**
 * Tool Governance Pipeline
 *
 * Enforces safety and consistency for all tool executions:
 * Input validation → Risk classification → PreToolUse Hook →
 * Permission check → Execution → PostToolUse Hook → Telemetry
 *
 * Key principles:
 * - Fail-closed: All tools are unsafe by default
 * - Explicit permissions: isConcurrencySafe and isReadOnly must be declared
 * - Stateful constraints: edit_file requires prior read_file
 */

import { runHooks } from './hooks.js';

/**
 * Risk levels for tool operations.
 */
export type ToolRiskLevel = 'safe' | 'moderate' | 'dangerous';

/**
 * Tool metadata for governance.
 */
export interface ToolMetadata {
  name: string;
  isReadOnly: boolean;          // True if tool doesn't modify state
  isConcurrencySafe: boolean;   // True if safe to run in parallel
  riskLevel: ToolRiskLevel;     // Risk classification
  requiresPriorRead?: string[]; // Tools that must be called first (e.g., ['read_file'])
}

/**
 * Tool execution context.
 */
export interface ToolExecutionContext {
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
  sessionId?: string;
}

/**
 * Tool execution result.
 */
export interface ToolExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  blocked?: boolean;
  blockReason?: string;
}

/**
 * Governance state tracker.
 */
class GovernanceState {
  private filesRead: Set<string> = new Set();
  private toolCallHistory: ToolExecutionContext[] = [];
  private maxHistorySize = 100;

  recordFileRead(path: string): void {
    this.filesRead.add(path);
  }

  hasReadFile(path: string): boolean {
    return this.filesRead.has(path);
  }

  recordToolCall(context: ToolExecutionContext): void {
    this.toolCallHistory.push(context);
    if (this.toolCallHistory.length > this.maxHistorySize) {
      this.toolCallHistory.shift();
    }
  }

  getRecentToolCalls(limit: number = 10): ToolExecutionContext[] {
    return this.toolCallHistory.slice(-limit);
  }

  reset(): void {
    this.filesRead.clear();
    this.toolCallHistory = [];
  }
}

// Global governance state (per process)
const governanceState = new GovernanceState();

/**
 * Tool metadata registry.
 * IMPORTANT: Default to fail-closed (unsafe) for unknown tools.
 */
const toolMetadataRegistry: Record<string, ToolMetadata> = {
  // Read-only tools (safe)
  read_file: {
    name: 'read_file',
    isReadOnly: true,
    isConcurrencySafe: true,
    riskLevel: 'safe',
  },
  list_directory: {
    name: 'list_directory',
    isReadOnly: true,
    isConcurrencySafe: true,
    riskLevel: 'safe',
  },
  search_files: {
    name: 'search_files',
    isReadOnly: true,
    isConcurrencySafe: true,
    riskLevel: 'safe',
  },
  git_status: {
    name: 'git_status',
    isReadOnly: true,
    isConcurrencySafe: true,
    riskLevel: 'safe',
  },
  git_diff: {
    name: 'git_diff',
    isReadOnly: true,
    isConcurrencySafe: true,
    riskLevel: 'safe',
  },
  git_log: {
    name: 'git_log',
    isReadOnly: true,
    isConcurrencySafe: true,
    riskLevel: 'safe',
  },
  search_memory: {
    name: 'search_memory',
    isReadOnly: true,
    isConcurrencySafe: true,
    riskLevel: 'safe',
  },

  // Moderate-risk tools (state-modifying but recoverable)
  write_file: {
    name: 'write_file',
    isReadOnly: false,
    isConcurrencySafe: false, // File system races
    riskLevel: 'moderate',
  },
  edit_file: {
    name: 'edit_file',
    isReadOnly: false,
    isConcurrencySafe: false,
    riskLevel: 'moderate',
    requiresPriorRead: ['read_file'], // MUST read file before editing
  },
  save_memory: {
    name: 'save_memory',
    isReadOnly: false,
    isConcurrencySafe: false,
    riskLevel: 'moderate',
  },

  // Dangerous tools (hard to reverse)
  shell: {
    name: 'shell',
    isReadOnly: false,
    isConcurrencySafe: false,
    riskLevel: 'dangerous',
  },
  git_commit: {
    name: 'git_commit',
    isReadOnly: false,
    isConcurrencySafe: false,
    riskLevel: 'dangerous',
  },
  git_push: {
    name: 'git_push',
    isReadOnly: false,
    isConcurrencySafe: false,
    riskLevel: 'dangerous',
  },
};

/**
 * Get tool metadata (fail-closed for unknown tools).
 */
export function getToolMetadata(toolName: string): ToolMetadata {
  return toolMetadataRegistry[toolName] || {
    name: toolName,
    isReadOnly: false,
    isConcurrencySafe: false,
    riskLevel: 'dangerous', // Unknown tools are dangerous by default
  };
}

/**
 * Register tool metadata (for external tools).
 */
export function registerToolMetadata(metadata: ToolMetadata): void {
  toolMetadataRegistry[metadata.name] = metadata;
}

/**
 * Validate tool inputs against schema.
 */
function validateToolInputs(toolName: string, args: Record<string, unknown>): {
  valid: boolean;
  error?: string;
} {
  // Basic validation - can be extended with JSON schema validation
  switch (toolName) {
    case 'read_file':
    case 'write_file':
    case 'edit_file':
      if (!args.path || typeof args.path !== 'string') {
        return { valid: false, error: 'Missing or invalid "path" parameter' };
      }
      // Check for path traversal attempts
      if ((args.path as string).includes('..')) {
        return { valid: false, error: 'Path traversal not allowed' };
      }
      break;

    case 'shell':
      if (!args.command || typeof args.command !== 'string') {
        return { valid: false, error: 'Missing or invalid "command" parameter' };
      }
      // Check for dangerous patterns
      const cmd = args.command as string;
      if (cmd.includes('rm -rf /') || cmd.includes('mkfs') || cmd.includes(':(){:|:&};:')) {
        return { valid: false, error: 'Dangerous command blocked' };
      }
      break;

    case 'edit_file':
      if (!args.oldText || !args.newText) {
        return { valid: false, error: 'Missing "oldText" or "newText" parameter' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Check if tool execution should be allowed based on governance rules.
 */
function checkGovernanceRules(toolName: string, args: Record<string, unknown>): {
  allowed: boolean;
  reason?: string;
} {
  const metadata = getToolMetadata(toolName);

  // Check for required prior tool calls
  if (metadata.requiresPriorRead && metadata.requiresPriorRead.length > 0) {
    if (toolName === 'edit_file' && args.path) {
      const filePath = args.path as string;
      if (!governanceState.hasReadFile(filePath)) {
        return {
          allowed: false,
          reason: `Must read file "${filePath}" before editing. Use read_file first.`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Execute tool with full governance pipeline.
 */
export async function executeToolWithGovernance(
  toolName: string,
  args: Record<string, unknown>,
  executor: (name: string, args: Record<string, unknown>) => Promise<string> | string,
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const context: ToolExecutionContext = {
    toolName,
    args,
    timestamp: startTime,
  };

  try {
    // Step 1: Input validation
    const validation = validateToolInputs(toolName, args);
    if (!validation.valid) {
      return {
        success: false,
        error: `Input validation failed: ${validation.error}`,
        duration: Date.now() - startTime,
        blocked: true,
        blockReason: validation.error,
      };
    }

    // Step 2: Risk classification (already in metadata)
    const metadata = getToolMetadata(toolName);

    // Step 3: Governance rules check
    const governanceCheck = checkGovernanceRules(toolName, args);
    if (!governanceCheck.allowed) {
      return {
        success: false,
        error: `Governance rule violation: ${governanceCheck.reason}`,
        duration: Date.now() - startTime,
        blocked: true,
        blockReason: governanceCheck.reason,
      };
    }

    // Step 4: PreToolUse Hook
    try {
      runHooks('pre-tool-use', {
        BOBO_TOOL_NAME: toolName,
        BOBO_TOOL_RISK: metadata.riskLevel,
        BOBO_TOOL_ARGS: JSON.stringify(args),
      });
    } catch (hookError) {
      return {
        success: false,
        error: `Pre-tool-use hook failed: ${(hookError as Error).message}`,
        duration: Date.now() - startTime,
        blocked: true,
        blockReason: 'Hook rejection',
      };
    }

    // Step 5: Execute tool
    let output: string;
    try {
      const result = executor(toolName, args);
      output = result instanceof Promise ? await result : result;
    } catch (execError) {
      const duration = Date.now() - startTime;
      governanceState.recordToolCall(context);

      return {
        success: false,
        error: (execError as Error).message,
        duration,
      };
    }

    // Step 6: PostToolUse Hook
    try {
      runHooks('post-tool-use', {
        BOBO_TOOL_NAME: toolName,
        BOBO_TOOL_RISK: metadata.riskLevel,
        BOBO_TOOL_SUCCESS: 'true',
      });
    } catch {
      // Post-execution hooks shouldn't block
    }

    // Step 7: Update governance state
    governanceState.recordToolCall(context);

    // Track file reads for edit_file enforcement
    if (toolName === 'read_file' && args.path) {
      governanceState.recordFileRead(args.path as string);
    }

    // Step 8: Telemetry (recorded in context history)
    const duration = Date.now() - startTime;

    return {
      success: true,
      output,
      duration,
    };
  } catch (error) {
    return {
      success: false,
      error: `Governance pipeline error: ${(error as Error).message}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check if tools can be run concurrently.
 */
export function canRunConcurrently(toolNames: string[]): boolean {
  return toolNames.every(name => {
    const metadata = getToolMetadata(name);
    return metadata.isConcurrencySafe;
  });
}

/**
 * Get governance statistics.
 */
export function getGovernanceStats(): {
  filesRead: number;
  recentToolCalls: ToolExecutionContext[];
} {
  return {
    filesRead: governanceState['filesRead'].size,
    recentToolCalls: governanceState.getRecentToolCalls(20),
  };
}

/**
 * Reset governance state (useful for testing or session boundaries).
 */
export function resetGovernanceState(): void {
  governanceState.reset();
}

/**
 * Format governance result for user display.
 */
export function formatGovernanceError(result: ToolExecutionResult): string {
  if (result.blocked) {
    return `🚫 Tool execution blocked: ${result.blockReason || result.error}`;
  }
  return `❌ Tool execution failed: ${result.error}`;
}
