/**
 * Artifacts Manager — 产物管理
 * 
 * 管理 .bobo/artifacts/ 目录下的所有产物文件
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 产物目录结构
 * 
 * .bobo/
 *   artifacts/
 *     plans/
 *       plan-<timestamp>.md
 *       prd-<timestamp>.md
 *     research/
 *       research-<topic>-<timestamp>.md
 *     ask/
 *       ask-<model>-<timestamp>.md
 */

export type ArtifactType = 'plans' | 'research' | 'ask' | 'verify' | 'team';

/**
 * 获取产物根目录
 */
export function getArtifactsRoot(): string {
  return join(process.cwd(), '.bobo', 'artifacts');
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
 * 获取产物类型目录
 */
export function getArtifactDir(type: ArtifactType): string {
  const dir = join(getArtifactsRoot(), type);
  ensureDir(dir);
  return dir;
}

/**
 * 写入产物
 */
export function writeArtifact(type: ArtifactType, filename: string, content: string): string {
  const dir = getArtifactDir(type);
  const path = join(dir, filename);
  writeFileSync(path, content, 'utf-8');
  return path;
}

/**
 * 读取产物
 */
export function readArtifact(type: ArtifactType, filename: string): string | null {
  const path = join(getArtifactDir(type), filename);
  if (!existsSync(path)) return null;

  try {
    return readFileSync(path, 'utf-8');
  } catch (_) {
    /* intentionally ignored: artifacts file missing or malformed */
    return null;
  }
}

/**
 * 列出产物
 */
export function listArtifacts(type: ArtifactType): string[] {
  const dir = getArtifactDir(type);
  if (!existsSync(dir)) return [];

  try {
    return readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.json'));
  } catch (_) {
    /* intentionally ignored: artifacts file missing or malformed */
    return [];
  }
}

/**
 * 生成带时间戳的文件名
 */
export function generateFilename(prefix: string, ext: string = 'md'): string {
  const timestamp = Date.now();
  return `${prefix}-${timestamp}.${ext}`;
}

/**
 * 写入 plan 产物
 */
export function writePlan(content: string): string {
  const filename = generateFilename('plan');
  return writeArtifact('plans', filename, content);
}

/**
 * 写入 PRD 产物
 */
export function writePRD(content: string): string {
  const filename = generateFilename('prd');
  return writeArtifact('plans', filename, content);
}

/**
 * 写入 research 产物
 */
export function writeResearch(topic: string, content: string): string {
  const filename = generateFilename(`research-${topic.replace(/\s+/g, '-')}`);
  return writeArtifact('research', filename, content);
}

/**
 * 写入 ask 产物
 */
export function writeAsk(model: string, content: string): string {
  const filename = generateFilename(`ask-${model}`);
  return writeArtifact('ask', filename, content);
}

/**
 * 写入 verify 产物
 */
export function writeVerify(content: string): string {
  const filename = generateFilename('verify');
  return writeArtifact('verify', filename, content);
}

/**
 * 写入 team 产物
 */
export function writeTeam(content: string): string {
  const filename = generateFilename('team');
  return writeArtifact('team', filename, content);
}

/**
 * 获取最新产物
 */
export function getLatestArtifact(type: ArtifactType): string | null {
  const files = listArtifacts(type);
  if (files.length === 0) return null;

  // 按时间戳排序（文件名格式: prefix-<timestamp>.md）
  const sorted = files.sort((a, b) => {
    const aTime = parseInt(a.split('-').pop()?.split('.')[0] || '0');
    const bTime = parseInt(b.split('-').pop()?.split('.')[0] || '0');
    return bTime - aTime;
  });

  return readArtifact(type, sorted[0]);
}
