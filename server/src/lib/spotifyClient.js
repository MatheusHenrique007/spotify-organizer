import { config } from './config.js';
import { loadTokens, saveTokens } from './tokenStore.js';

export class SpotifyApiError extends Error {
  constructor(status, message, body, retryAfterSeconds) {
    super(message);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.body = body;
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
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
// A Retry-After above this is treated as "not worth waiting for" — the request fails fast
// with a controlled error instead of holding the connection open for minutes/hours.
// 60s is long enough to cover normal short-lived rate-limit bursts, short enough that no
// caller (HTTP request, background job) is left hanging for an impractical amount of time.
const MAX_RETRY_AFTER_SECONDS = 60;
const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

function dryRunResponse(pathOrUrl, options) {
  const method = (options.method || 'GET').toUpperCase();
  console.log(`[DRY RUN] ${method} ${pathOrUrl} (no request sent to Spotify)`);
  return { snapshot_id: 'dry-run-snapshot', dryRun: true };
}

export async function spotifyFetch(pathOrUrl, options = {}, attempt = 0) {
  const method = (options.method || 'GET').toUpperCase();
  if (config.dryRun && WRITE_METHODS.has(method)) {
    return dryRunResponse(pathOrUrl, options);
  }

  const accessToken = await getValidAccessToken();
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${config.spotify.apiBaseUrl}${pathOrUrl}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (transportError) {
    // fetch() throws on transport-level failures (connection reset, DNS, timeout) rather
    // than returning a response — these are not HTTP errors, so they never hit the status
    // checks below. Retry them like any other transient failure, bounded by MAX_RETRIES,
    // then surface as a SpotifyApiError so callers get the same controlled error shape
    // instead of an unhandled TypeError.
    if (attempt < MAX_RETRIES) {
      return spotifyFetch(pathOrUrl, options, attempt + 1);
    }
    throw new SpotifyApiError(0, `Network error calling Spotify: ${transportError.message}`, null);
  }

  if (response.status === 429) {
    const retryAfterSeconds = Number(response.headers.get('retry-after')) || 1;
    if (attempt < MAX_RETRIES && retryAfterSeconds <= MAX_RETRY_AFTER_SECONDS) {
      await sleep((retryAfterSeconds + 0.2) * 1000);
      return spotifyFetch(pathOrUrl, options, attempt + 1);
    }
    throw new SpotifyApiError(
      429,
      `Spotify rate limit exceeded. Retry after ~${retryAfterSeconds}s.`,
      null,
      retryAfterSeconds
    );
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
