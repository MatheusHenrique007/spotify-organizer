import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOperation } from '../src/lib/planner.js';
import { executeOperation, executePlan } from '../src/lib/executor.js';

const { spotifyFetch, SpotifyApiError } = vi.hoisted(() => {
  class SpotifyApiError extends Error {
    constructor(status, message) {
      super(message);
      this.name = 'SpotifyApiError';
      this.status = status;
    }
  }
  return { spotifyFetch: vi.fn(), SpotifyApiError };
});

vi.mock('../src/lib/spotifyClient.js', () => ({
  spotifyFetch,
  SpotifyApiError,
  spotifyFetchAllPages: async (path) => {
    const page = await spotifyFetch(path);
    return page.items || [];
  }
}));

function mockSnapshotThen(writeResponse) {
  spotifyFetch.mockImplementation(async (path, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'GET' && path.includes('fields=snapshot_id')) {
      return { snapshot_id: 'snap-current' };
    }
    return writeResponse;
  });
}

beforeEach(() => {
  spotifyFetch.mockReset();
});

describe('executor — add_tracks (POST /playlists/{id}/items)', () => {
  it('calls the current /items endpoint and returns the new snapshot_id', async () => {
    spotifyFetch.mockResolvedValue({ snapshot_id: 'snap-after-add' });
    const operation = createOperation('add_tracks', {
      targetPlaylistId: 'p1',
      trackUris: ['spotify:track:1']
    });
    const result = await executeOperation(operation);

    expect(spotifyFetch).toHaveBeenCalledWith(
      '/playlists/p1/items',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ uris: ['spotify:track:1'] }) })
    );
    expect(result.success).toBe(true);
    expect(result.snapshotId).toBe('snap-after-add');
  });

  it('skips the API call entirely when there are no tracks to add', async () => {
    const operation = createOperation('add_tracks', { targetPlaylistId: 'p1', trackUris: [] });
    const result = await executeOperation(operation);
    expect(spotifyFetch).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

describe('executor — create_playlist (POST /me/playlists)', () => {
  it('sends name, description and public, and returns the new playlistId', async () => {
    spotifyFetch.mockResolvedValue({ id: 'new-playlist-id' });
    const operation = createOperation('create_playlist', {
      name: 'My New Playlist',
      description: 'A test playlist',
      isPublic: false
    });
    const result = await executeOperation(operation);

    expect(spotifyFetch).toHaveBeenCalledWith(
      '/me/playlists',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'My New Playlist', description: 'A test playlist', public: false })
      })
    );
    expect(result.success).toBe(true);
    expect(result.playlistId).toBe('new-playlist-id');
    expect(result.restoreData).toEqual({ createdPlaylistId: 'new-playlist-id' });
  });

  it('defaults isPublic to false when not provided', async () => {
    spotifyFetch.mockResolvedValue({ id: 'p2' });
    const operation = createOperation('create_playlist', { name: 'Untitled', description: '' });
    await executeOperation(operation);

    expect(spotifyFetch).toHaveBeenCalledWith(
      '/me/playlists',
      expect.objectContaining({ body: JSON.stringify({ name: 'Untitled', description: '', public: false }) })
    );
  });
});

describe('executor — change_description (PUT /playlists/{id})', () => {
  it('sends exactly { description } and reports the previous value for restore', async () => {
    spotifyFetch.mockResolvedValue({ id: 'ok' });
    const operation = createOperation('change_description', {
      playlistId: 'p1',
      newDescription: 'New description',
      previousDescription: 'Old description'
    });
    const result = await executeOperation(operation);

    expect(spotifyFetch).toHaveBeenCalledWith(
      '/playlists/p1',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ description: 'New description' }) })
    );
    expect(result.success).toBe(true);
    expect(result.restoreData).toEqual({ playlistId: 'p1', previousDescription: 'Old description' });
  });
});

describe('executor — change_cover_image (PUT /playlists/{id}/images)', () => {
  it('sends the raw base64 string as the body (not JSON-stringified) with an image/jpeg header', async () => {
    spotifyFetch.mockResolvedValue(null);
    const operation = createOperation('change_cover_image', {
      playlistId: 'p1',
      base64Jpeg: 'ZmFrZS1iYXNlNjQtZGF0YQ=='
    });
    const result = await executeOperation(operation);

    expect(spotifyFetch).toHaveBeenCalledWith('/playlists/p1/images', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: 'ZmFrZS1iYXNlNjQtZGF0YQ=='
    });
    expect(result.success).toBe(true);
  });

  it('captures a Spotify error as a controlled failure instead of throwing', async () => {
    spotifyFetch.mockRejectedValue(new SpotifyApiError(413, 'Spotify returned 413'));
    const operation = createOperation('change_cover_image', { playlistId: 'p1', base64Jpeg: 'abc' });
    const result = await executeOperation(operation);

    expect(result.success).toBe(false);
    expect(result.error).toContain('413');
  });
});

describe('executor — rename_playlist (PUT /playlists/{id})', () => {
  it('sends exactly the newName provided in operation.params, including a user-edited value', async () => {
    spotifyFetch.mockResolvedValue({ id: 'ok' });
    const operation = createOperation('rename_playlist', {
      playlistId: 'p1',
      newName: 'Spotify Organizer TESTE - Renamed'
    });
    const result = await executeOperation(operation);

    expect(spotifyFetch).toHaveBeenCalledWith(
      '/playlists/p1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Spotify Organizer TESTE - Renamed' })
      })
    );
    expect(result.success).toBe(true);
  });
});

describe('executor — remove_tracks (DELETE /playlists/{id}/items)', () => {
  it('fetches the current snapshot_id first, then sends items+snapshot_id in the body', async () => {
    mockSnapshotThen({ snapshot_id: 'snap-after-remove' });
    const operation = createOperation('remove_tracks', {
      playlistId: 'p1',
      trackUris: ['spotify:track:1', 'spotify:track:2']
    });
    const result = await executeOperation(operation);

    expect(spotifyFetch).toHaveBeenNthCalledWith(1, '/playlists/p1?fields=snapshot_id');
    expect(spotifyFetch).toHaveBeenNthCalledWith(
      2,
      '/playlists/p1/items',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({
          items: [{ uri: 'spotify:track:1' }, { uri: 'spotify:track:2' }],
          snapshot_id: 'snap-current'
        })
      })
    );
    expect(result.success).toBe(true);
    expect(result.snapshotId).toBe('snap-after-remove');
  });
});

describe('executor — dedupe_tracks (DELETE /playlists/{id}/items)', () => {
  it('uses the same snapshot-guarded removal as remove_tracks', async () => {
    mockSnapshotThen({ snapshot_id: 'snap-after-dedupe' });
    const operation = createOperation('dedupe_tracks', {
      playlistId: 'p1',
      trackUrisToRemove: ['spotify:track:1']
    });
    const result = await executeOperation(operation);
    expect(result.success).toBe(true);
    expect(result.snapshotId).toBe('snap-after-dedupe');
  });
});

function fakeItemsPage(uris) {
  return { items: uris.map((uri) => ({ item: { uri } })), next: null };
}

describe.each([
  ['remove_tracks', (uris) => ({ playlistId: 'p1', trackUris: uris })],
  ['dedupe_tracks', (uris) => ({ playlistId: 'p1', trackUrisToRemove: uris })]
])('executor — %s post-write verification (real state, not snapshot_id equality)', (type, params) => {
  const uri = 'spotify:track:X';

  it('Scenario A: succeeds on the first attempt when the URI is really gone', async () => {
    spotifyFetch
      .mockResolvedValueOnce({ snapshot_id: 'snap-1' }) // getPlaylistSnapshotId
      .mockResolvedValueOnce({ snapshot_id: 'snap-1a' }) // DELETE
      .mockResolvedValueOnce(fakeItemsPage([])); // verification: absent

    const operation = createOperation(type, params([uri]));
    const result = await executeOperation(operation);

    expect(result.success).toBe(true);
    expect(spotifyFetch).toHaveBeenCalledTimes(3);
    expect(spotifyFetch).toHaveBeenNthCalledWith(
      2,
      '/playlists/p1/items',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ items: [{ uri }], snapshot_id: 'snap-1' })
      })
    );
    expect(result.details).toEqual({
      uris: [uri],
      attempts: 1,
      retryPerformed: false,
      verificationPassed: true,
      snapshotsUsed: ['snap-1']
    });
  });

  it('Scenario B: HTTP 2xx but URI still present triggers exactly one retry with a fresh snapshot, then succeeds', async () => {
    spotifyFetch
      .mockResolvedValueOnce({ snapshot_id: 'snap-1' }) // getPlaylistSnapshotId
      .mockResolvedValueOnce({ snapshot_id: 'snap-1a' }) // DELETE (falsely reports 2xx)
      .mockResolvedValueOnce(fakeItemsPage([uri])) // verification: still present
      .mockResolvedValueOnce({ snapshot_id: 'snap-2' }) // fresh snapshot for retry
      .mockResolvedValueOnce({ snapshot_id: 'snap-2a' }) // retry DELETE
      .mockResolvedValueOnce(fakeItemsPage([])); // verification: absent now

    const operation = createOperation(type, params([uri]));
    const result = await executeOperation(operation);

    expect(result.success).toBe(true);
    expect(result.snapshotId).toBe('snap-2a');
    expect(spotifyFetch).toHaveBeenCalledTimes(6);
    expect(spotifyFetch).toHaveBeenNthCalledWith(
      5,
      '/playlists/p1/items',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ items: [{ uri }], snapshot_id: 'snap-2' })
      })
    );
    expect(result.details).toEqual({
      uris: [uri],
      attempts: 2,
      retryPerformed: true,
      verificationPassed: true,
      snapshotsUsed: ['snap-1', 'snap-2']
    });
  });

  it('Scenario C: URI still present after the retry returns an explicit failure, never a silent success', async () => {
    spotifyFetch
      .mockResolvedValueOnce({ snapshot_id: 'snap-1' })
      .mockResolvedValueOnce({ snapshot_id: 'snap-1a' })
      .mockResolvedValueOnce(fakeItemsPage([uri]))
      .mockResolvedValueOnce({ snapshot_id: 'snap-2' })
      .mockResolvedValueOnce({ snapshot_id: 'snap-2a' })
      .mockResolvedValueOnce(fakeItemsPage([uri])); // still present after retry

    const operation = createOperation(type, params([uri]));
    const result = await executeOperation(operation);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/still present/i);

    // Exactly 6 calls: snapshot+DELETE+verify, then snapshot+DELETE+verify again — no third DELETE.
    expect(spotifyFetch).toHaveBeenCalledTimes(6);
    const deleteCalls = spotifyFetch.mock.calls.filter(([, options]) => options?.method === 'DELETE');
    expect(deleteCalls).toHaveLength(2);

    expect(result.details).toEqual({
      uris: [uri],
      attempts: 2,
      retryPerformed: true,
      verificationPassed: false,
      snapshotsUsed: ['snap-1', 'snap-2']
    });
  });

  it('never issues more than one retry even if repeatedly asked to verify', async () => {
    // Same as Scenario C — this test exists specifically to pin the "exactly one retry, never a loop" contract.
    spotifyFetch
      .mockResolvedValueOnce({ snapshot_id: 'snap-1' })
      .mockResolvedValueOnce({ snapshot_id: 'snap-1a' })
      .mockResolvedValueOnce(fakeItemsPage([uri]))
      .mockResolvedValueOnce({ snapshot_id: 'snap-2' })
      .mockResolvedValueOnce({ snapshot_id: 'snap-2a' })
      .mockResolvedValueOnce(fakeItemsPage([uri]));

    const operation = createOperation(type, params([uri]));
    await executeOperation(operation);

    const snapshotReads = spotifyFetch.mock.calls.filter(([path]) => path.includes('fields=snapshot_id'));
    expect(snapshotReads).toHaveLength(2);
  });

  it('propagates a Spotify HTTP error immediately without attempting verification or retry', async () => {
    spotifyFetch
      .mockResolvedValueOnce({ snapshot_id: 'snap-1' })
      .mockRejectedValueOnce(new SpotifyApiError(429, 'Spotify returned 429'));

    const operation = createOperation(type, params([uri]));
    const result = await executeOperation(operation);

    expect(result.success).toBe(false);
    expect(result.error).toContain('429');
    expect(spotifyFetch).toHaveBeenCalledTimes(2);
    expect(result.details).toBeUndefined();
  });
});

describe('executor — reorder_tracks (PUT /playlists/{id}/items)', () => {
  it('fetches snapshot_id and sends range params + snapshot_id', async () => {
    mockSnapshotThen({ snapshot_id: 'snap-after-reorder' });
    const operation = createOperation('reorder_tracks', {
      playlistId: 'p1',
      rangeStart: 0,
      insertBefore: 5,
      rangeLength: 2
    });
    const result = await executeOperation(operation);

    expect(spotifyFetch).toHaveBeenNthCalledWith(1, '/playlists/p1?fields=snapshot_id');
    expect(spotifyFetch).toHaveBeenNthCalledWith(
      2,
      '/playlists/p1/items',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          range_start: 0,
          insert_before: 5,
          range_length: 2,
          snapshot_id: 'snap-current'
        })
      })
    );
    expect(result.success).toBe(true);
    expect(result.snapshotId).toBe('snap-after-reorder');
  });
});

describe('executor — replace_tracks (PUT /playlists/{id}/items)', () => {
  function mockCurrentTracksThenReplace(currentUris, replaceResponse) {
    spotifyFetch.mockImplementation(async (path, options = {}) => {
      const method = (options.method || 'GET').toUpperCase();
      if (method === 'GET') {
        return { items: currentUris.map((uri) => ({ item: { uri } })), next: null };
      }
      return replaceResponse;
    });
  }

  it('reads the current track list before replacing, and captures it in restoreData', async () => {
    mockCurrentTracksThenReplace(['spotify:track:old1', 'spotify:track:old2'], {
      snapshot_id: 'snap-after-replace'
    });
    const operation = createOperation('replace_tracks', {
      playlistId: 'p1',
      trackUris: ['spotify:track:new1']
    });
    const result = await executeOperation(operation);

    expect(result.success).toBe(true);
    expect(result.restoreData).toEqual({
      playlistId: 'p1',
      previousTrackUris: ['spotify:track:old1', 'spotify:track:old2']
    });
  });

  it('reads the previous tracks before sending the replace request, in that order', async () => {
    const calls = [];
    spotifyFetch.mockImplementation(async (path, options = {}) => {
      calls.push((options.method || 'GET').toUpperCase());
      if ((options.method || 'GET').toUpperCase() === 'GET') {
        return { items: [], next: null };
      }
      return { snapshot_id: 'snap-after-replace' };
    });
    const operation = createOperation('replace_tracks', { playlistId: 'p1', trackUris: ['spotify:track:new1'] });
    await executeOperation(operation);

    expect(calls).toEqual(['GET', 'PUT']);
  });

  it('still sends a plain uris body without snapshot_id (replace and reorder are mutually exclusive)', async () => {
    mockCurrentTracksThenReplace([], { snapshot_id: 'snap-after-replace' });
    const operation = createOperation('replace_tracks', {
      playlistId: 'p1',
      trackUris: ['spotify:track:1']
    });
    const result = await executeOperation(operation);

    expect(spotifyFetch).toHaveBeenCalledWith(
      '/playlists/p1/items',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ uris: ['spotify:track:1'] }) })
    );
    expect(result.success).toBe(true);
    expect(result.snapshotId).toBe('snap-after-replace');
  });

  it('does not perform the replace when reading the current tracks fails', async () => {
    spotifyFetch.mockImplementation(async (path, options = {}) => {
      const method = (options.method || 'GET').toUpperCase();
      if (method === 'GET') {
        throw new SpotifyApiError(429, 'Spotify rate limit exceeded');
      }
      throw new Error('replace should never be attempted when the backup read fails');
    });
    const operation = createOperation('replace_tracks', { playlistId: 'p1', trackUris: ['spotify:track:new1'] });
    const result = await executeOperation(operation);

    expect(result.success).toBe(false);
    expect(result.error).toContain('rate limit');
    const putCalls = spotifyFetch.mock.calls.filter(([, options]) => (options?.method || 'GET') === 'PUT');
    expect(putCalls).toHaveLength(0);
  });

  it('never includes credentials or tokens in restoreData', async () => {
    mockCurrentTracksThenReplace(['spotify:track:old1'], { snapshot_id: 'snap-after-replace' });
    const operation = createOperation('replace_tracks', { playlistId: 'p1', trackUris: ['spotify:track:new1'] });
    const result = await executeOperation(operation);

    expect(JSON.stringify(result.restoreData)).not.toMatch(/token|secret|bearer|client_id/i);
  });
});

describe('executor — error handling', () => {
  const cases = [401, 403, 404, 429, 500];

  for (const status of cases) {
    it(`captures a ${status} Spotify error as a failed result instead of throwing`, async () => {
      spotifyFetch.mockRejectedValue(new SpotifyApiError(status, `Spotify returned ${status}`));
      const operation = createOperation('add_tracks', { targetPlaylistId: 'p1', trackUris: ['spotify:track:1'] });
      const result = await executeOperation(operation);
      expect(result.success).toBe(false);
      expect(result.error).toContain(String(status));
    });
  }
});

describe('executor — safe execution contract', () => {
  it('exposes only executeOperation and executePlan as its public API (no other write entry point)', async () => {
    const executorModule = await import('../src/lib/executor.js');
    expect(Object.keys(executorModule).sort()).toEqual(['executeOperation', 'executePlan']);
  });

  it('never calls spotifyFetch merely by importing the module (no top-level side effects)', async () => {
    spotifyFetch.mockClear();
    await import('../src/lib/executor.js');
    expect(spotifyFetch).not.toHaveBeenCalled();
  });

  it('executePlan runs every operation strictly through executeOperation, one at a time, in order', async () => {
    const callOrder = [];
    spotifyFetch.mockImplementation(async (path) => {
      callOrder.push(path);
      return { id: 'ok' };
    });
    const operations = [
      createOperation('rename_playlist', { playlistId: 'p1', newName: 'A' }),
      createOperation('change_description', { playlistId: 'p2', newDescription: 'B' })
    ];
    const results = await executePlan(operations);

    expect(results).toHaveLength(2);
    expect(callOrder).toEqual(['/playlists/p1', '/playlists/p2']);
  });
});

describe('executor — dry run safety', () => {
  it('never calls the real network module when spotifyFetch is dry-run-mocked to short-circuit', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    spotifyFetch.mockResolvedValue({ snapshot_id: 'dry-run-snapshot', dryRun: true });

    const operation = createOperation('rename_playlist', { playlistId: 'p1', newName: 'New' });
    const result = await executeOperation(operation);

    expect(result.success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  describe.each([
    ['remove_tracks', (uris) => ({ playlistId: 'p1', trackUris: uris })],
    ['dedupe_tracks', (uris) => ({ playlistId: 'p1', trackUrisToRemove: uris })]
  ])('%s skips post-write verification when the DELETE was dry-run-simulated', (type, params) => {
    const uri = 'spotify:track:X';

    it('never issues the verification GET and reports simulated success', async () => {
      spotifyFetch
        .mockResolvedValueOnce({ snapshot_id: 'snap-1' }) // getPlaylistSnapshotId
        .mockResolvedValueOnce({ snapshot_id: 'dry-run-snapshot', dryRun: true }); // DELETE (simulated)

      const operation = createOperation(type, params([uri]));
      const result = await executeOperation(operation);

      expect(result.success).toBe(true);
      expect(spotifyFetch).toHaveBeenCalledTimes(2); // snapshot + DELETE only — no verification GET
      expect(result.details).toEqual({
        uris: [uri],
        attempts: 1,
        retryPerformed: false,
        verificationPassed: true,
        snapshotsUsed: ['snap-1'],
        simulated: true
      });
    });
  });
});
