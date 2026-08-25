import { describe, it, expect } from 'vitest';
import { findSmallOrAbandonedPlaylists } from '../src/lib/analysis/smallPlaylists.js';

describe('findSmallOrAbandonedPlaylists', () => {
  const now = new Date('2024-06-01T00:00:00Z').getTime();

  it('flags playlists below the minimum track count', () => {
    const playlists = [{ id: 'p1', name: 'Tiny' }];
    const tracksByPlaylistId = new Map([['p1', [{ added_at: '2024-05-30T00:00:00Z' }]]]);
    const results = findSmallOrAbandonedPlaylists(playlists, tracksByPlaylistId, { minTracks: 3, now });
    expect(results).toHaveLength(1);
    expect(results[0].isSmall).toBe(true);
  });

  it('flags playlists with no recent additions as stale', () => {
    const playlists = [{ id: 'p1', name: 'Old' }];
    const tracks = Array.from({ length: 10 }, () => ({ added_at: '2020-01-01T00:00:00Z' }));
    const tracksByPlaylistId = new Map([['p1', tracks]]);
    const results = findSmallOrAbandonedPlaylists(playlists, tracksByPlaylistId, { minTracks: 3, staleDays: 180, now });
    expect(results).toHaveLength(1);
    expect(results[0].isStale).toBe(true);
    expect(results[0].isSmall).toBe(false);
  });

  it('does not flag healthy, recently updated playlists', () => {
    const playlists = [{ id: 'p1', name: 'Active' }];
    const tracks = Array.from({ length: 10 }, () => ({ added_at: '2024-05-25T00:00:00Z' }));
    const tracksByPlaylistId = new Map([['p1', tracks]]);
    const results = findSmallOrAbandonedPlaylists(playlists, tracksByPlaylistId, { minTracks: 3, staleDays: 180, now });
    expect(results).toHaveLength(0);
  });
});
