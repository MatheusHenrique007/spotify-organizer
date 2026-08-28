import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { SpotifyApiError } from '../src/lib/spotifyClient.js';

function fakeRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.headersSent = false;
  return res;
}

describe('errorHandler — generic fallback preserves a real HTTP status instead of always 500', () => {
  it('err.status 400 -> HTTP 400', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('bad body'), { status: 400 }), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'request_error', message: 'bad body' });
  });

  it('err.statusCode 400 -> HTTP 400 (some libraries use statusCode instead of status)', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('bad body'), { statusCode: 400 }), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('no status/statusCode at all -> HTTP 500, never a fabricated success code', () => {
    const res = fakeRes();
    errorHandler(new Error('boom'), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'internal_error', message: 'boom' });
  });

  it('an invalid status (out of 4xx/5xx range) falls back to 500 instead of trusting an arbitrary value', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('weird'), { status: 200 }), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('a non-integer/NaN status falls back to 500 rather than crashing res.status()', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('weird'), { status: 'nope' }), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('errorHandler — known SpotifyApiError keeps its existing dedicated shape/status untouched', () => {
  it('still uses its own status and spotify_api_error shape, not the generic fallback', () => {
    const res = fakeRes();
    const err = new SpotifyApiError(429, 'Too many requests', null, 5);
    errorHandler(err, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'spotify_api_error',
      message: 'Too many requests',
      status: 429,
      retryAfterSeconds: 5
    });
  });

  it('defaults to 502 when the SpotifyApiError carries no status, exactly as before this fix', () => {
    const res = fakeRes();
    const err = new SpotifyApiError(undefined, 'unreachable');
    errorHandler(err, {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(502);
  });
});
