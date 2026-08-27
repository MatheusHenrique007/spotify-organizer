import { Router } from 'express';
import { config } from '../lib/config.js';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../lib/crypto.js';
import { saveTokens, loadTokens, clearTokens } from '../lib/tokenStore.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const authRouter = Router();

let pendingAuth = null;

authRouter.get('/login', (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();
  pendingAuth = { codeVerifier, state };

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.spotify.clientId,
    scope: config.spotify.scopes.join(' '),
    redirect_uri: config.spotify.redirectUri,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });

  res.redirect(`${config.spotify.authUrl}?${params.toString()}`);
});

export const authCallbackHandler = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${config.clientUrl}/login?error=${encodeURIComponent(error)}`);
  }

  if (!pendingAuth || state !== pendingAuth.state) {
    return res.redirect(`${config.clientUrl}/login?error=invalid_state`);
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.spotify.redirectUri,
    client_id: config.spotify.clientId,
    code_verifier: pendingAuth.codeVerifier
  });

  const response = await fetch(config.spotify.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  pendingAuth = null;

  if (!response.ok) {
    return res.redirect(`${config.clientUrl}/login?error=token_exchange_failed`);
  }

  const data = await response.json();
  saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope
  });

  res.redirect(`${config.clientUrl}/dashboard`);
});

authRouter.get('/status', (req, res) => {
  const tokens = loadTokens();
  res.json({ authenticated: Boolean(tokens) });
});

authRouter.post('/logout', (req, res) => {
  clearTokens();
  res.json({ success: true });
});
