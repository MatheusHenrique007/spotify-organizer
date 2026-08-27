const OPERATION_LABELS = {
  create_playlist: {
    label: 'Criar playlist',
    describe: (params) => params.name || 'Nova playlist'
  },
  rename_playlist: {
    label: 'Renomear playlist',
    describe: (params) => (params.newName ? `Novo nome: ${params.newName}` : 'Renomeia a playlist')
  },
  change_description: {
    label: 'Alterar descrição',
    describe: () => 'Atualiza a descrição da playlist'
  },
  add_tracks: {
    label: 'Adicionar músicas',
    describe: (params) => itemCountLabel(params.trackUris, 'música')
  },
  remove_tracks: {
    label: 'Remover músicas',
    describe: (params) => itemCountLabel(params.trackUris, 'música')
  },
  dedupe_tracks: {
    label: 'Remover duplicatas',
    describe: (params) => itemCountLabel(params.trackUrisToRemove, 'duplicata')
  },
  reorder_tracks: {
    label: 'Reorganizar músicas',
    describe: () => 'Move um intervalo de faixas para uma nova posição'
  },
  replace_tracks: {
    label: 'Substituir músicas',
    describe: (params) => itemCountLabel(params.trackUris, 'música', 'na nova lista')
  },
  change_cover_image: {
    label: 'Alterar capa',
    describe: () => 'Atualiza a imagem de capa da playlist'
  }
};

function itemCountLabel(list, noun, suffix) {
  const count = Array.isArray(list) ? list.length : 0;
  const plural = count === 1 ? noun : `${noun}s`;
  return [`${count} ${plural}`, suffix].filter(Boolean).join(' ');
}

export function describeOperation(operation) {
  const entry = OPERATION_LABELS[operation.type];
  if (!entry) {
    return { label: operation.type, description: null };
  }
  return { label: entry.label, description: entry.describe(operation.params || {}) };
}

export function isDedupeWarningVisible(operationType) {
  return operationType === 'dedupe_tracks';
}
