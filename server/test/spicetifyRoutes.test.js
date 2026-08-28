import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

// Route-contract tests: real HTTP -> real Express app -> real route logic.
// Only the Spicetify business-logic modules are mocked (detect/theme/runner/history) —
// never child_process/fs directly, and never a real spicetify.exe/taskkill/Spotify install.
const detectSpicetifyStatus = vi.fn();
const generateTheme = vi.fn();
const readCurrentThemeConfig = vi.fn();
const saveCurrentThemeConfig = vi.fn();
const runApply = vi.fn();
const runRestore = vi.fn();
const runBackup = vi.fn();
const runBackupApply = vi.fn();
const currentOperation = vi.fn();
const closeSpotifyAndWait = vi.fn();
const addHistoryEntry = vi.fn();

vi.mock('../src/lib/spicetify/detect.js', () => ({ detectSpicetifyStatus }));
vi.mock('../src/lib/spicetify/themeManager.js', () => ({
  generateTheme,
  readCurrentThemeConfig,
  saveCurrentThemeConfig
}));
vi.mock('../src/lib/spicetify/runner.js', () => ({
  runApply,
  runRestore,
  runBackup,
  runBackupApply,
  currentOperation,
  closeSpotifyAndWait
}));
vi.mock('../src/lib/historyStore.js', () => ({ addHistoryEntry }));

let server;
let baseUrl;

beforeAll(async () => {
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  vi.clearAllMocks();
  addHistoryEntry.mockImplementation((entry) => ({ id: 'hist-1', timestamp: '2026-01-01T00:00:00.000Z', ...entry }));
  currentOperation.mockReturnValue(null);
  readCurrentThemeConfig.mockReturnValue(null);
});

function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
}

function get(path) {
  return fetch(`${baseUrl}${path}`);
}

describe('GET /api/spicetify/status', () => {
  it('returns 200 with the real detection result plus lock/theme-config fields', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: false, backupAvailable: true });
    const res = await get('/api/spicetify/status');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ installed: true, spotifyRunning: false, backupAvailable: true, operationInProgress: null });
    expect(body).toHaveProperty('savedThemeConfig');
  });

  it('never overrides a real "not installed" result with a fabricated ready state', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: false, spotifyRunning: false, backupAvailable: false });
    const body = await (await get('/api/spicetify/status')).json();
    expect(body.installed).toBe(false);
  });
});

describe('POST /api/spicetify/theme', () => {
  it('passes the exact request body through to generateTheme and returns its real result', async () => {
    generateTheme.mockReturnValue({ themeDir: '/fake/theme', colorIniBytes: 10, userCssBytes: 20 });
    const payload = { colors: { button: '1ED760' }, backgroundDataUri: null, overlayOpacity: 0.5, blurPx: 0 };
    const res = await post('/api/spicetify/theme', payload);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, themeDir: '/fake/theme' });
    expect(generateTheme).toHaveBeenCalledWith(payload);
    expect(saveCurrentThemeConfig).toHaveBeenCalledTimes(1);
  });

  it('turns a thrown SpicetifyError into 409 with the real error code, not a fabricated 200', async () => {
    const { SpicetifyError } = await import('../src/lib/spicetify/errors.js');
    generateTheme.mockImplementation(() => {
      throw new SpicetifyError('invalid_color', 'Cor inválida');
    });
    const res = await post('/api/spicetify/theme', { colors: { button: 'zzzzzz' } });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('invalid_color');
    expect(saveCurrentThemeConfig).not.toHaveBeenCalled();
  });
});

describe('POST /api/spicetify/apply', () => {
  it('rejects when Spicetify itself is not installed, without ever calling runApply', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: false, spotifyRunning: false });
    const res = await post('/api/spicetify/apply', {});
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('spicetify_not_installed');
    expect(runApply).not.toHaveBeenCalled();
  });

  it('applies directly when Spotify is not running, without touching closeSpotifyAndWait', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: false });
    runApply.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', versionMismatch: false });
    const res = await post('/api/spicetify/apply', {});
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(closeSpotifyAndWait).not.toHaveBeenCalled();
    expect(runApply).toHaveBeenCalledTimes(1);
  });

  it('Spotify running + confirmClose:false -> 409 spotify_running, and never closes or applies', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: true });
    const res = await post('/api/spicetify/apply', { confirmClose: false });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('spotify_running');
    expect(closeSpotifyAndWait).not.toHaveBeenCalled();
    expect(runApply).not.toHaveBeenCalled();
  });

  it('Spotify running + confirmClose:true -> closes Spotify BEFORE applying, in that exact order', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: true });
    closeSpotifyAndWait.mockResolvedValue({ exitCode: 0 });
    runApply.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', versionMismatch: false });
    const res = await post('/api/spicetify/apply', { confirmClose: true });
    expect(res.status).toBe(200);
    expect(closeSpotifyAndWait).toHaveBeenCalledTimes(1);
    expect(runApply).toHaveBeenCalledTimes(1);
    const closeOrder = closeSpotifyAndWait.mock.invocationCallOrder[0];
    const applyOrder = runApply.mock.invocationCallOrder[0];
    expect(closeOrder).toBeLessThan(applyOrder);
  });

  it('a version mismatch is reported as 409 backup_incompatible and logged as a failure, never a fabricated success', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: false });
    runApply.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'version mismatch', versionMismatch: true });
    const res = await post('/api/spicetify/apply', {});
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('backup_incompatible');
    expect(addHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'apply', result: 'failure' }));
  });

  it('a non-zero exit code without version mismatch is still HTTP 200 with ok:false — never masked as success, never a 500', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: false });
    runApply.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'boom', versionMismatch: false });
    const res = await post('/api/spicetify/apply', {});
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(false);
    expect(addHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({ result: 'failure' }));
  });

  it('a lock error from runApply (operation already in progress) surfaces as 409 with its real code, and records no history', async () => {
    const { SpicetifyError } = await import('../src/lib/spicetify/errors.js');
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: false });
    runApply.mockRejectedValue(new SpicetifyError('operation_in_progress', 'Outra operação já está em andamento.'));
    const res = await post('/api/spicetify/apply', {});
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('operation_in_progress');
    expect(addHistoryEntry).not.toHaveBeenCalled();
  });

  it('a malformed JSON body never reaches the route handler and is reported as a real 400 (fixed in Fase 25 — the shared errorHandler now forwards body-parser\'s real status instead of always answering 500)', async () => {
    const res = await fetch(`${baseUrl}/api/spicetify/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json'
    });
    expect(res.status).toBe(400);
    expect(runApply).not.toHaveBeenCalled();
  });
});

describe('POST /api/spicetify/restore', () => {
  it('rejects when there is no backup available, without ever calling runRestore', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: false, backupAvailable: false });
    const res = await post('/api/spicetify/restore', {});
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('no_backup');
    expect(runRestore).not.toHaveBeenCalled();
  });

  it('Spotify running + confirmClose:false -> 409 spotify_running, never closes or restores', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: true, backupAvailable: true });
    const res = await post('/api/spicetify/restore', { confirmClose: false });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('spotify_running');
    expect(closeSpotifyAndWait).not.toHaveBeenCalled();
    expect(runRestore).not.toHaveBeenCalled();
  });

  it('Spotify running + confirmClose:true -> closes Spotify BEFORE restoring, in that exact order', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: true, backupAvailable: true });
    closeSpotifyAndWait.mockResolvedValue({ exitCode: 0 });
    runRestore.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '', versionMismatch: false });
    const res = await post('/api/spicetify/restore', { confirmClose: true });
    expect(res.status).toBe(200);
    const closeOrder = closeSpotifyAndWait.mock.invocationCallOrder[0];
    const restoreOrder = runRestore.mock.invocationCallOrder[0];
    expect(closeOrder).toBeLessThan(restoreOrder);
  });

  it('a version mismatch on restore is reported as 409 backup_incompatible and logged as failure', async () => {
    detectSpicetifyStatus.mockResolvedValue({ installed: true, spotifyRunning: false, backupAvailable: true });
    runRestore.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'mismatch', versionMismatch: true });
    const res = await post('/api/spicetify/restore', {});
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('backup_incompatible');
    expect(addHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'restore', result: 'failure' }));
  });
});

describe('POST /api/spicetify/backup', () => {
  it('regenerate:false calls runBackup, never runBackupApply', async () => {
    runBackup.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    const res = await post('/api/spicetify/backup', { regenerate: false });
    expect(res.status).toBe(200);
    expect(runBackup).toHaveBeenCalledTimes(1);
    expect(runBackupApply).not.toHaveBeenCalled();
    expect(addHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'backup' }));
  });

  it('regenerate:true calls runBackupApply, never plain runBackup', async () => {
    runBackupApply.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    const res = await post('/api/spicetify/backup', { regenerate: true });
    expect(res.status).toBe(200);
    expect(runBackupApply).toHaveBeenCalledTimes(1);
    expect(runBackup).not.toHaveBeenCalled();
    expect(addHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'backup_apply' }));
  });

  it('a real execution failure is reported as ok:false, never masked as success', async () => {
    runBackup.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'disk full' });
    const res = await post('/api/spicetify/backup', {});
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(false);
    expect(addHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({ result: 'failure' }));
  });
});
