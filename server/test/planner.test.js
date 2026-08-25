import { describe, it, expect, vi } from 'vitest';
import { buildPlanFromSuggestions, filterSelectedOperations, createOperation } from '../src/lib/planner.js';
import { executePlan } from '../src/lib/executor.js';

vi.mock('../src/lib/spotifyClient.js', () => ({
  spotifyFetch: vi.fn(async (path, options) => {
    if (path.includes('/tracks') && options?.method === 'DELETE') {
      return { snapshot_id: 'snap1' };
    }
    return { id: 'ok' };
  })
}));

describe('buildPlanFromSuggestions', () => {
  it('builds rename and description operations from suggestions', () => {
    const plan = buildPlanFromSuggestions({
      renameSuggestions: [{ playlistId: 'p1', suggestedName: 'New Name', suggestedDescription: 'Desc' }]
    });
    expect(plan.operations).toHaveLength(2);
    expect(plan.operations[0].type).toBe('rename_playlist');
    expect(plan.operations[1].type).toBe('change_description');
  });

  it('builds dedupe operations from dedupe suggestions', () => {
    const plan = buildPlanFromSuggestions({
      dedupeSuggestions: [{ playlistId: 'p1', trackUrisToRemove: ['spotify:track:1'] }]
    });
    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0].type).toBe('dedupe_tracks');
  });

  it('throws for unknown operation type', () => {
    expect(() => createOperation('not_a_real_type', {})).toThrow();
  });
});

describe('filterSelectedOperations', () => {
  it('returns only operations whose id is selected', () => {
    const plan = buildPlanFromSuggestions({
      renameSuggestions: [{ playlistId: 'p1', suggestedName: 'A', suggestedDescription: 'B' }]
    });
    const selectedId = plan.operations[0].id;
    const filtered = filterSelectedOperations(plan, [selectedId]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(selectedId);
  });
});

describe('executePlan', () => {
  it('executes operations against a mocked Spotify API and reports success', async () => {
    const operation = createOperation('rename_playlist', { playlistId: 'p1', newName: 'Renamed' });
    const results = await executePlan([operation], { userId: 'user1' });
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
  });

  it('captures failures without throwing', async () => {
    const badOperation = { id: 'bad', type: 'not_supported', params: {} };
    const results = await executePlan([badOperation], { userId: 'user1' });
    expect(results[0].success).toBe(false);
  });
});
