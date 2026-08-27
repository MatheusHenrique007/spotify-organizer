import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({ files: new Map() }));

vi.mock('node:fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    existsSync: (path) => store.files.has(path),
    readFileSync: (path) => store.files.get(path),
    writeFileSync: (path, data) => store.files.set(path, data)
  }
}));

describe('historyStore — details field propagation (contract test, no Spotify involved)', () => {
  let addHistoryEntry;
  let listHistory;
  let getHistoryEntry;

  beforeEach(async () => {
    store.files.clear();
    vi.resetModules();
    const mod = await import('../src/lib/historyStore.js');
    addHistoryEntry = mod.addHistoryEntry;
    listHistory = mod.listHistory;
    getHistoryEntry = mod.getHistoryEntry;
  });

  it('preserves dedupe_tracks/remove_tracks details (uris, attempts, retryPerformed, verificationPassed, snapshotsUsed) through the JSON persistence round-trip', () => {
    const details = {
      uris: ['spotify:track:X'],
      attempts: 2,
      retryPerformed: true,
      verificationPassed: false,
      snapshotsUsed: ['snap-1', 'snap-2']
    };
    const results = [
      {
        success: false,
        operationId: 'op-1',
        type: 'dedupe_tracks',
        error: 'Spotify accepted the removal request but the track(s) were still present after a retry with a freshly read snapshot.',
        details
      }
    ];

    const record = addHistoryEntry({ planId: 'plan-1', operationCount: 1, results });

    expect(listHistory()[0].results[0].details).toEqual(details);
    expect(getHistoryEntry(record.id).results[0].details).toEqual(details);
  });

  it('does not fabricate a details field for operations that never produced one (e.g. add_tracks)', () => {
    const results = [{ success: true, operationId: 'op-2', type: 'add_tracks', snapshotId: 'snap-x' }];
    addHistoryEntry({ planId: 'plan-2', operationCount: 1, results });

    expect(listHistory()[0].results[0].details).toBeUndefined();
  });
});
