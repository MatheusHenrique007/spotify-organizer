import { config } from './config.js';
import { loadTokens, saveTokens } from './tokenStore.js';

export class SpotifyApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.body = body;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshAccessToken() {
  const tokens = loadTokens();
  if (!tokens?.refreshToken) {
    throw new SpotifyApiError(401, 'No refresh token available. Please log in again.');
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    client_id: config.spotify.clientId
  });
  const response = await fetch(config.spotify.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new SpotifyApiError(401, 'Failed to refresh access token', text);
  }
  const data = await response.json();
  const updated = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || tokens.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope
  };
  saveTokens(updated);
  return updated;
}

async function getValidAccessToken() {
  let tokens = loadTokens();
  if (!tokens) {
    throw new SpotifyApiError(401, 'Not authenticated. Please log in.');
  }
  if (Date.now() > tokens.expiresAt - 60_000) {
    tokens = await refreshAccessToken();
  }
  return tokens.accessToken;
}

const MAX_RETRIES = 3;

export async function spotifyFetch(pathOrUrl, options = {}, attempt = 0) {
  const accessToken = await getValidAccessToken();
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${config.spotify.apiBaseUrl}${pathOrUrl}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (response.status === 429 && attempt < MAX_RETRIES) {
    const retryAfter = Number(response.headers.get('retry-after')) || 1;
    await sleep((retryAfter + 0.2) * 1000);
    return spotifyFetch(pathOrUrl, options, attempt + 1);
  }

  if (response.status === 401 && attempt < 1) {
    await refreshAccessToken();
    return spotifyFetch(pathOrUrl, options, attempt + 1);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new SpotifyApiError(response.status, data?.error?.message || response.statusText, data);
  }

  return data;
}

export async function spotifyFetchAllPages(initialPath) {
  const items = [];
  let nextUrl = initialPath;
  while (nextUrl) {
    const page = await spotifyFetch(nextUrl);
    items.push(...(page.items || []));
    nextUrl = page.next;
  }
  return items;
}
