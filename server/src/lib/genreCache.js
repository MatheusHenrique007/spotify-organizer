import fs from 'node:fs';
import { config } from './config.js';

// Artist genres change rarely. 7 days is long enough to avoid re-fetching the same
// artists across repeated local analyses, short enough to eventually pick up a
// reclassification on Spotify's side. Pragmatic choice for a personal local tool,
// not derived from any Spotify-documented rule.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

let cache = null;

function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function load() {
  if (cache) return cache;
  if (!fs.existsSync(config.artistGenreCacheFile)) {
    cache = {};
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(config.artistGenreCacheFile, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  ensureDataDir();
  fs.writeFileSync(config.artistGenreCacheFile, JSON.stringify(cache, null, 2), 'utf8');
}

export function getCachedGenres(artistId) {
  const store = load();
  const entry = store[artistId];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) return null;
  return entry.genres;
}

export function setCachedGenres(artistId, genres) {
  const store = load();
  store[artistId] = { genres, fetchedAt: Date.now() };
  persist();
}

export function _resetCacheForTests() {
  cache = null;
}
