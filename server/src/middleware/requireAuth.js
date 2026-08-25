import { loadTokens } from '../lib/tokenStore.js';

export function requireAuth(req, res, next) {
  const tokens = loadTokens();
  if (!tokens) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Please log in with Spotify.' });
  }
  next();
}
