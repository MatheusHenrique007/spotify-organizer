import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 8888,
  clientUrl: process.env.CLIENT_URL || 'http://127.0.0.1:5173',
  spotify: {
    clientId: required('SPOTIFY_CLIENT_ID', 'MISSING_SPOTIFY_CLIENT_ID'),
    redirectUri: required('SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:8888/callback'),
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    apiBaseUrl: 'https://api.spotify.com/v1',
    scopes: [
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-public',
      'playlist-modify-private',
      'ugc-image-upload',
      'user-read-private',
      'user-read-email'
    ]
  },
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY', 'insecure-dev-key-change-me'),
  dryRun: process.env.DRY_RUN === 'true',
  dataDir: path.resolve(__dirname, '../../data'),
  tokensFile: path.resolve(__dirname, '../../data/tokens.json'),
  historyFile: path.resolve(__dirname, '../../data/history.json'),
  artistGenreCacheFile: path.resolve(__dirname, '../../data/artist-genre-cache.json')
};
