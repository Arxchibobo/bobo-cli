/**
 * Enhanced Git tools — PR workflow, branch management, stash.
 * All git invocations go through `runGit()` (arg array, no shell) and
 * `gh` invocations go through `runProgram()`. Never interpolate LLM
 * input into a shell command.
 */

import type { ChatCompletionTool } from 'openai/resources/index.js';
import { runGit, runProgram } from './safety.js';

export const gitAdvancedToolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'git_branch',
      description: 'Create, switch, list, or delete branches.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'create', 'switch', 'delete'], description: 'Branch operation' },
          name: { type: 'string', description: 'Branch name (for create/switch/delete)' },
          from: { type: 'string', description: 'Base branch for create (default: current)' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_stash',
      description: 'Stash/unstash working changes.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['push', 'pop', 'list', 'drop'], description: 'Stash operation' },
          message: { type: 'string', description: 'Stash message (for push)' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_pr',
      description: 'Create a pull request using `gh` CLI. Requires GitHub CLI installed and authenticated.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'PR title' },
          body: { type: 'string', description: 'PR body/description' },
          base: { type: 'string', description: 'Target branch (default: main)' },
          draft: { type: 'boolean', description: 'Create as draft PR' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_pr_list',
      description: 'List open pull requests using `gh` CLI.',
      parameters: {
        type: 'object',
        properties: {
          state: { type: 'string', enum: ['open', 'closed', 'merged', 'all'], description: 'PR state filter' },
          limit: { type: 'number', description: 'Max results (default: 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_merge',
      description: 'Merge a branch into the current branch.',
      parameters: {
        type: 'object',
        properties: {
          branch: { type: 'string', description: 'Branch to merge' },
          strategy: { type: 'string', enum: ['merge', 'squash', 'rebase'], description: 'Merge strategy' },
        },
        required: ['branch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_cherry_pick',
      description: 'Cherry-pick a commit onto the current branch.',
      parameters: {
        type: 'object',
        properties: {
          commit: { type: 'string', description: 'Commit hash to cherry-pick' },
        },
        required: ['commit'],
      },
    },
  },
];

// ─── Implementations ─────────────────────────────────────────

/**
 * git refs (branches, tags, commits) follow a defined character set —
 * reject anything with shell metacharacters or whitespace before passing
 * to git. This is belt-and-suspenders since we never go through a shell
 * anyway, but a malformed name will at least produce a clear error rather
 * than confusing git.
 */
function assertValidRef(name: unknown, label: string): string {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`Missing ${label}`);
  }
  // Allow alphanumerics, dash, underscore, slash, dot, plus the @{...}
  // syntax used by reflog refs. Reject everything else.
  if (!/^[A-Za-z0-9._\-/@{}+~^:]+$/.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`);
  }
  return name;
}

function format(result: { ok: boolean; output: string }): string {
  return result.output || (result.ok ? '(no output)' : 'git failed');
}

function gitBranch(args: Record<string, unknown>): string {
  const action = args.action as string;

  switch (action) {
    case 'list':
      return format(runGit(['branch', '-a', '--sort=-committerdate']));
    case 'create': {
      const name = assertValidRef(args.name, 'branch name');
      const from = args.from ? assertValidRef(args.from, 'base branch') : null;
      const argv = from ? ['checkout', '-b', name, from] : ['checkout', '-b', name];
      return format(runGit(argv));
    }
    case 'switch': {
      const name = assertValidRef(args.name, 'branch name');
      return format(runGit(['checkout', name]));
    }
    case 'delete': {
      const name = assertValidRef(args.name, 'branch name');
      return format(runGit(['branch', '-d', name]));
    }
    default:
      return `Unknown action: ${action}`;
  }
}

function gitStash(args: Record<string, unknown>): string {
  const action = args.action as string;
  switch (action) {
    case 'push': {
      const msg = args.message as string | undefined;
      const argv = msg ? ['stash', 'push', '-m', msg] : ['stash', 'push'];
      return format(runGit(argv));
    }
    case 'pop':
      return format(runGit(['stash', 'pop']));
    case 'list':
      return format(runGit(['stash', 'list'])) || '(no stashes)';
    case 'drop':
      return format(runGit(['stash', 'drop']));
    default:
      return `Unknown action: ${action}`;
  }
}

function gitPr(args: Record<string, unknown>): string {
  const title = args.title as string;
  const body = (args.body as string) || '';
  const base = args.base ? assertValidRef(args.base, 'base branch') : 'main';
  const draft = (args.draft as boolean) || false;

  if (typeof title !== 'string' || title.length === 0) {
    return 'Missing PR title';
  }

  const argv = ['pr', 'create', '--title', title, '--base', base];
  if (body) argv.push('--body', body);
  if (draft) argv.push('--draft');

  return format(runProgram('gh', argv, { timeout: 30000 }));
}

function gitPrList(args: Record<string, unknown>): string {
  const state = (args.state as string) || 'open';
  if (!['open', 'closed', 'merged', 'all'].includes(state)) {
    return `Invalid state: ${state}`;
  }
  const limit = (args.limit as number) || 10;
  if (!Number.isFinite(limit) || limit <= 0 || limit > 100) {
    return 'Invalid limit (must be 1–100)';
  }
  return format(runProgram('gh', ['pr', 'list', '--state', state, '--limit', String(limit)]));
}

function gitMerge(args: Record<string, unknown>): string {
  const branch = assertValidRef(args.branch, 'branch');
  const strategy = (args.strategy as string) || 'merge';

  switch (strategy) {
    case 'squash':
      return format(runGit(['merge', '--squash', branch]));
    case 'rebase':
      return format(runGit(['rebase', branch]));
    case 'merge':
      return format(runGit(['merge', branch]));
    default:
      return `Unknown strategy: ${strategy}`;
  }
}

function gitCherryPick(args: Record<string, unknown>): string {
  const commit = assertValidRef(args.commit, 'commit');
  return format(runGit(['cherry-pick', commit]));
}

// ─── Executor ────────────────────────────────────────────────

export function isGitAdvancedTool(name: string): boolean {
  return ['git_branch', 'git_stash', 'git_pr', 'git_pr_list', 'git_merge', 'git_cherry_pick'].includes(name);
}

export function executeGitAdvancedTool(name: string, args: Record<string, unknown>): string {
  try {
    switch (name) {
      case 'git_branch': return gitBranch(args);
      case 'git_stash': return gitStash(args);
      case 'git_pr': return gitPr(args);
      case 'git_pr_list': return gitPrList(args);
      case 'git_merge': return gitMerge(args);
      case 'git_cherry_pick': return gitCherryPick(args);
      default: return `Unknown git tool: ${name}`;
    }
  } catch (e) {
    return `Git tool error: ${(e as Error).message}`;
  }
}
