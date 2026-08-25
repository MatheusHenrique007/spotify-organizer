import { SpotifyApiError } from '../lib/spotifyClient.js';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof SpotifyApiError) {
    return res.status(err.status || 502).json({
      error: 'spotify_api_error',
      message: err.message,
      status: err.status
    });
  }

  console.error(err);
  res.status(500).json({ error: 'internal_error', message: err.message || 'Unexpected error' });
}

export function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}
