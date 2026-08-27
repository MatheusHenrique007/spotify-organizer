import { describe, it, expect } from 'vitest';
import { findDuplicates } from '../src/lib/analysis/duplicates.js';

function trackItem(id, name, artist, addedAt = '2024-01-01T00:00:00Z') {
  return {
    added_at: addedAt,
    item: { id, uri: `spotify:track:${id}`, name, artists: [{ id: `artist-${artist}`, name: artist }] }
  };
}

describe('findDuplicates', () => {
  it('detects exact duplicates by track id', () => {
    const tracks = [trackItem('1', 'Song A', 'Artist A'), trackItem('1', 'Song A', 'Artist A')];
    const { exactDuplicates } = findDuplicates(tracks);
    expect(exactDuplicates).toHaveLength(1);
    expect(exactDuplicates[0].occurrences).toHaveLength(2);
  });

  it('detects fuzzy duplicates via normalized title/artist', () => {
    const tracks = [
      trackItem('1', 'Song A (feat. X)', 'Artist A'),
      trackItem('2', 'song a', 'artist a')
    ];
    const { fuzzyDuplicates, exactDuplicates } = findDuplicates(tracks);
    expect(exactDuplicates).toHaveLength(0);
    expect(fuzzyDuplicates).toHaveLength(1);
    expect(fuzzyDuplicates[0].occurrences).toHaveLength(2);
  });

  it('returns no duplicates for distinct tracks', () => {
    const tracks = [trackItem('1', 'Song A', 'Artist A'), trackItem('2', 'Song B', 'Artist B')];
    const { exactDuplicates, fuzzyDuplicates } = findDuplicates(tracks);
    expect(exactDuplicates).toHaveLength(0);
    expect(fuzzyDuplicates).toHaveLength(0);
  });

  it('ignores items with missing track data', () => {
    const tracks = [{ added_at: '2024-01-01', item: null }, trackItem('1', 'Song A', 'Artist A')];
    const { exactDuplicates } = findDuplicates(tracks);
    expect(exactDuplicates).toHaveLength(0);
  });
});
