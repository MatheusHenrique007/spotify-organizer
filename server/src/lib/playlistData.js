import { spotifyFetch, spotifyFetchAllPages, SpotifyApiError } from './spotifyClient.js';
import { getCachedGenres, setCachedGenres } from './genreCache.js';

export async function getAllPlaylists() {
  return spotifyFetchAllPages('/me/playlists?limit=50');
}

export async function getPlaylistSnapshotId(playlistId) {
  const data = await spotifyFetch(`/playlists/${playlistId}?fields=snapshot_id`);
  return data.snapshot_id;
}

export async function getPlaylistTracks(playlistId) {
  const fields = 'items(added_at,item(id,uri,name,duration_ms,artists(id,name))),next';
  return spotifyFetchAllPages(`/playlists/${playlistId}/items?limit=100&fields=${encodeURIComponent(fields)}`);
}

export async function getArtistGenreMap(artistIds) {
  const uniqueIds = [...new Set(artistIds)].filter(Boolean);
  const genreMap = new Map();
  const failedArtistIds = [];

  for (const id of uniqueIds) {
    const cachedGenres = getCachedGenres(id);
    if (cachedGenres) {
      genreMap.set(id, cachedGenres);
      continue;
    }

    try {
      const artist = await spotifyFetch(`/artists/${id}`);
      const genres = artist?.genres || [];
      genreMap.set(id, genres);
      setCachedGenres(id, genres);
    } catch (err) {
      if (err instanceof SpotifyApiError) {
        failedArtistIds.push(id);
        continue;
      }
      throw err;
    }
  }

  return { genreMap, failedArtistIds };
}

export async function loadPlaylistsWithTracks(playlists) {
  const tracksByPlaylistId = new Map();
  const inaccessiblePlaylistIds = [];

  for (const playlist of playlists) {
    try {
      const tracks = await getPlaylistTracks(playlist.id);
      tracksByPlaylistId.set(playlist.id, tracks);
    } catch (err) {
      if (err instanceof SpotifyApiError && err.status === 403) {
        tracksByPlaylistId.set(playlist.id, []);
        inaccessiblePlaylistIds.push(playlist.id);
        continue;
      }
      throw err;
    }
  }

  return { tracksByPlaylistId, inaccessiblePlaylistIds };
}

export function collectAllArtistIds(tracksByPlaylistId) {
  const ids = [];
  for (const tracks of tracksByPlaylistId.values()) {
    for (const item of tracks) {
      for (const artist of item.item?.artists || []) {
        ids.push(artist.id);
      }
    }
  }
  return ids;
}
