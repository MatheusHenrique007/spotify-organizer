import { Router } from 'express';
import { spotifyFetch } from '../lib/spotifyClient.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const meRouter = Router();

meRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await spotifyFetch('/me');
    res.json(profile);
  })
);
