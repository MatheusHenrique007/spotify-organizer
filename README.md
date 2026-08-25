# Spotify Playlist Organizer

A local, personal-use web app to analyze and reorganize your Spotify playlists: find duplicates, near-duplicate
tracks, similar/mergeable playlists, and small or abandoned playlists, then build and apply a reviewed change plan
directly against the Spotify Web API.

No database, no cloud infrastructure, no external AI. Runs entirely on your machine.

## Features

- Spotify OAuth 2.0 Authorization Code Flow with PKCE (no client secret required).
- Tokens stored in a local JSON file, encrypted at rest (AES-256-GCM, key derived via scrypt from a secret in `.env`).
- Automatic access token refresh; logout clears local tokens.
- Dashboard: profile, playlists, track counts.
- Deterministic analysis engine (no external AI/ML):
  - Exact duplicate detection (by Spotify track ID).
  - Fuzzy duplicate detection (normalized title + primary artist).
  - Playlist similarity via Jaccard index on track sets, artist sets, and genre sets.
  - Small/abandoned playlist detection (track count threshold + best-effort recency from track `added_at`).
  - Deterministic rename/description suggestions from top artists/genres, and merge candidates from similarity scores.
- Change plan system: build a plan of operations, choose which to apply, review, confirm, execute.
- Custom cover image upload (base64 JPEG) via the Spotify API.
- Local history/audit log with best-effort restore data.
- Robust error handling: 401 triggers a token refresh + retry, 429 respects `Retry-After` with backoff, other errors
  surface to the UI with status and message.

## Architecture & Stack

- **Backend**: Node.js + Express (ESM). No database — local JSON files under `server/src/data/` for tokens and
  history.
- **Frontend**: React 18 + Vite, React Router. Plain CSS, responsive down to ~768px.
- **Tests**: Vitest for the analysis engine and operations planner (mocked Spotify API calls).

```
spotify-organizer/
  server/
    src/
      lib/           # config, crypto, token/history storage, Spotify client, analysis engine, planner, executor
      middleware/     # auth guard, error handler
      routes/         # auth, me, playlists, analysis, plans, history
      data/           # tokens.json / history.json (gitignored, created at runtime)
    test/             # Vitest unit tests
  client/
    src/
      components/     # NavBar, ErrorBanner, LoadingSpinner
      pages/          # Login, Dashboard, PlaylistDetail, Analysis, PlanBuilder, History
      lib/api.js       # fetch wrapper for the backend API
```

## Requirements

- Node.js 18+ (uses the built-in `fetch` API).
- A Spotify account and a Spotify Developer Dashboard application.

## Spotify Developer Dashboard Setup

1. Go to https://developer.spotify.com/dashboard and create an app.
2. Add a Redirect URI matching your `.env` value, e.g. `http://127.0.0.1:8888/api/auth/callback`.
3. Copy the **Client ID** (no client secret is needed — this app uses PKCE, a public-client flow).
4. Required scopes are requested automatically by the app: `playlist-read-private`,
   `playlist-read-collaborative`, `playlist-modify-public`, `playlist-modify-private`, `ugc-image-upload`,
   `user-read-private`, `user-read-email`.

## Configuration

Copy `.env.example` to `.env` at the project root and fill in the values:

```
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/api/auth/callback
TOKEN_ENCRYPTION_KEY=a_long_random_secret
PORT=8888
CLIENT_URL=http://127.0.0.1:5173
```

## Installation

```
npm run install:all
```

This installs dependencies for the root, `server/`, and `client/` npm workspaces.

## Running

```
npm run dev
```

This runs the backend (port 8888) and frontend (port 5173) concurrently. Open http://127.0.0.1:5173 and log in with
Spotify.

To run them separately: `npm run dev:server` and `npm run dev:client`.

## Testing

```
npm test
```

Runs the Vitest suite covering the analysis engine (duplicate detection, similarity scoring, small/abandoned
playlist detection) and the operations planner (with a mocked Spotify API client).

## Security Notes

- This app is designed for local, single-user, personal use only. It is not hardened for multi-user or public
  deployment.
- No client secret is stored or required (PKCE flow for public clients).
- Tokens are encrypted at rest with AES-256-GCM; the key is derived via scrypt from `TOKEN_ENCRYPTION_KEY`. Anyone
  with both the encrypted file and your `.env` secret can decrypt it — protect your `.env` file.
- `.env`, the `server/src/data/` contents, and build artifacts are gitignored.
- CORS is restricted to `CLIENT_URL`.

## Spotify API Limitations & How They're Handled

- **No playlist-level "last modified" field**: Spotify's API does not expose when a playlist was last edited.
  Staleness/abandonment is estimated from the most recent track `added_at` timestamp, which can be missing or
  unreliable for some playlists (e.g., collaborative playlists). This is documented in the Analysis view.
- **Rate limiting (429)**: The Spotify client reads the `Retry-After` header and retries with backoff (up to 3
  attempts) before surfacing an error.
- **Expired access tokens (401)**: The client automatically refreshes the access token once and retries the request
  before failing.
- **Cover images**: The custom cover image endpoint only supports *setting* a new base64 JPEG image. There is no
  API to revert a playlist to Spotify's auto-generated default cover — this is documented in the UI and README.
- **Undo/restore**: The history log stores best-effort restore data (e.g., removed track URIs, previous
  name/description) so common operations can be manually reversed, but full undo is not always possible — for
  example, a deleted playlist cannot be recreated with its original ID, followers, or collaborative state.

## Key Technical Decisions

- **No database**: local JSON files are sufficient for single-user token/history storage and avoid unnecessary
  infrastructure.
- **PKCE over Authorization Code with a client secret**: avoids storing a client secret at all, which is safer for a
  locally-run app whose source may be shared.
- **Deterministic analysis only**: duplicate/similarity/staleness detection uses explicit, auditable rules (ID
  matching, string normalization, Jaccard index) instead of an external AI service, keeping the app fully local and
  reproducible.
- **Plan/review/execute separation**: mutating operations are never applied directly from analysis. A plan is built
  first, the user selects and reviews operations, and only then are they executed — reducing the risk of unwanted
  changes to a user's real playlists.

## Manual Step Required

Real Spotify OAuth login cannot be completed without live Spotify Developer credentials. Create a Spotify app,
populate `.env` with your own `SPOTIFY_CLIENT_ID` and matching `SPOTIFY_REDIRECT_URI`, then start the app and log in
through the browser.
