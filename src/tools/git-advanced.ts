/**
 * Enhanced Git tools — PR workflow, branch management, stash.
 * Solves: "Git 操作较基础"
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { ChatCompletionTool } from 'openai/resources/index.js';

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

function run(cmd: string, timeout = 15000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    const output = ((err.stderr || '') + '\n' + (err.stdout || '')).trim();
    return output || (e as Error).message;
  }
}

function gitBranch(args: Record<string, unknown>): string {
  const action = args.action as string;
  const name = args.name as string;

  switch (action) {
    case 'list':
      return run('git branch -a --sort=-committerdate');
    case 'create': {
      const from = args.from as string || '';
      const base = from ? ` ${from}` : '';
      return run(`git checkout -b ${name}${base}`);
    }
    case 'switch':
      return run(`git checkout ${name}`);
    case 'delete':
      return run(`git branch -d ${name}`);
    default:
      return `Unknown action: ${action}`;
  }
}

function gitStash(args: Record<string, unknown>): string {
  const action = args.action as string;
  switch (action) {
    case 'push': {
      const msg = args.message as string;
      return msg ? run(`git stash push -m "${msg}"`) : run('git stash push');
    }
    case 'pop': return run('git stash pop');
    case 'list': return run('git stash list') || '(no stashes)';
    case 'drop': return run('git stash drop');
    default: return `Unknown action: ${action}`;
  }
}

function gitPr(args: Record<string, unknown>): string {
  const title = args.title as string;
  const body = args.body as string || '';
  const base = args.base as string || 'main';
  const draft = args.draft as boolean || false;

  let cmd = `gh pr create --title "${title.replace(/"/g, '\\"')}" --base ${base}`;
  if (body) cmd += ` --body "${body.replace(/"/g, '\\"')}"`;
  if (draft) cmd += ' --draft';

  return run(cmd, 30000);
}

function gitPrList(args: Record<string, unknown>): string {
  const state = args.state as string || 'open';
  const limit = args.limit as number || 10;
  return run(`gh pr list --state ${state} --limit ${limit}`);
}

function gitMerge(args: Record<string, unknown>): string {
  const branch = args.branch as string;
  const strategy = args.strategy as string || 'merge';

  switch (strategy) {
    case 'squash': return run(`git merge --squash ${branch}`);
    case 'rebase': return run(`git rebase ${branch}`);
    default: return run(`git merge ${branch}`);
  }
}

function gitCherryPick(args: Record<string, unknown>): string {
  return run(`git cherry-pick ${args.commit as string}`);
}

// ─── Executor ────────────────────────────────────────────────

export function isGitAdvancedTool(name: string): boolean {
  return ['git_branch', 'git_stash', 'git_pr', 'git_pr_list', 'git_merge', 'git_cherry_pick'].includes(name);
}

export function executeGitAdvancedTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'git_branch': return gitBranch(args);
    case 'git_stash': return gitStash(args);
    case 'git_pr': return gitPr(args);
    case 'git_pr_list': return gitPrList(args);
    case 'git_merge': return gitMerge(args);
    case 'git_cherry_pick': return gitCherryPick(args);
    default: return `Unknown git tool: ${name}`;
  }
}
