# Spotify Organizer

A web app for organizing Spotify playlists through a plan → review → execute workflow, with verified,
auditable writes instead of fire-and-forget API calls.

Most "Spotify tools" either read-only inspect your library or blindly fire mutation requests and hope for the
best. This one treats playlist mutations as something worth being careful about: every destructive change goes
through an explicit plan the user reviews before anything is sent, and the two operations that delete tracks
verify against Spotify's real state afterward instead of trusting the HTTP response alone — because, in testing,
that response turned out to lie in a specific, reproducible case (see [Reliability strategy](#reliability-strategy-for-destructive-operations)
below).

No database, no cloud infrastructure, no external AI. Runs entirely on your machine.

## What it does

- Lists your Spotify playlists and lets you browse a playlist's full track list (name, artist, duration).
- Runs a deterministic analysis pass over your library: exact and near-duplicate tracks, playlists similar
  enough to be merge candidates, and small/abandoned playlists.
- Turns that analysis into a **plan** — a list of concrete operations (rename, dedupe, add/remove tracks, etc.)
  the user can select, edit, and review before anything touches Spotify.
- Executes the selected operations against the real Spotify Web API, with a stricter, verify-then-retry path
  for the two operations known to be able to silently no-op (`remove_tracks`, `dedupe_tracks`).
- Logs every executed plan locally with per-operation results, so failures and retries are diagnosable after
  the fact instead of disappearing into a toast notification.

## Features

- Spotify OAuth 2.0 Authorization Code Flow with PKCE (no client secret required)
- Playlist browsing with real cover art, track counts, and per-track duration
- Deterministic analysis: exact/fuzzy duplicate detection, playlist similarity, small/abandoned playlist flags
- Plan builder: select which suggested operations to apply, edit a suggested rename inline, review before executing
- 9 operation types executed against the real Spotify Web API (see [table below](#operations-supported-by-the-executor))
- Verify-then-retry strategy for the two operations that can silently fail (see below)
- Local execution history with per-operation results and, where available, retry/verification details
- Token encryption at rest, automatic refresh, no client secret stored
- Loading, empty, and error states with retry — no raw stack traces shown to the user
- Responsive layout, from 375px mobile up

## Tech Stack

**Frontend** — React 18, React Router, Vite. Plain CSS with a small custom design-token system; no CSS
framework, no component library, no icon library (icons are inline SVG).

**Backend** — Node.js, Express (ESM). No database; local JSON files for tokens and history.

**Spotify** — Spotify Web API (OAuth 2.0 / PKCE, playlists, tracks, images).

**Testing** — Vitest on both server and client. 103 tests total (see [Testing](#testing)).

**Tooling** — npm workspaces, Git.

## Architecture

```
Browser (React client)
        │
        │  fetch — client/src/lib/api.js
        ▼
Express server  ── auth / playlists / analysis / plans / history routes
        │
        ├── analysis engine   (duplicates, similarity, small/abandoned detection)
        ├── planner           (suggestions → concrete operations)
        ├── executor           (runs one operation type at a time)
        │       │
        │       └── verify-then-retry strategy for remove_tracks / dedupe_tracks
        │
        ├── history store     (local JSON log of every executed plan)
        │
        ▼
Spotify Web API
```

The client never calls Spotify directly — every request goes through the Express server, which holds the
encrypted tokens. The executor is the only code path that writes to Spotify; there's no other route in the app
that mutates a playlist.

## Screenshots

Not included in this repository. The application was validated visually against a real, authenticated Spotify
account during development (see commit history), but no screenshot files were saved to disk as part of that
process, so none are published here rather than substituting a mockup.

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

## Installation

```
npm run install:all
```

This installs dependencies for the root, `server/`, and `client/` npm workspaces.

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

Current suite: **server 85 tests, client 18 tests — 103 total**, all passing, all against real application
behavior (no placeholder/smoke-only tests). Server tests cover the analysis engine (duplicate detection,
similarity scoring, small/abandoned playlist detection), the operations planner, the Spotify client
(retry/rate-limit/token-refresh behavior), and the executor (all 9 operation types, including the
retry/verification strategy below) — all against a mocked Spotify API, so this suite is unit-level, not
integration-level. Separately from the automated suite, several operations (including the ones described in
Known Limitations) were also validated with real calls against a live, authenticated Spotify account during
development; that validation isn't repeatable in CI and isn't counted in the 103 figure. Client tests cover
pure presentation logic (plan editing, operation labels, history detail formatting) — no DOM rendering library
is used.

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

## License

No license file is included in this repository. All rights reserved by default under copyright law unless a
license is added.

## Manual Step Required

Real Spotify OAuth login cannot be completed without live Spotify Developer credentials. Create a Spotify app,
populate `.env` with your own `SPOTIFY_CLIENT_ID` and matching `SPOTIFY_REDIRECT_URI`, then start the app and log in
through the browser.
