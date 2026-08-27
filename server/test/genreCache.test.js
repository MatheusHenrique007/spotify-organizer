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

describe('genreCache', () => {
  let getCachedGenres;
  let setCachedGenres;
  let _resetCacheForTests;

  beforeEach(async () => {
    store.files.clear();
    vi.resetModules();
    const mod = await import('../src/lib/genreCache.js');
    getCachedGenres = mod.getCachedGenres;
    setCachedGenres = mod.setCachedGenres;
    _resetCacheForTests = mod._resetCacheForTests;
  });

  it('returns null for an artist that was never cached', () => {
    expect(getCachedGenres('artist-1')).toBeNull();
  });

  it('returns the stored genres after setCachedGenres', () => {
    setCachedGenres('artist-1', ['rock', 'pop']);
    expect(getCachedGenres('artist-1')).toEqual(['rock', 'pop']);
  });

  it('treats an entry older than the TTL as expired', async () => {
    setCachedGenres('artist-1', ['rock']);

    // Force the module to re-read from the (mocked) file with a manually aged timestamp,
    // simulating a cache entry written more than 7 days ago.
    _resetCacheForTests();
    const raw = JSON.parse([...store.files.values()][0]);
    raw['artist-1'].fetchedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    store.files.set([...store.files.keys()][0], JSON.stringify(raw));

    expect(getCachedGenres('artist-1')).toBeNull();
  });

  it('allows an expired entry to be refreshed with a new value', () => {
    setCachedGenres('artist-1', ['rock']);
    setCachedGenres('artist-1', ['indie rock']);
    expect(getCachedGenres('artist-1')).toEqual(['indie rock']);
  });

  it('does not duplicate entries when the same artist is cached twice', () => {
    setCachedGenres('artist-1', ['rock']);
    setCachedGenres('artist-1', ['rock', 'alt rock']);
    const [filePath] = store.files.keys();
    const raw = JSON.parse(store.files.get(filePath));
    expect(Object.keys(raw)).toEqual(['artist-1']);
  });

  it('stores only artistId, genres and fetchedAt — never tokens or secrets', () => {
    setCachedGenres('artist-1', ['rock']);
    const [filePath] = store.files.keys();
    const raw = JSON.parse(store.files.get(filePath));
    const keys = Object.keys(raw['artist-1']);
    expect(keys.sort()).toEqual(['fetchedAt', 'genres']);
    expect(JSON.stringify(raw)).not.toMatch(/token|secret|client_id/i);
  });
});
