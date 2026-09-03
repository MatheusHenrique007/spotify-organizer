import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';

// Route-contract tests: real HTTP -> real Express app -> real route logic.
// tokenStore is mocked (no real token file written); the Spotify token-exchange endpoint
// (a hardcoded external URL called via global fetch) is intercepted while everything else
// goes through the real fetch to the local test server.
const saveTokens = vi.fn();
const loadTokens = vi.fn();
const clearTokens = vi.fn();

vi.mock('../src/lib/tokenStore.js', () => ({ saveTokens, loadTokens, clearTokens }));

let server;
let baseUrl;
let realFetch;
let config;

beforeAll(async () => {
  ({ config } = await import('../src/lib/config.js'));
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  realFetch = globalThis.fetch;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockTokenExchange(implementation) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, options) => {
    if (typeof url === 'string' && url === config.spotify.tokenUrl) {
      return implementation(url, options);
    }
    return realFetch(url, options);
  });
}

function tokenExchangeOk() {
  return Promise.resolve(
    new Response(
      JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'x' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  );
}

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, { redirect: 'manual' });
  const location = response.headers.get('location');
  const state = new URL(location).searchParams.get('state');
  return { state };
}

function callback(state, extraParams = {}) {
  const params = new URLSearchParams({ code: 'fake-code', state, ...extraParams });
  return fetch(`${baseUrl}/callback?${params.toString()}`, { redirect: 'manual' });
}

describe('auth — pending state per attempt (Map keyed by state)', () => {
  it('Teste 1: two /login calls produce two different states', async () => {
    const a = await login();
    const b = await login();
    expect(a.state).toBeTruthy();
    expect(b.state).toBeTruthy();
    expect(a.state).not.toBe(b.state);
  });

  it('Teste 2: login A is not invalidated by a later login B — both callbacks succeed', async () => {
    mockTokenExchange(tokenExchangeOk);

    const a = await login();
    const b = await login();

    const responseA = await callback(a.state);
    expect(responseA.status).toBe(302);
    expect(responseA.headers.get('location')).toBe(`${config.clientUrl}/dashboard`);

    const responseB = await callback(b.state);
    expect(responseB.status).toBe(302);
    expect(responseB.headers.get('location')).toBe(`${config.clientUrl}/dashboard`);

    expect(saveTokens).toHaveBeenCalledTimes(2);
  });

  it('Teste 3: callback with an unknown state redirects with invalid_state', async () => {
    const response = await callback('never-issued-state');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${config.clientUrl}/login?error=invalid_state`);
  });

  it('Teste 4: callback with an expired state redirects with invalid_state', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    const start = 1_700_000_000_000;
    nowSpy.mockReturnValue(start);

    const { state } = await login();

    nowSpy.mockReturnValue(start + 11 * 60 * 1000); // 11 minutes later, TTL is 10
    const response = await callback(state);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${config.clientUrl}/login?error=invalid_state`);
    nowSpy.mockRestore();
  });

  it('Teste 5: a state is single-use — replaying the same callback fails the second time', async () => {
    mockTokenExchange(tokenExchangeOk);

    const { state } = await login();

    const first = await callback(state);
    expect(first.status).toBe(302);
    expect(first.headers.get('location')).toBe(`${config.clientUrl}/dashboard`);

    const second = await callback(state);
    expect(second.status).toBe(302);
    expect(second.headers.get('location')).toBe(`${config.clientUrl}/login?error=invalid_state`);
  });
});
