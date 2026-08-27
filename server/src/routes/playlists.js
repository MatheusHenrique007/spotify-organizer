import { Router } from 'express';
import { getAllPlaylists, getPlaylistTracks } from '../lib/playlistData.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const playlistsRouter = Router();

playlistsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const playlists = await getAllPlaylists();
    res.json({
      playlists: playlists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        trackCount: playlist.tracks?.total ?? 0,
        images: playlist.images,
        owner: playlist.owner?.display_name,
        public: playlist.public
      }))
    });
  })
);

playlistsRouter.get(
  '/:id/tracks',
  requireAuth,
  asyncHandler(async (req, res) => {
    const tracks = await getPlaylistTracks(req.params.id);
    res.json({ tracks });
  })
);
