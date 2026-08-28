import { execFile } from 'node:child_process';
import { config } from '../config.js';
import { SpicetifyError } from './errors.js';

let operationInProgress = null;

function execSpicetify(args) {
  return new Promise((resolve, reject) => {
    execFile(config.spicetify.exePath, args, { timeout: 60_000 }, (error, stdout, stderr) => {
      const out = stdout?.toString() ?? '';
      const err = stderr?.toString() ?? '';
      resolve({
        exitCode: error ? (error.code ?? 1) : 0,
        stdout: out,
        stderr: err,
        timedOut: Boolean(error?.killed && error?.signal === 'SIGTERM')
      });
    });
  });
}

function detectVersionMismatch(result) {
  const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return combined.includes('version') && combined.includes('mismatch');
}

async function withLock(operationName, fn) {
  if (operationInProgress) {
    throw new SpicetifyError(
      'operation_in_progress',
      `Outra operação Spicetify (${operationInProgress}) já está em andamento.`,
      { current: operationInProgress }
    );
  }
  operationInProgress = operationName;
  try {
    return await fn();
  } finally {
    operationInProgress = null;
  }
}

export function currentOperation() {
  return operationInProgress;
}

// taskkill exit code 128 means "process not found" (already closed) — not a real failure.
export async function closeSpotify() {
  return new Promise((resolve) => {
    execFile('taskkill', ['/IM', 'Spotify.exe', '/F'], { timeout: 10_000 }, (error, stdout, stderr) => {
      resolve({
        exitCode: error ? (error.code ?? 1) : 0,
        stdout: stdout?.toString() ?? '',
        stderr: stderr?.toString() ?? ''
      });
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mirrors the manual sequence proven throughout development: kill, then give the OS a
// moment to release file handles before Spicetify touches the same files.
export async function closeSpotifyAndWait() {
  const result = await closeSpotify();
  await delay(1500);
  return result;
}

export async function runApply() {
  return withLock('apply', async () => {
    const result = await execSpicetify(['apply']);
    return { ...result, versionMismatch: detectVersionMismatch(result) };
  });
}

export async function runRestore() {
  return withLock('restore', async () => {
    const result = await execSpicetify(['restore']);
    return { ...result, versionMismatch: detectVersionMismatch(result) };
  });
}

export async function runBackup() {
  return withLock('backup', async () => {
    return execSpicetify(['backup']);
  });
}

export async function runBackupApply() {
  return withLock('backup_apply', async () => {
    return execSpicetify(['backup', 'apply']);
  });
}
