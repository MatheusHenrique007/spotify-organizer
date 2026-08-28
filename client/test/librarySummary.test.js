import { describe, it, expect } from 'vitest';
import { calculateLibrarySummary } from '../src/lib/librarySummary.js';

describe('calculateLibrarySummary', () => {
  it('returns zeros for an empty library, never crashing on empty input', () => {
    expect(calculateLibrarySummary([])).toEqual({ totalPlaylists: 0, totalTracks: 0, emptyPlaylists: 0 });
  });

  it('sums real trackCount fields and counts playlists with zero tracks', () => {
    const playlists = [
      { id: '1', trackCount: 10 },
      { id: '2', trackCount: 0 },
      { id: '3', trackCount: 5 }
    ];
    expect(calculateLibrarySummary(playlists)).toEqual({ totalPlaylists: 3, totalTracks: 15, emptyPlaylists: 1 });
  });

  it('treats a missing/undefined trackCount as zero instead of producing NaN', () => {
    const playlists = [{ id: '1' }, { id: '2', trackCount: 3 }];
    expect(calculateLibrarySummary(playlists)).toEqual({ totalPlaylists: 2, totalTracks: 3, emptyPlaylists: 1 });
  });
});
