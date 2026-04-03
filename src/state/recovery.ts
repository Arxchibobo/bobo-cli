/**
 * State Recovery — 会话恢复
 * 
 * 从 .bobo/state/sessions/ 恢复之前的会话上下文
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getStateRoot, type SessionState, type WorkflowState, readActiveWorkflows } from './manager.js';

export interface RecoveryContext {
  lastSession: SessionState | null;
  activeWorkflows: WorkflowState[];
  recentSessions: SessionState[];
  summary: string;
}

/**
 * 恢复最近的会话上下文
 */
export function recoverContext(): RecoveryContext {
  const sessionsDir = join(getStateRoot(), 'sessions');
  if (!existsSync(sessionsDir)) {
    return {
      lastSession: null,
      activeWorkflows: [],
      recentSessions: [],
      summary: 'No previous sessions found.',
    };
  }

  const sessionDirs = readdirSync(sessionsDir).sort().reverse();
  const recentSessions: SessionState[] = [];

  for (const dir of sessionDirs.slice(0, 5)) {
    const contextPath = join(sessionsDir, dir, 'context.json');
    if (!existsSync(contextPath)) continue;

    try {
      const state: SessionState = JSON.parse(readFileSync(contextPath, 'utf-8'));
      recentSessions.push(state);
    } catch { continue; }
  }

  const lastSession = recentSessions[0] ?? null;
  const activeWorkflows = readActiveWorkflows();

  const parts: string[] = [];
  if (lastSession) {
    parts.push(`Last session: ${lastSession.sessionId} (${lastSession.messageCount} messages, ${lastSession.lastActiveAt})`);
  }
  if (activeWorkflows.length > 0) {
    parts.push(`Active workflows: ${activeWorkflows.map(w => `${w.type}[${w.status}]`).join(', ')}`);
  }
  if (parts.length === 0) {
    parts.push('Clean slate — no previous context.');
  }

  return {
    lastSession,
    activeWorkflows,
    recentSessions,
    summary: parts.join('\n'),
  };
}

/**
 * 获取最近 session 的历史行
 */
export function getRecentHistory(sessionId: string, maxLines = 50): string[] {
  const historyPath = join(getStateRoot(), 'sessions', sessionId, 'history.jsonl');
  if (!existsSync(historyPath)) return [];

  try {
    const content = readFileSync(historyPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

/**
 * 生成恢复 prompt（注入到新 session 开头）
 */
export function buildRecoveryPrompt(): string {
  const ctx = recoverContext();
  if (!ctx.lastSession) return '';

  const parts = [
    '# Session Recovery',
    '',
    ctx.summary,
  ];

  if (ctx.lastSession.matchedSkills.length > 0) {
    parts.push(`\nPrevious skills: ${ctx.lastSession.matchedSkills.join(', ')}`);
  }

  if (ctx.activeWorkflows.length > 0) {
    parts.push('\n## Active Workflows');
    for (const w of ctx.activeWorkflows) {
      parts.push(`- ${w.type} (${w.status}) started ${w.startedAt}`);
    }
  }

  return parts.join('\n');
}
