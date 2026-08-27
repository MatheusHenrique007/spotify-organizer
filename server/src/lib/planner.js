import crypto from 'node:crypto';

const OPERATION_TYPES = [
  'create_playlist',
  'rename_playlist',
  'change_description',
  'add_tracks',
  'remove_tracks',
  'reorder_tracks',
  'replace_tracks',
  'dedupe_tracks',
  'change_cover_image'
];

export function createOperation(type, params) {
  if (!OPERATION_TYPES.includes(type)) {
    throw new Error(`Unknown operation type: ${type}`);
  }
  return {
    id: crypto.randomUUID(),
    type,
    params,
    selected: true
  };
}

export function buildPlanFromSuggestions({ renameSuggestions = [], dedupeSuggestions = [], mergeCandidates = [] }) {
  const operations = [];

  for (const suggestion of renameSuggestions) {
    operations.push(
      createOperation('rename_playlist', {
        playlistId: suggestion.playlistId,
        newName: suggestion.suggestedName
      })
    );
    operations.push(
      createOperation('change_description', {
        playlistId: suggestion.playlistId,
        newDescription: suggestion.suggestedDescription
      })
    );
  }

  for (const dedupe of dedupeSuggestions) {
    operations.push(
      createOperation('dedupe_tracks', {
        playlistId: dedupe.playlistId,
        trackUrisToRemove: dedupe.trackUrisToRemove
      })
    );
  }

  for (const merge of mergeCandidates) {
    operations.push(
      createOperation('add_tracks', {
        targetPlaylistId: merge.playlistIdA,
        sourcePlaylistId: merge.playlistIdB,
        note: `Merge candidate: ${merge.reason}`
      })
    );
  }

  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), operations };
}

export function filterSelectedOperations(plan, selectedOperationIds) {
  const selectedSet = new Set(selectedOperationIds);
  return plan.operations.filter((operation) => selectedSet.has(operation.id));
}

export { OPERATION_TYPES };
