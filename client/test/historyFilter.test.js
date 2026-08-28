import { describe, it, expect } from 'vitest';
import { filterHistory, getEntryStatus, getEntryKind } from '../src/lib/historyFilter.js';

const playlistSuccess = {
  id: 'p1',
  timestamp: '2026-01-01T00:00:00.000Z',
  planId: 'plan-1',
  operationCount: 1,
  results: [{ success: true, operationId: 'op-1', type: 'rename_playlist' }]
};

const playlistFailure = {
  id: 'p2',
  timestamp: '2026-01-02T00:00:00.000Z',
  planId: 'plan-2',
  operationCount: 2,
  results: [
    { success: true, operationId: 'op-2', type: 'add_tracks' },
    { success: false, operationId: 'op-3', type: 'remove_tracks', error: 'Track still present after retry' }
  ]
};

const spicetifySuccess = {
  id: 's1',
  timestamp: '2026-01-03T00:00:00.000Z',
  type: 'spicetify_theme',
  target: 'spotify_desktop',
  action: 'apply',
  result: 'success',
  details: { exitCode: 0, stdout: '', stderr: '' }
};

const spicetifyFailure = {
  id: 's2',
  timestamp: '2026-01-04T00:00:00.000Z',
  type: 'spicetify_theme',
  target: 'spotify_desktop',
  action: 'restore',
  result: 'failure',
  details: { exitCode: 1, stdout: '', stderr: 'backup version mismatch' }
};

const allEntries = [playlistSuccess, playlistFailure, spicetifySuccess, spicetifyFailure];

describe('getEntryKind / getEntryStatus', () => {
  it('classifies kind from the real entry.type field, never guessing from other fields', () => {
    expect(getEntryKind(playlistSuccess)).toBe('playlist');
    expect(getEntryKind(spicetifySuccess)).toBe('spicetify');
  });

  it('a playlist entry only counts as success when every operation in it succeeded', () => {
    expect(getEntryStatus(playlistSuccess)).toBe('success');
    expect(getEntryStatus(playlistFailure)).toBe('error');
  });

  it('a spicetify entry uses its own real result field directly', () => {
    expect(getEntryStatus(spicetifySuccess)).toBe('success');
    expect(getEntryStatus(spicetifyFailure)).toBe('error');
  });
});

describe('filterHistory', () => {
  it('an empty query returns every entry, both formats coexisting', () => {
    expect(filterHistory(allEntries, { query: '' })).toEqual(allEntries);
  });

  it('search is case-insensitive', () => {
    const result = filterHistory(allEntries, { query: 'RENAME' });
    expect(result).toEqual([playlistSuccess]);
  });

  it('search matches partial text', () => {
    const result = filterHistory(allEntries, { query: 'mismatch' });
    expect(result).toEqual([spicetifyFailure]);
  });

  it('search trims surrounding whitespace from the query', () => {
    expect(filterHistory(allEntries, { query: '  apply  ' })).toEqual([spicetifySuccess]);
  });

  it('type "all" returns every entry regardless of kind', () => {
    expect(filterHistory(allEntries, { type: 'all' })).toEqual(allEntries);
  });

  it('type "playlist" returns only playlist entries', () => {
    expect(filterHistory(allEntries, { type: 'playlist' })).toEqual([playlistSuccess, playlistFailure]);
  });

  it('type "spicetify" returns only Theme Manager entries', () => {
    expect(filterHistory(allEntries, { type: 'spicetify' })).toEqual([spicetifySuccess, spicetifyFailure]);
  });

  it('combines a search query with a type filter', () => {
    const result = filterHistory(allEntries, { query: 'track', type: 'playlist' });
    expect(result).toEqual([playlistFailure]);
  });

  it('returns an empty array when nothing matches, never throwing', () => {
    expect(filterHistory(allEntries, { query: 'nonexistent-term-xyz' })).toEqual([]);
  });

  it('status filter separates success from error across both entry formats', () => {
    expect(filterHistory(allEntries, { status: 'success' })).toEqual([playlistSuccess, spicetifySuccess]);
    expect(filterHistory(allEntries, { status: 'error' })).toEqual([playlistFailure, spicetifyFailure]);
  });

  it('handles an entry with no results array without crashing (defensive against incomplete data)', () => {
    const incomplete = { id: 'x', timestamp: '2026-01-05T00:00:00.000Z', planId: 'plan-x', operationCount: 0 };
    expect(() => filterHistory([incomplete], { query: 'anything' })).not.toThrow();
    expect(filterHistory([incomplete], { query: '' })).toEqual([incomplete]);
  });
});
