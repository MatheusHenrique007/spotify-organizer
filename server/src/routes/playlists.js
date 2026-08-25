import { Router } from 'express';
import { spotifyFetch } from '../lib/spotifyClient.js';
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

playlistsRouter.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    await spotifyFetch(`/playlists/${req.params.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description })
    });
    res.json({ success: true });
  })
);

playlistsRouter.put(
  '/:id/image',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { base64Jpeg } = req.body;
    if (!base64Jpeg) {
      return res.status(400).json({ error: 'missing_image', message: 'base64Jpeg is required' });
    }
    await spotifyFetch(`/playlists/${req.params.id}/images`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: base64Jpeg
    });
    res.json({ success: true });
  })
);
