import { describeOperation, isDedupeWarningVisible } from './operationPresentation.js';

// Pure, read-only preview: describes exactly what would be sent to /plans/execute for the
// selected operations, using only data already present in the plan/edits — the same data
// the review screen already renders. No network call, no Spotify API, no executor, no
// history entry. There is nothing here that could mutate anything: it never calls the
// backend at all. Playlist names are never shown because the plan's operation params never
// carry one (only playlistId) — see server/src/lib/planner.js.
export function buildPlanPreview(operations, selectedIds, renameEdits = {}) {
  const selected = operations.filter((operation) => selectedIds.has(operation.id));

  const items = selected.map((operation) => {
    const effectiveParams =
      operation.type === 'rename_playlist' && renameEdits[operation.id] !== undefined
        ? { ...operation.params, newName: renameEdits[operation.id] }
        : operation.params;

    const { label, description } = describeOperation({ ...operation, params: effectiveParams });

    return {
      id: operation.id,
      type: operation.type,
      label,
      description: description ?? 'Impacto não disponível',
      hasWarning: isDedupeWarningVisible(operation.type)
    };
  });

  return {
    totalOperations: operations.length,
    totalSelected: items.length,
    items
  };
}
