import { Router } from 'express';
import {
  getAllPlaylists,
  loadPlaylistsWithTracks,
  collectAllArtistIds,
  getArtistGenreMap
} from '../lib/playlistData.js';
import { findDuplicates } from '../lib/analysis/duplicates.js';
import { buildPlaylistProfile, computePlaylistSimilarity } from '../lib/analysis/similarity.js';
import { findSmallOrAbandonedPlaylists } from '../lib/analysis/smallPlaylists.js';
import { buildRenameSuggestion, buildMergeCandidates } from '../lib/analysis/suggestions.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const analysisRouter = Router();

analysisRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const playlists = await getAllPlaylists();
    const tracksByPlaylistId = await loadPlaylistsWithTracks(playlists);
    const artistIds = collectAllArtistIds(tracksByPlaylistId);
    const artistGenreMap = await getArtistGenreMap(artistIds);

    const duplicatesByPlaylist = {};
    const renameSuggestions = [];
    const profiles = [];

    for (const playlist of playlists) {
      const tracks = tracksByPlaylistId.get(playlist.id) || [];
      duplicatesByPlaylist[playlist.id] = findDuplicates(tracks);

      const rename = buildRenameSuggestion(playlist, tracks, artistGenreMap);
      if (rename) renameSuggestions.push(rename);

      profiles.push(buildPlaylistProfile(playlist, tracks, artistGenreMap));
    }

    const similarity = computePlaylistSimilarity(profiles);
    const mergeCandidates = buildMergeCandidates(similarity);
    const smallOrAbandoned = findSmallOrAbandonedPlaylists(playlists, tracksByPlaylistId);

    res.json({
      duplicatesByPlaylist,
      similarity,
      mergeCandidates,
      smallOrAbandoned,
      renameSuggestions,
      limitations: {
        recency:
          'Spotify API has no true playlist-level "last modified" field. Staleness is estimated from the most recent track added_at timestamp, which is unavailable or unreliable for some playlists (e.g. collaborative playlists with missing metadata).'
      }
    });
  })
);
