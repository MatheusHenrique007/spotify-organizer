import { describe, it, expect } from 'vitest';
import { jaccardIndex, computePlaylistSimilarity, buildPlaylistProfile } from '../src/lib/analysis/similarity.js';

describe('jaccardIndex', () => {
  it('returns 0 for two empty sets', () => {
    expect(jaccardIndex(new Set(), new Set())).toBe(0);
  });

  it('returns 1 for identical sets', () => {
    expect(jaccardIndex(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
  });

  it('computes partial overlap correctly', () => {
    expect(jaccardIndex(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
  });
});

describe('computePlaylistSimilarity', () => {
  it('ranks fully overlapping playlists highest', () => {
    const playlists = [
      { id: 'p1', name: 'A', trackIds: new Set(['t1', 't2']), artistIds: new Set(['a1']), genres: new Set(['pop']) },
      { id: 'p2', name: 'B', trackIds: new Set(['t1', 't2']), artistIds: new Set(['a1']), genres: new Set(['pop']) },
      { id: 'p3', name: 'C', trackIds: new Set(['t9']), artistIds: new Set(['a9']), genres: new Set(['jazz']) }
    ];
    const results = computePlaylistSimilarity(playlists);
    expect(results[0].playlistIdA).toBe('p1');
    expect(results[0].playlistIdB).toBe('p2');
    expect(results[0].overallScore).toBeCloseTo(1);
  });

  it('excludes pairs with zero similarity', () => {
    const playlists = [
      { id: 'p1', name: 'A', trackIds: new Set(['t1']), artistIds: new Set(), genres: new Set() },
      { id: 'p2', name: 'B', trackIds: new Set(['t2']), artistIds: new Set(), genres: new Set() }
    ];
    expect(computePlaylistSimilarity(playlists)).toHaveLength(0);
  });
});

describe('buildPlaylistProfile', () => {
  it('collects track ids, artist ids, and genres', () => {
    const playlist = { id: 'p1', name: 'Test' };
    const tracks = [
      { track: { id: 't1', artists: [{ id: 'a1', name: 'Artist' }] } }
    ];
    const genreMap = new Map([['a1', ['rock']]]);
    const profile = buildPlaylistProfile(playlist, tracks, genreMap);
    expect(profile.trackIds.has('t1')).toBe(true);
    expect(profile.artistIds.has('a1')).toBe(true);
    expect(profile.genres.has('rock')).toBe(true);
  });
});
