import { describe, it, expect } from 'vitest';
import { describeOperation, isDedupeWarningVisible } from '../src/lib/operationPresentation.js';

describe('describeOperation', () => {
  it('gives a friendly label for a common operation type', () => {
    const result = describeOperation({ type: 'add_tracks', params: { trackUris: ['a', 'b'] } });
    expect(result.label).toBe('Adicionar músicas');
    expect(result.description).toBe('2 músicas');
  });

  it('supports every known operation type', () => {
    const types = [
      'create_playlist',
      'rename_playlist',
      'change_description',
      'add_tracks',
      'remove_tracks',
      'dedupe_tracks',
      'reorder_tracks',
      'replace_tracks',
      'change_cover_image'
    ];
    for (const type of types) {
      const result = describeOperation({ type, params: {} });
      expect(result.label).not.toBe(type);
    }
  });

  it('falls back to the raw type for an unknown operation', () => {
    const result = describeOperation({ type: 'unknown_op', params: {} });
    expect(result.label).toBe('unknown_op');
  });

  it('handles a result object with no params (executor result shape)', () => {
    const result = describeOperation({ type: 'dedupe_tracks' });
    expect(result.label).toBe('Remover duplicatas');
  });
});

describe('isDedupeWarningVisible', () => {
  it('still flags dedupe_tracks for the warning', () => {
    expect(isDedupeWarningVisible('dedupe_tracks')).toBe(true);
  });

  it('does not flag other operation types', () => {
    expect(isDedupeWarningVisible('remove_tracks')).toBe(false);
  });
});
