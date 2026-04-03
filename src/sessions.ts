/**
 * Session persistence — save/restore conversation history.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatCompletionMessageParam } from 'openai/resources/index.js';
import { getConfigDir } from './config.js';
import { writeSessionState, appendSessionHistory, type SessionState } from './state/manager.js';

export interface Session {
  id: string;
  startedAt: string;
  updatedAt: string;
  cwd: string;
  messageCount: number;
  firstUserMessage: string;
  messages: ChatCompletionMessageParam[];
}

function getSessionsDir(): string {
  return join(getConfigDir(), 'sessions');
}

function ensureSessionsDir(): void {
  const dir = getSessionsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Save current conversation to a session file.
 */
export function saveSession(messages: ChatCompletionMessageParam[], cwd: string): string {
  ensureSessionsDir();
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const firstUser = messages.find(m => m.role === 'user');
  let firstMsg = '(empty)';
  if (firstUser && typeof firstUser.content === 'string') {
    firstMsg = firstUser.content.slice(0, 100);
  }

  const session: Session = {
    id,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cwd,
    messageCount: messages.length,
    firstUserMessage: firstMsg,
    messages,
  };

  const path = join(getSessionsDir(), `${id}.json`);
  writeFileSync(path, JSON.stringify(session, null, 2));

  // Sync to new state layer for recovery and HUD
  const stateEntry: SessionState = {
    sessionId: id,
    startedAt: session.startedAt,
    lastActiveAt: session.updatedAt,
    model: 'unknown',
    effort: 'medium',
    permissionMode: 'auto',
    messageCount: session.messageCount,
    tokenUsage: { input: 0, output: 0, total: 0 },
    activeWorkflows: [],
    matchedSkills: [],
  };
  try {
    writeSessionState(id, stateEntry);
    appendSessionHistory(id, {
      event: 'session_saved',
      timestamp: new Date().toISOString(),
      messageCount: session.messageCount,
    });
  } catch { /* state layer write is best-effort */ }

  return id;
}

/**
 * List recent sessions (newest first).
 */
export function listSessions(limit = 10): Omit<Session, 'messages'>[] {
  ensureSessionsDir();
  const dir = getSessionsDir();
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map(f => {
    try {
      const raw = readFileSync(join(dir, f), 'utf-8');
      const session: Session = JSON.parse(raw);
      // Return without messages for listing
      return {
        id: session.id,
        startedAt: session.startedAt,
        updatedAt: session.updatedAt,
        cwd: session.cwd,
        messageCount: session.messageCount,
        firstUserMessage: session.firstUserMessage,
      };
    } catch {
      return {
        id: f.replace('.json', ''),
        startedAt: '',
        updatedAt: '',
        cwd: '',
        messageCount: 0,
        firstUserMessage: '(corrupted)',
      };
    }
  });
}

/**
 * Load a specific session by ID.
 */
export function loadSession(id: string): Session | null {
  const path = join(getSessionsDir(), `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Get the most recent session if it's less than maxAgeMs old.
 */
export function getRecentSession(maxAgeMs = 3600000): Session | null {
  const sessions = listSessions(1);
  if (sessions.length === 0) return null;
  const latest = sessions[0];
  if (!latest.updatedAt) return null;
  const age = Date.now() - new Date(latest.updatedAt).getTime();
  if (age > maxAgeMs) return null;
  return loadSession(latest.id);
}
