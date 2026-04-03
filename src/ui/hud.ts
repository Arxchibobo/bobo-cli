/**
 * HUD — 轻量状态显示
 * 
 * 在 CLI 交互模式下，显示当前 agent 状态、活跃 workflow、token 用量
 */

import chalk from 'chalk';
import { readActiveWorkflows } from '../state/manager.js';

export interface HUDState {
  sessionId: string;
  model: string;
  effort: string;
  activeAgents: string[];
  completedTasks: number;
  totalTasks: number;
  tokenUsage: { input: number; output: number };
}

/**
 * 渲染单行 HUD
 */
export function renderHUD(state: HUDState): string {
  const agents = state.activeAgents.length > 0
    ? state.activeAgents.map(a => chalk.cyan(a)).join(', ')
    : chalk.dim('idle');

  const progress = state.totalTasks > 0
    ? `${state.completedTasks}/${state.totalTasks}`
    : '-';

  const tokens = state.tokenUsage.input + state.tokenUsage.output > 0
    ? `${formatTokens(state.tokenUsage.input)}↓ ${formatTokens(state.tokenUsage.output)}↑`
    : '';

  const workflows = readActiveWorkflows();
  const workflowStr = workflows.length > 0
    ? chalk.yellow(` wf:${workflows.length}`)
    : '';

  return chalk.dim('[') +
    chalk.bold(state.model) +
    chalk.dim('/') +
    state.effort +
    chalk.dim('] ') +
    agents +
    chalk.dim(` ${progress}`) +
    workflowStr +
    (tokens ? chalk.dim(` ${tokens}`) : '');
}

/**
 * 渲染详细状态面板
 */
export function renderStatusPanel(state: HUDState): string {
  const lines: string[] = [
    chalk.cyan.bold('─'.repeat(50)),
    `  ${chalk.bold('Session:')} ${state.sessionId}`,
    `  ${chalk.bold('Model:')}   ${state.model} (${state.effort})`,
    `  ${chalk.bold('Agents:')}  ${state.activeAgents.length > 0 ? state.activeAgents.join(', ') : 'none'}`,
    `  ${chalk.bold('Tasks:')}   ${state.completedTasks}/${state.totalTasks}`,
  ];

  if (state.tokenUsage.input + state.tokenUsage.output > 0) {
    lines.push(`  ${chalk.bold('Tokens:')}  ${formatTokens(state.tokenUsage.input)} in / ${formatTokens(state.tokenUsage.output)} out`);
  }

  const workflows = readActiveWorkflows();
  if (workflows.length > 0) {
    lines.push(`  ${chalk.bold('Workflows:')}`);
    for (const w of workflows) {
      const icon = w.status === 'completed' ? '✅' : w.status === 'failed' ? '❌' : '⏳';
      lines.push(`    ${icon} ${w.type} (${w.status})`);
    }
  }

  lines.push(chalk.cyan.bold('─'.repeat(50)));
  return lines.join('\n');
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
