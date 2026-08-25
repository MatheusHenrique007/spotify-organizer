import { spotifyFetch, spotifyFetchAllPages } from './spotifyClient.js';

export async function getAllPlaylists() {
  return spotifyFetchAllPages('/me/playlists?limit=50');
}

export async function getPlaylistTracks(playlistId) {
  const fields = 'items(added_at,track(id,uri,name,duration_ms,artists(id,name))),next';
  return spotifyFetchAllPages(`/playlists/${playlistId}/tracks?limit=100&fields=${encodeURIComponent(fields)}`);
}

export async function getArtistGenreMap(artistIds) {
  const uniqueIds = [...new Set(artistIds)].filter(Boolean);
  const map = new Map();
  const batchSize = 50;

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const response = await spotifyFetch(`/artists?ids=${batch.join(',')}`);
    for (const artist of response.artists || []) {
      if (artist) map.set(artist.id, artist.genres || []);
    }
  }

  return map;
}

export async function loadPlaylistsWithTracks(playlists) {
  const tracksByPlaylistId = new Map();
  for (const playlist of playlists) {
    const tracks = await getPlaylistTracks(playlist.id);
    tracksByPlaylistId.set(playlist.id, tracks);
  }
  return tracksByPlaylistId;
}

export function collectAllArtistIds(tracksByPlaylistId) {
  const ids = [];
  for (const tracks of tracksByPlaylistId.values()) {
    for (const item of tracks) {
      for (const artist of item.track?.artists || []) {
        ids.push(artist.id);
      }
    }
  }
  return ids;
}
