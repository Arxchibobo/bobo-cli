/**
 * Project Memory — 项目级记忆
 * 
 * .bobo/project-memory.json — 结构化项目记忆
 * .bobo/notepad.md — 自由格式 scratchpad
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_MEMORY_FILE = 'project-memory.json';
const NOTEPAD_FILE = 'notepad.md';

function getProjectDir(): string {
  return join(process.cwd(), '.bobo');
}

// ─── Project Memory (structured) ────────────────────────────

export interface ProjectMemoryEntry {
  key: string;
  value: string;
  category: 'architecture' | 'decision' | 'convention' | 'gotcha' | 'todo';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemory {
  version: number;
  entries: ProjectMemoryEntry[];
}

function getProjectMemoryPath(): string {
  return join(getProjectDir(), PROJECT_MEMORY_FILE);
}

export function readProjectMemory(): ProjectMemory {
  const path = getProjectMemoryPath();
  if (!existsSync(path)) {
    return { version: 1, entries: [] };
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { version: 1, entries: [] };
  }
}

export function writeProjectMemory(memory: ProjectMemory): void {
  writeFileSync(getProjectMemoryPath(), JSON.stringify(memory, null, 2) + '\n', 'utf-8');
}

export function addMemoryEntry(entry: Omit<ProjectMemoryEntry, 'createdAt' | 'updatedAt'>): void {
  const memory = readProjectMemory();
  const now = new Date().toISOString();

  const existing = memory.entries.findIndex(e => e.key === entry.key);
  if (existing !== -1) {
    memory.entries[existing] = { ...entry, createdAt: memory.entries[existing].createdAt, updatedAt: now };
  } else {
    memory.entries.push({ ...entry, createdAt: now, updatedAt: now });
  }

  writeProjectMemory(memory);
}

export function queryMemory(category?: string, keyword?: string): ProjectMemoryEntry[] {
  const memory = readProjectMemory();
  let results = memory.entries;

  if (category) {
    results = results.filter(e => e.category === category);
  }

  if (keyword) {
    const lower = keyword.toLowerCase();
    results = results.filter(e =>
      e.key.toLowerCase().includes(lower) ||
      e.value.toLowerCase().includes(lower)
    );
  }

  return results;
}

// ─── Notepad (freeform scratchpad) ──────────────────────────

function getNotepadPath(): string {
  return join(getProjectDir(), NOTEPAD_FILE);
}

export function readNotepad(): string {
  const path = getNotepadPath();
  if (!existsSync(path)) return '';
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

export function writeNotepad(content: string): void {
  writeFileSync(getNotepadPath(), content, 'utf-8');
}

export function appendNotepad(text: string): void {
  const existing = readNotepad();
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const entry = `\n## ${timestamp}\n\n${text}\n`;
  writeNotepad(existing + entry);
}
