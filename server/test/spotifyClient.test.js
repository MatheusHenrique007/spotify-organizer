import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/lib/tokenStore.js', () => ({
  loadTokens: vi.fn(() => ({
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: Date.now() + 60 * 60 * 1000,
    scope: 'playlist-read-private'
  })),
  saveTokens: vi.fn()
}));

function fakeResponse(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    json: async () => body
  };
}

describe('spotifyClient — spotifyFetch', () => {
  let spotifyFetch;
  let SpotifyApiError;
  let fetchMock;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    const mod = await import('../src/lib/spotifyClient.js');
    spotifyFetch = mod.spotifyFetch;
    SpotifyApiError = mod.SpotifyApiError;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the parsed body on a normal 200 response', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { id: 'abc', name: 'Test Artist' }));
    const result = await spotifyFetch('/artists/abc');
    expect(result).toEqual({ id: 'abc', name: 'Test Artist' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes the token once on 401 and retries the original request', async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(401, { error: { message: 'Unauthorized' } }))
      .mockResolvedValueOnce(
        fakeResponse(200, { access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600, scope: 'x' })
      )
      .mockResolvedValueOnce(fakeResponse(200, { id: 'abc' }));

    const result = await spotifyFetch('/me');
    expect(result).toEqual({ id: 'abc' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws a SpotifyApiError with status 403 and does not retry', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(403, { error: { message: 'Forbidden' } }));
    await expect(spotifyFetch('/playlists/p1/items')).rejects.toMatchObject({
      name: 'SpotifyApiError',
      status: 403
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws a SpotifyApiError with status 404 and does not retry', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(404, { error: { message: 'Not Found' } }));
    await expect(spotifyFetch('/tracks/does-not-exist')).rejects.toMatchObject({
      name: 'SpotifyApiError',
      status: 404
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once and succeeds when Retry-After is small (below the 60s threshold)', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(fakeResponse(429, undefined, { 'retry-after': '2' }))
      .mockResolvedValueOnce(fakeResponse(200, { ok: true }));

    const promise = spotifyFetch('/artists/abc');
    await vi.advanceTimersByTimeAsync(2500);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails fast (no sleep) when Retry-After is far above the 60s threshold', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(429, undefined, { 'retry-after': '80133' }));

    const start = Date.now();
    await expect(spotifyFetch('/artists/abc')).rejects.toMatchObject({
      name: 'SpotifyApiError',
      status: 429,
      retryAfterSeconds: 80133
    });
    const elapsed = Date.now() - start;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(1000);
  });

  it('defaults to a 1s wait and retries when Retry-After header is missing', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(fakeResponse(429, undefined, {}))
      .mockResolvedValueOnce(fakeResponse(200, { ok: true }));

    const promise = spotifyFetch('/artists/abc');
    await vi.advanceTimersByTimeAsync(1500);
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never retries more than MAX_RETRIES times even with a small Retry-After', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(fakeResponse(429, undefined, { 'retry-after': '1' }));

    const promise = spotifyFetch('/artists/abc');
    const assertion = expect(promise).rejects.toMatchObject({ name: 'SpotifyApiError', status: 429 });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;

    // 1 initial attempt + 3 retries = 4 calls total, never more.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('the thrown error carries enough info for the frontend without exposing the token', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(429, undefined, { 'retry-after': '80133' }));
    try {
      await spotifyFetch('/artists/abc');
      throw new Error('expected spotifyFetch to throw');
    } catch (error) {
      expect(error.status).toBe(429);
      expect(error.retryAfterSeconds).toBe(80133);
      expect(error.message).not.toContain('test-access-token');
      expect(error.message).not.toContain('Bearer');
    }
  });

  it('dry run still short-circuits write requests without touching the network', async () => {
    const { config } = await import('../src/lib/config.js');
    config.dryRun = true;
    try {
      const result = await spotifyFetch('/playlists/p1/items', { method: 'POST', body: '{}' });
      expect(result.dryRun).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      config.dryRun = false;
    }
  });
});

describe('spotifyClient — transport-level failures (fetch throws, not an HTTP error)', () => {
  let spotifyFetch;
  let SpotifyApiError;
  let fetchMock;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    const mod = await import('../src/lib/spotifyClient.js');
    spotifyFetch = mod.spotifyFetch;
    SpotifyApiError = mod.SpotifyApiError;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries a transport failure and succeeds once fetch recovers', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(fakeResponse(200, { id: 'abc' }));

    const result = await spotifyFetch('/me');

    expect(result).toEqual({ id: 'abc' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not leak the raw TypeError — converts to a SpotifyApiError after exhausting retries', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(spotifyFetch('/me')).rejects.toMatchObject({
      name: 'SpotifyApiError',
      status: 0
    });
  });

  it('never retries more than MAX_RETRIES times for a persistent transport failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(spotifyFetch('/me')).rejects.toBeInstanceOf(SpotifyApiError);

    // 1 initial attempt + 3 retries = 4 calls total, never more (no infinite loop).
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('still handles normal HTTP responses correctly alongside the new transport handling', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { ok: true }));
    const result = await spotifyFetch('/me');
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still fails fast on a 429 with Retry-After above the 60s threshold (unaffected by the fix)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(429, undefined, { 'retry-after': '80133' }));
    await expect(spotifyFetch('/me')).rejects.toMatchObject({ status: 429, retryAfterSeconds: 80133 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
