/**
 * State Manager — 状态管理
 * 
 * 管理 .bobo/state/ 目录下的所有状态文件
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * 状态目录结构
 * 
 * .bobo/
 *   state/
 *     sessions/
 *       <session-id>/
 *         context.json
 *         history.jsonl
 *     active-workflows.json
 */

export interface SessionState {
  sessionId: string;
  startedAt: string;
  lastActiveAt: string;
  model: string;
  effort: string;
  permissionMode: string;
  messageCount: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  activeWorkflows: string[];
  matchedSkills: string[];
}

export interface WorkflowState {
  workflowId: string;
  type: 'team' | 'interview' | 'verify' | 'plan';
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  sessionId: string;
  metadata: Record<string, unknown>;
}

/**
 * 获取状态根目录
 */
export function getStateRoot(): string {
  return join(process.cwd(), '.bobo', 'state');
}

/**
 * 获取用户级状态目录
 */
export function getUserStateRoot(): string {
  return join(homedir(), '.bobo', 'state');
}

/**
 * 确保目录存在
 */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 获取 session 状态目录
 */
export function getSessionDir(sessionId: string): string {
  const dir = join(getStateRoot(), 'sessions', sessionId);
  ensureDir(dir);
  return dir;
}

/**
 * 读取 session 状态
 */
export function readSessionState(sessionId: string): SessionState | null {
  const contextPath = join(getSessionDir(sessionId), 'context.json');
  if (!existsSync(contextPath)) return null;

  try {
    const content = readFileSync(contextPath, 'utf-8');
    return JSON.parse(content);
  } catch (_) {
    /* intentionally ignored: state file missing or malformed */
    return null;
  }
}

/**
 * 写入 session 状态
 */
export function writeSessionState(sessionId: string, state: SessionState): void {
  const contextPath = join(getSessionDir(sessionId), 'context.json');
  writeFileSync(contextPath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * 追加 session 历史（JSONL 格式）
 */
export function appendSessionHistory(sessionId: string, entry: Record<string, unknown>): void {
  const historyPath = join(getSessionDir(sessionId), 'history.jsonl');
  const line = JSON.stringify(entry) + '\n';
  
  if (existsSync(historyPath)) {
    const existing = readFileSync(historyPath, 'utf-8');
    writeFileSync(historyPath, existing + line, 'utf-8');
  } else {
    writeFileSync(historyPath, line, 'utf-8');
  }
}

/**
 * 读取活跃 workflows
 */
export function readActiveWorkflows(): WorkflowState[] {
  const path = join(getStateRoot(), 'active-workflows.json');
  if (!existsSync(path)) return [];

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (_) {
    /* intentionally ignored: state file missing or malformed */
    return [];
  }
}

/**
 * 写入活跃 workflows
 */
export function writeActiveWorkflows(workflows: WorkflowState[]): void {
  ensureDir(getStateRoot());
  const path = join(getStateRoot(), 'active-workflows.json');
  writeFileSync(path, JSON.stringify(workflows, null, 2), 'utf-8');
}

/**
 * 添加 workflow
 */
export function addWorkflow(workflow: WorkflowState): void {
  const workflows = readActiveWorkflows();
  workflows.push(workflow);
  writeActiveWorkflows(workflows);
}

/**
 * 更新 workflow 状态
 */
export function updateWorkflow(workflowId: string, updates: Partial<WorkflowState>): void {
  const workflows = readActiveWorkflows();
  const index = workflows.findIndex(w => w.workflowId === workflowId);
  if (index !== -1) {
    workflows[index] = { ...workflows[index], ...updates };
    writeActiveWorkflows(workflows);
  }
}

/**
 * 移除 workflow
 */
export function removeWorkflow(workflowId: string): void {
  const workflows = readActiveWorkflows();
  const filtered = workflows.filter(w => w.workflowId !== workflowId);
  writeActiveWorkflows(filtered);
}

/**
 * 获取 session 的活跃 workflows
 */
export function getSessionWorkflows(sessionId: string): WorkflowState[] {
  const workflows = readActiveWorkflows();
  return workflows.filter(w => w.sessionId === sessionId);
}
