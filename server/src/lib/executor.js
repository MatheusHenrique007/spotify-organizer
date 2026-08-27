import { spotifyFetch, SpotifyApiError } from './spotifyClient.js';
import { getPlaylistSnapshotId, getPlaylistTracks } from './playlistData.js';

async function execCreatePlaylist(operation) {
  const { name, description, isPublic = false } = operation.params;
  const playlist = await spotifyFetch('/me/playlists', {
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
  const response = await spotifyFetch(`/playlists/${targetPlaylistId}/items`, {
    method: 'POST',
    body: JSON.stringify({ uris: trackUris })
  });
  return {
    restoreData: { playlistId: targetPlaylistId, addedUris: trackUris },
    snapshotId: response.snapshot_id
  };
}

async function deleteUri(playlistId, uris, snapshotId) {
  return spotifyFetch(`/playlists/${playlistId}/items`, {
    method: 'DELETE',
    body: JSON.stringify({ items: uris.map((uri) => ({ uri })), snapshot_id: snapshotId })
  });
}

async function anyUriStillPresent(playlistId, uris) {
  const items = await getPlaylistTracks(playlistId);
  const present = new Set(items.map((entry) => entry.item?.uri).filter(Boolean));
  return uris.some((uri) => present.has(uri));
}

// Spotify can return HTTP 2xx for a DELETE that doesn't actually remove anything —
// observed in real testing when the snapshot_id we read via GET /playlists/{id}?fields=snapshot_id
// lagged behind the playlist's true current state (by several seconds in some cases). A response
// status alone is not proof the mutation applied, so we verify against the playlist's real content
// instead of comparing snapshot_id strings (which was tried and found unreliable — the response
// snapshot did not always equal the one we sent, even when nothing changed). On a mismatch we retry
// exactly once with a freshly read snapshot; if the targeted URIs are still present after that, we
// report a real failure instead of a silent false success.
//
// `details` records what actually happened (attempts, whether a retry ran, whether the final
// verification passed, and which snapshots were used) so a failure can be diagnosed later from the
// operation result / history entry without needing to alter the retry logic itself.
async function deletePlaylistItemsVerified(playlistId, uris) {
  const snapshotsUsed = [];

  let snapshotId = await getPlaylistSnapshotId(playlistId);
  snapshotsUsed.push(snapshotId);
  let response = await deleteUri(playlistId, uris, snapshotId);
  let verificationPassed = !(await anyUriStillPresent(playlistId, uris));
  let retryPerformed = false;

  if (!verificationPassed) {
    retryPerformed = true;
    snapshotId = await getPlaylistSnapshotId(playlistId);
    snapshotsUsed.push(snapshotId);
    response = await deleteUri(playlistId, uris, snapshotId);
    verificationPassed = !(await anyUriStillPresent(playlistId, uris));
  }

  const details = {
    uris,
    attempts: snapshotsUsed.length,
    retryPerformed,
    verificationPassed,
    snapshotsUsed
  };

  if (!verificationPassed) {
    const error = new SpotifyApiError(
      0,
      'Spotify accepted the removal request but the track(s) were still present after a retry with a freshly read snapshot.'
    );
    error.details = details;
    throw error;
  }

  return { response, details };
}

async function execRemoveTracks(operation) {
  const { playlistId, trackUris = [] } = operation.params;
  if (trackUris.length === 0) return { restoreData: { removedUris: [] } };
  const { response, details } = await deletePlaylistItemsVerified(playlistId, trackUris);
  return {
    restoreData: { playlistId, removedUris: trackUris },
    snapshotId: response.snapshot_id,
    details
  };
}

async function execDedupeTracks(operation) {
  const { playlistId, trackUrisToRemove = [] } = operation.params;
  if (trackUrisToRemove.length === 0) return { restoreData: { removedUris: [] } };
  const { response, details } = await deletePlaylistItemsVerified(playlistId, trackUrisToRemove);
  return {
    restoreData: { playlistId, removedUris: trackUrisToRemove },
    snapshotId: response.snapshot_id,
    details
  };
}

async function execReorderTracks(operation) {
  const { playlistId, rangeStart, insertBefore, rangeLength = 1 } = operation.params;
  const snapshotId = await getPlaylistSnapshotId(playlistId);
  const response = await spotifyFetch(`/playlists/${playlistId}/items`, {
    method: 'PUT',
    body: JSON.stringify({
      range_start: rangeStart,
      insert_before: insertBefore,
      range_length: rangeLength,
      snapshot_id: snapshotId
    })
  });
  return {
    restoreData: { playlistId, note: 'Reorder restore requires original ordering snapshot' },
    snapshotId: response.snapshot_id
  };
}

async function execReplaceTracks(operation) {
  const { playlistId, trackUris = [] } = operation.params;

  // Capture the current track list before replacing it. If this read fails, the error
  // propagates and the replace below never runs — there is no partial/unsafe replace.
  const previousItems = await getPlaylistTracks(playlistId);
  const previousTrackUris = previousItems.map((entry) => entry.item?.uri).filter(Boolean);

  const response = await spotifyFetch(`/playlists/${playlistId}/items`, {
    method: 'PUT',
    body: JSON.stringify({ uris: trackUris })
  });
  return {
    restoreData: { playlistId, previousTrackUris },
    snapshotId: response.snapshot_id
  };
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
  replace_tracks: execReplaceTracks,
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
      error: error.message || String(error),
      ...(error.details ? { details: error.details } : {})
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
