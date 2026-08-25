import { spotifyFetch } from './spotifyClient.js';

async function execCreatePlaylist(operation, userId) {
  const { name, description, isPublic = false } = operation.params;
  const playlist = await spotifyFetch(`/users/${userId}/playlists`, {
    method: 'POST',
    body: JSON.stringify({ name, description, public: isPublic })
  });
  return { playlistId: playlist.id, restoreData: { createdPlaylistId: playlist.id } };
}

async function execRenamePlaylist(operation) {
  const { playlistId, newName, previousName } = operation.params;
  await spotifyFetch(`/playlists/${playlistId}`, {
    method: 'PUT',
    body: JSON.stringify({ name: newName })
  });
  return { restoreData: { playlistId, previousName: previousName ?? null } };
}

async function execChangeDescription(operation) {
  const { playlistId, newDescription, previousDescription } = operation.params;
  await spotifyFetch(`/playlists/${playlistId}`, {
    method: 'PUT',
    body: JSON.stringify({ description: newDescription })
  });
  return { restoreData: { playlistId, previousDescription: previousDescription ?? null } };
}

async function execAddTracks(operation) {
  const { targetPlaylistId, trackUris = [] } = operation.params;
  if (trackUris.length === 0) return { restoreData: { addedUris: [] } };
  await spotifyFetch(`/playlists/${targetPlaylistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ uris: trackUris })
  });
  return { restoreData: { playlistId: targetPlaylistId, addedUris: trackUris } };
}

async function execRemoveTracks(operation) {
  const { playlistId, trackUris = [] } = operation.params;
  if (trackUris.length === 0) return { restoreData: { removedUris: [] } };
  await spotifyFetch(`/playlists/${playlistId}/tracks`, {
    method: 'DELETE',
    body: JSON.stringify({ tracks: trackUris.map((uri) => ({ uri })) })
  });
  return { restoreData: { playlistId, removedUris: trackUris } };
}

async function execDedupeTracks(operation) {
  const { playlistId, trackUrisToRemove = [] } = operation.params;
  if (trackUrisToRemove.length === 0) return { restoreData: { removedUris: [] } };
  await spotifyFetch(`/playlists/${playlistId}/tracks`, {
    method: 'DELETE',
    body: JSON.stringify({ tracks: trackUrisToRemove.map((uri) => ({ uri })) })
  });
  return { restoreData: { playlistId, removedUris: trackUrisToRemove } };
}

async function execReorderTracks(operation) {
  const { playlistId, rangeStart, insertBefore, rangeLength = 1 } = operation.params;
  await spotifyFetch(`/playlists/${playlistId}/tracks`, {
    method: 'PUT',
    body: JSON.stringify({ range_start: rangeStart, insert_before: insertBefore, range_length: rangeLength })
  });
  return { restoreData: { playlistId, note: 'Reorder restore requires original ordering snapshot' } };
}

async function execChangeCoverImage(operation) {
  const { playlistId, base64Jpeg } = operation.params;
  await spotifyFetch(`/playlists/${playlistId}/images`, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: base64Jpeg
  });
  return { restoreData: { playlistId, note: 'Reverting to Spotify default cover is not supported by the API' } };
}

const EXECUTORS = {
  create_playlist: execCreatePlaylist,
  rename_playlist: execRenamePlaylist,
  change_description: execChangeDescription,
  add_tracks: execAddTracks,
  remove_tracks: execRemoveTracks,
  dedupe_tracks: execDedupeTracks,
  reorder_tracks: execReorderTracks,
  change_cover_image: execChangeCoverImage
};

export async function executeOperation(operation, context = {}) {
  const executor = EXECUTORS[operation.type];
  if (!executor) {
    return { success: false, error: `No executor for operation type ${operation.type}` };
  }
  try {
    const result = await executor(operation, context.userId);
    return { success: true, operationId: operation.id, type: operation.type, ...result };
  } catch (error) {
    return {
      success: false,
      operationId: operation.id,
      type: operation.type,
      error: error.message || String(error)
    };
  }
}

export async function executePlan(operations, context = {}) {
  const results = [];
  for (const operation of operations) {
    results.push(await executeOperation(operation, context));
  }
  return results;
}
