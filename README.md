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
- Change plan system: build a plan of operations, choose which to apply (including inline editing of a suggested
  playlist rename before applying), review, confirm, execute. Editing stays in local UI state and never triggers a
  network call — the edited value is only merged into the plan at execution time. The Apply button is the single
  place that triggers writes, and it disables itself while an execution is in flight.
- Custom cover image upload (base64 JPEG) via the Spotify API.
- Local history/audit log with best-effort restore data.
- Robust error handling: 401 triggers a token refresh + retry. For 429, a `Retry-After` of 60 seconds or less gets a
  limited retry (up to 3 attempts total); anything longer fails immediately with a controlled error instead of
  blocking the request — `retryAfterSeconds` is attached to the error so the caller knows roughly how long the
  limit lasts. A per-artist genre lookup failure (e.g. rate limiting) does not abort the whole analysis: the failing
  artist IDs are collected and reported (`failedArtistIds`, `genreLookupFailures`), while duplicates, small/abandoned
  playlist detection, and the rest of the analysis still complete normally.
- Artist genre lookups are cached to disk (`server/data/artist-genre-cache.json`, 7-day TTL) so repeated analyses
  don't re-fetch genres for artists already looked up. The cache only stores `{ genres, fetchedAt }` per artist ID —
  no tokens or credentials.

## Architecture & Stack

- **Backend**: Node.js + Express (ESM). No database — local JSON files under `server/data/` for tokens and
  history.
- **Frontend**: React 18 + Vite, React Router. Plain CSS, responsive down to ~768px.
- **Tests**: Vitest on both server and client — see Testing below.

```
spotify-organizer/
  server/
    src/
      lib/           # config, crypto, token/history storage, Spotify client, genre cache,
                     # analysis engine, planner, executor
      middleware/     # auth guard, error handler
      routes/         # auth, me, playlists, analysis, plans, history
      data/           # tokens.json / history.json / artist-genre-cache.json (gitignored, created at runtime)
    test/             # Vitest unit tests
  client/
    src/
      components/     # NavBar, ErrorBanner, LoadingSpinner
      pages/          # Login, Dashboard, PlaylistDetail, Analysis, PlanBuilder, History
      lib/            # api.js (backend fetch wrapper), plan editing and presentation helpers
    test/             # Vitest unit tests (pure logic, no DOM rendering)
```

## Requirements

- Node.js 18+ (uses the built-in `fetch` API).
- A Spotify account and a Spotify Developer Dashboard application.

## Spotify Developer Dashboard Setup

1. Go to https://developer.spotify.com/dashboard and create an app.
2. Add a Redirect URI matching your `.env` value, e.g. `http://127.0.0.1:8888/callback`.
3. Copy the **Client ID** (no client secret is needed — this app uses PKCE, a public-client flow).
4. Required scopes are requested automatically by the app: `playlist-read-private`,
   `playlist-read-collaborative`, `playlist-modify-public`, `playlist-modify-private`, `ugc-image-upload`,
   `user-read-private`, `user-read-email`.

## Configuration

Copy `.env.example` to `.env` at the project root and fill in the values:

```
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
TOKEN_ENCRYPTION_KEY=a_long_random_secret
PORT=8888
CLIENT_URL=http://127.0.0.1:5173
```

| Variable | Required | Purpose |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | yes | Client ID from your Spotify Developer Dashboard app. |
| `SPOTIFY_REDIRECT_URI` | yes | Must exactly match a Redirect URI registered on the Spotify app. |
| `TOKEN_ENCRYPTION_KEY` | yes | Passphrase used to derive the AES-256-GCM key that encrypts `tokens.json` at rest. |
| `PORT` | no (default `8888`) | Backend server port. |
| `CLIENT_URL` | no (default `http://127.0.0.1:5173`) | Frontend origin, used for CORS and post-auth redirects. |
| `DRY_RUN` | no (default `false`) | When `true`, write operations to Spotify are short-circuited — no request is actually sent. Useful for exercising the plan/execute flow without touching real playlists. |

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

This runs the server suite followed by the client suite. To run either one on its own:
`npm run test --workspace server` or `npm run test --workspace client`.

Current suite: **server 85 tests, client 18 tests — 103 total**, all passing. Server tests cover the analysis
engine (duplicate detection, similarity scoring, small/abandoned playlist detection), the operations planner, the
Spotify client (retry/rate-limit/token-refresh behavior), and the executor (all 9 operation types, including the
retry/verification strategy below), all against a mocked Spotify API. Client tests cover pure presentation logic
(plan editing, operation labels, history detail formatting) — no DOM rendering library is used.

## Reliability strategy for destructive operations

`remove_tracks` and `dedupe_tracks` delete items from a playlist, an action that can't be undone by re-adding the
same tracks with full fidelity. Real-world testing against the Spotify API surfaced a case where a `DELETE` request
returns a successful HTTP status without actually removing anything — observed when the playlist had multiple
occurrences of the same track and the `snapshot_id` used for the request had gone stale. Trusting the HTTP response
alone would have reported success on an operation that silently did nothing.

To avoid that, both operations follow this sequence:

1. Read the playlist's current `snapshot_id`.
2. Send the delete request with that snapshot.
3. Re-fetch the playlist and verify the targeted track(s) are actually gone.
4. If verification fails, retry **once** with a freshly read snapshot, then verify again.
5. If verification still fails, return an explicit failure — never a false success.

Each result also carries `details` (attempt count, whether a retry ran, verification outcome, snapshots used) so a
failure can be diagnosed from the history log. This strategy **detects** the Spotify-side inconsistency reliably; it
does not fix or explain its root cause.

## Known limitations

These are open technical debts, documented rather than hidden:

1. **`dedupe_tracks` can remove more than intended.** The suggestion logic is built to keep the first occurrence of
   a duplicated track and remove only the extras, but a real test against the Spotify API (`DELETE .../items` with
   `positions`) showed all occurrences being removed instead of just the targeted ones. Checking Spotify's current
   API reference confirms why: the non-deprecated `Remove Playlist Items` endpoint (the one this app uses) documents
   only `items` (URIs) and `snapshot_id` in its request body — `positions` is not part of its schema. `positions`
   only appears in the documentation of the older, deprecated remove-tracks endpoint. Since this app deliberately
   avoids deprecated endpoints, there is currently no officially documented way, on the endpoint this app uses, to
   remove only specific occurrences of a duplicated URI. The plan review screen shows an explicit warning on this
   operation, and it stays that way until Spotify's current API exposes a supported way to do this.
2. The exact root cause of the Spotify-side snapshot staleness described above hasn't been determined — only its
   effect is known and handled by the retry/verification strategy.
3. **`reorder_tracks` has no retry/verification strategy.** It was validated in the real scenarios tested (including
   immediately after an `add_tracks` call, to stress a freshly changed snapshot) with no failures, but that's not
   proof it's immune to the same class of issue — it just has no observed failure to justify adding the extra
   complexity yet.
4. **`change_cover_image`**: the error path was verified against the real API (an invalid image is rejected by
   Spotify with a clear error, correctly surfaced and logged, not swallowed). The success path (a real image
   actually being accepted and applied) has not been exercised in this project — no suitable real image file was
   available to test with.
5. **`rename_playlist` and `change_description`**: both the success path and a real failure path (invalid playlist
   ID → Spotify's 404, correctly surfaced as `Resource not found` and logged) have been verified against the real
   API.

## History and observability

Every executed plan is logged locally with per-operation results. For `remove_tracks` and `dedupe_tracks`, the log
also includes execution details when available: number of attempts, whether a retry happened, whether the
post-write verification passed, how many snapshots were used, and which track URIs were targeted. Operations that
don't produce this data (e.g. `add_tracks`) simply don't show a details section — nothing is fabricated.

## Security Notes

- This app is designed for local, single-user, personal use only. It is not hardened for multi-user or public
  deployment.
- No client secret is stored or required (PKCE flow for public clients).
- Tokens are encrypted at rest with AES-256-GCM; the key is derived via scrypt from `TOKEN_ENCRYPTION_KEY`. Anyone
  with both the encrypted file and your `.env` secret can decrypt it — protect your `.env` file.
- `.env`, the `server/data/` contents, and build artifacts are gitignored.
- CORS is restricted to `CLIENT_URL`.

## Spotify API Limitations & How They're Handled

- **No playlist-level "last modified" field**: Spotify's API does not expose when a playlist was last edited.
  Staleness/abandonment is estimated from the most recent track `added_at` timestamp, which can be missing or
  unreliable for some playlists (e.g., collaborative playlists). This is documented in the Analysis view.
- **Rate limiting (429)**: The Spotify client reads the `Retry-After` header. If it's 60 seconds or less, it retries
  with backoff (up to 3 attempts total). If it's longer than 60 seconds, the request fails immediately instead of
  blocking — the error carries `retryAfterSeconds` so the caller can report how long the limit is expected to last.
  This also applies to the per-artist genre lookups used by Analysis: a rate-limited artist is skipped (reported in
  `failedArtistIds`), and the rest of the analysis still completes.
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
  changes to a user's real playlists. There is no other route in the app that writes to Spotify outside this flow.

## Operations Supported by the Executor

Each operation type maps to one current (non-deprecated) Spotify Web API endpoint:

| Operation | Endpoint | Method |
|---|---|---|
| `create_playlist` | `/me/playlists` | POST |
| `rename_playlist` | `/playlists/{id}` | PUT |
| `change_description` | `/playlists/{id}` | PUT |
| `add_tracks` | `/playlists/{id}/items` | POST |
| `remove_tracks` | `/playlists/{id}/items` | DELETE |
| `dedupe_tracks` | `/playlists/{id}/items` | DELETE |
| `reorder_tracks` | `/playlists/{id}/items` | PUT |
| `replace_tracks` | `/playlists/{id}/items` | PUT |
| `change_cover_image` | `/playlists/{id}/images` | PUT |

`remove_tracks`, `dedupe_tracks`, and `reorder_tracks` fetch the playlist's current `snapshot_id` before writing, to
reduce the risk of applying a change against a stale version of the playlist.

`replace_tracks` reads the playlist's full current track list *before* replacing it, and stores those URIs as
`previousTrackUris` in the operation's result. If that read fails, the replace is aborted and nothing is written.
This only captures the data needed for a future manual or automated restore — there is currently no automatic
restore action built on top of it.

## Project status

Ready for personal use and portfolio review, with known technical debts documented above. Not "production-ready"
in the sense of multi-user or public deployment — see Security Notes.

## Manual Step Required

Real Spotify OAuth login cannot be completed without live Spotify Developer credentials. Create a Spotify app,
populate `.env` with your own `SPOTIFY_CLIENT_ID` and matching `SPOTIFY_REDIRECT_URI`, then start the app and log in
through the browser.
