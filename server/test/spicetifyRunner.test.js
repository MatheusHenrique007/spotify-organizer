import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: execFileMock
}));

vi.mock('../src/lib/config.js', () => ({
  config: {
    spicetify: {
      exePath: 'C:/fake/spicetify.exe',
      configFile: 'C:/fake/config-xpui.ini',
      themesDir: 'C:/fake/Themes',
      backupDir: 'C:/fake/Backup',
      themeName: 'SpotifyOrganizer',
      maxCssBytes: 2 * 1024 * 1024
    }
  }
}));

describe('spicetify runner — never shells out with concatenated input', () => {
  let runApply;
  let runRestore;
  let currentOperation;
  let closeSpotify;
  let closeSpotifyAndWait;

  beforeEach(async () => {
    execFileMock.mockReset();
    vi.resetModules();
    const mod = await import('../src/lib/spicetify/runner.js');
    runApply = mod.runApply;
    runRestore = mod.runRestore;
    currentOperation = mod.currentOperation;
    closeSpotify = mod.closeSpotify;
    closeSpotifyAndWait = mod.closeSpotifyAndWait;
  });

  it('calls execFile with an argv array, never a shell string', async () => {
    execFileMock.mockImplementation((exe, args, opts, cb) => cb(null, 'ok', ''));
    await runApply();
    expect(execFileMock).toHaveBeenCalledWith('C:/fake/spicetify.exe', ['apply'], expect.any(Object), expect.any(Function));
  });

  it('detects a version mismatch from stdout/stderr text', async () => {
    execFileMock.mockImplementation((exe, args, opts, cb) =>
      cb({ code: 1 }, '', 'warning: Spotify version and backup version are mismatched.')
    );
    const result = await runRestore();
    expect(result.versionMismatch).toBe(true);
    expect(result.exitCode).toBe(1);
  });

  it('rejects a second operation while one is already in progress', async () => {
    let releaseFirst;
    execFileMock.mockImplementation((exe, args, opts, cb) => {
      new Promise((resolve) => {
        releaseFirst = resolve;
      }).then(() => cb(null, 'ok', ''));
    });

    const first = runApply();
    await expect(runRestore()).rejects.toThrow(/já está em andamento/);
    releaseFirst();
    await first;
    expect(currentOperation()).toBeNull();
  });
});

describe('closeSpotify — the real fix for "Fechar Spotify e aplicar" actually closing Spotify', () => {
  let closeSpotify;
  let closeSpotifyAndWait;

  beforeEach(async () => {
    execFileMock.mockReset();
    vi.resetModules();
    vi.useFakeTimers();
    const mod = await import('../src/lib/spicetify/runner.js');
    closeSpotify = mod.closeSpotify;
    closeSpotifyAndWait = mod.closeSpotifyAndWait;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls taskkill with the real argv, never Spotify.exe itself and never a shell string', async () => {
    execFileMock.mockImplementation((exe, args, opts, cb) => cb(null, 'SUCCESS', ''));
    await closeSpotify();
    expect(execFileMock).toHaveBeenCalledWith('taskkill', ['/IM', 'Spotify.exe', '/F'], expect.any(Object), expect.any(Function));
  });

  it('treats "process not found" (already closed) as a non-throwing result, not a crash', async () => {
    execFileMock.mockImplementation((exe, args, opts, cb) => cb({ code: 128 }, '', 'ERROR: not found'));
    const result = await closeSpotify();
    expect(result.exitCode).toBe(128);
  });

  it('closeSpotifyAndWait waits after killing before resolving, so Spicetify does not race file handles', async () => {
    execFileMock.mockImplementation((exe, args, opts, cb) => cb(null, 'SUCCESS', ''));
    let resolved = false;
    const promise = closeSpotifyAndWait().then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1500);
    await promise;
    expect(resolved).toBe(true);
  });
});
