import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyOperationEdits } from '../src/lib/planEditing.js';

describe('applyOperationEdits', () => {
  it('keeps the auto-suggested newName when there is no edit', () => {
    const operations = [
      { id: 'op1', type: 'rename_playlist', params: { playlistId: 'p1', newName: 'The Killers' } }
    ];
    const result = applyOperationEdits(operations, {});
    expect(result[0].params.newName).toBe('The Killers');
  });

  it('overrides newName with the user-edited value for rename_playlist', () => {
    const operations = [
      { id: 'op1', type: 'rename_playlist', params: { playlistId: 'p1', newName: 'The Killers' } }
    ];
    const result = applyOperationEdits(operations, { op1: 'Spotify Organizer TESTE - Renamed' });
    expect(result[0].params.newName).toBe('Spotify Organizer TESTE - Renamed');
  });

  it('does not touch operations of other types even if an edit id matches', () => {
    const operations = [
      { id: 'op1', type: 'change_description', params: { playlistId: 'p1', newDescription: 'desc' } }
    ];
    const result = applyOperationEdits(operations, { op1: 'should not apply' });
    expect(result[0].params.newDescription).toBe('desc');
    expect(result[0].params.newName).toBeUndefined();
  });

  it('does not mutate the original operations array', () => {
    const operations = [
      { id: 'op1', type: 'rename_playlist', params: { playlistId: 'p1', newName: 'Original' } }
    ];
    applyOperationEdits(operations, { op1: 'Edited' });
    expect(operations[0].params.newName).toBe('Original');
  });

  it('has no network capability at all — no imports, no fetch, no api.js reference', () => {
    const source = fs.readFileSync(fileURLToPath(new URL('../src/lib/planEditing.js', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/\bimport\b/);
    expect(source).not.toMatch(/fetch\(/);
    expect(source).not.toMatch(/api\.js/);
  });
});
