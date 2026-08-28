import { describe, it, expect } from 'vitest';
import { buildPlanPreview } from '../src/lib/planPreview.js';

function op(type, params, id = type) {
  return { id, type, params, selected: true };
}

describe('buildPlanPreview — pure, read-only, never touches the network', () => {
  it('only includes selected operations, not the full plan', () => {
    const operations = [op('rename_playlist', { playlistId: 'p1', newName: 'A' }), op('change_description', { playlistId: 'p1' })];
    const preview = buildPlanPreview(operations, new Set(['rename_playlist']));
    expect(preview.totalOperations).toBe(2);
    expect(preview.totalSelected).toBe(1);
    expect(preview.items).toHaveLength(1);
    expect(preview.items[0].type).toBe('rename_playlist');
  });

  it('an empty selection returns zero items without throwing', () => {
    const operations = [op('rename_playlist', { playlistId: 'p1', newName: 'A' })];
    const preview = buildPlanPreview(operations, new Set());
    expect(preview.totalSelected).toBe(0);
    expect(preview.items).toEqual([]);
  });

  it('reflects an in-progress rename edit, exactly what execute would actually receive', () => {
    const operations = [op('rename_playlist', { playlistId: 'p1', newName: 'Old Name' })];
    const preview = buildPlanPreview(operations, new Set(['rename_playlist']), { rename_playlist: 'New Name' });
    expect(preview.items[0].description).toBe('Novo nome: New Name');
  });

  it('describes a remove_tracks operation with the real track count', () => {
    const operations = [op('remove_tracks', { playlistId: 'p1', trackUris: ['a', 'b', 'c'] })];
    const preview = buildPlanPreview(operations, new Set(['remove_tracks']));
    expect(preview.items[0].description).toBe('3 músicas');
  });

  it('flags dedupe_tracks with a warning, matching the same rule used in the review screen', () => {
    const operations = [op('dedupe_tracks', { playlistId: 'p1', trackUrisToRemove: ['a'] })];
    const preview = buildPlanPreview(operations, new Set(['dedupe_tracks']));
    expect(preview.items[0].hasWarning).toBe(true);
  });

  it('never flags a non-dedupe operation with the warning', () => {
    const operations = [op('add_tracks', { targetPlaylistId: 'p1', trackUris: ['a'] })];
    const preview = buildPlanPreview(operations, new Set(['add_tracks']));
    expect(preview.items[0].hasWarning).toBe(false);
  });

  it('reports "Impacto não disponível" for an unrecognized operation type instead of inventing a description', () => {
    const operations = [op('some_future_operation', { playlistId: 'p1' })];
    const preview = buildPlanPreview(operations, new Set(['some_future_operation']));
    expect(preview.items[0].description).toBe('Impacto não disponível');
  });

  it('never includes a playlist name field — the plan data never carries one', () => {
    const operations = [op('rename_playlist', { playlistId: 'p1', newName: 'X' })];
    const preview = buildPlanPreview(operations, new Set(['rename_playlist']));
    expect(preview.items[0]).not.toHaveProperty('playlistName');
  });

  it('supports multiple selected operations of different types together', () => {
    const operations = [
      op('rename_playlist', { playlistId: 'p1', newName: 'A' }, 'op1'),
      op('change_description', { playlistId: 'p1', newDescription: 'B' }, 'op2'),
      op('dedupe_tracks', { playlistId: 'p2', trackUrisToRemove: ['x', 'y'] }, 'op3')
    ];
    const preview = buildPlanPreview(operations, new Set(['op1', 'op2', 'op3']));
    expect(preview.totalSelected).toBe(3);
    expect(preview.items.map((item) => item.type)).toEqual(['rename_playlist', 'change_description', 'dedupe_tracks']);
  });
});
