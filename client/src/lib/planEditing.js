export function applyOperationEdits(operations, edits) {
  return operations.map((operation) => {
    if (operation.type === 'rename_playlist' && edits[operation.id] !== undefined) {
      return { ...operation, params: { ...operation.params, newName: edits[operation.id] } };
    }
    return operation;
  });
}
