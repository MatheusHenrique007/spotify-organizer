import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from './config.js';

function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function readAll() {
  if (!fs.existsSync(config.historyFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(config.historyFile, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(entries) {
  ensureDataDir();
  fs.writeFileSync(config.historyFile, JSON.stringify(entries, null, 2), 'utf8');
}

export function addHistoryEntry(entry) {
  const entries = readAll();
  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry
  };
  entries.unshift(record);
  writeAll(entries.slice(0, 500));
  return record;
}

export function listHistory() {
  return readAll();
}

export function getHistoryEntry(id) {
  return readAll().find((entry) => entry.id === id) || null;
}
