import { SpotifyApiError } from '../lib/spotifyClient.js';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof SpotifyApiError) {
    return res.status(err.status || 502).json({
      error: 'spotify_api_error',
      message: err.message,
      status: err.status,
      ...(err.retryAfterSeconds !== undefined ? { retryAfterSeconds: err.retryAfterSeconds } : {})
    });
  }

  console.error(err);

  // Preserve a real HTTP status from infrastructure/middleware errors (e.g. Express's
  // body-parser sets err.status = 400 on malformed JSON) instead of always answering 500.
  // Only 4xx/5xx are accepted — anything else (missing, NaN, out of range, non-integer)
  // falls back to 500 rather than letting an arbitrary value control the response code.
  const candidate = Number.isInteger(err.status) ? err.status : Number.isInteger(err.statusCode) ? err.statusCode : null;
  const status = candidate !== null && candidate >= 400 && candidate <= 599 ? candidate : 500;

  res.status(status).json({ error: status === 500 ? 'internal_error' : 'request_error', message: err.message || 'Unexpected error' });
}

export function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}
