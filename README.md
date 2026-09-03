# Spotify Organizer

[![CI](https://github.com/MatheusHenrique007/spotify-organizer/actions/workflows/ci.yml/badge.svg)](https://github.com/MatheusHenrique007/spotify-organizer/actions/workflows/ci.yml)

A web app for organizing Spotify playlists through a plan → review → execute workflow, with verified,
auditable writes instead of fire-and-forget API calls.

Most "Spotify tools" either read-only inspect your library or blindly fire mutation requests and hope for the
best. This one treats playlist mutations as something worth being careful about: every destructive change goes
through an explicit plan the user reviews before anything is sent, and the two operations that delete tracks
verify against Spotify's real state afterward instead of trusting the HTTP response alone — because, in testing,
that response turned out to lie in a specific, reproducible case (see [Reliability strategy](#reliability-strategy-for-destructive-operations)
below).

No database, no cloud infrastructure, no external AI. Runs entirely on your machine.

Separately, the app also includes an optional **Theme Manager** that personalizes the *real* Spotify Desktop
client (not a preview, not a mockup) through [Spicetify](https://spicetify.app) — see
[Theme Manager](#theme-manager-spotify-desktop-personalization) below. This part is Windows-only.

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
- A backend that's unreachable (down, network error) is never treated as "logged out" — the client
  distinguishes a real "not authenticated" response from a failed connectivity check and offers a retry instead
  of redirecting to login
- Responsive layout, from 375px mobile up

### Theme Manager (Windows only)

- Real-time visual editor for 5 confirmed-working Spotify Desktop color properties, plus a custom background image
- Client-side image resize/compression before sending (no native image library on the server)
- Live preview inside the Organizer, clearly labeled as a preview, not the real Spotify window
- 5 built-in presets, each using only confirmed-working properties
- One-click "Apply to Spotify" that closes Spotify (with explicit confirmation), runs the real `spicetify apply`,
  and reports the real result — never a fabricated success
- Restore-to-original and manual backup-refresh actions, same confirm-then-execute pattern
- Every apply/restore/backup is logged in the existing local History

## Tech Stack

**Frontend** — React 18, React Router, Vite. Plain CSS with a small custom design-token system; no CSS
framework, no component library, no icon library (icons are inline SVG).

**Backend** — Node.js, Express (ESM). No database; local JSON files for tokens and history.

**Spotify** — Spotify Web API (OAuth 2.0 / PKCE, playlists, tracks, images).

**Testing** — Vitest on both server and client. 205 tests total (see [Testing](#testing)).

**Tooling** — npm workspaces, Git.

**Theme Manager (optional, Windows only)** — [Spicetify](https://spicetify.app) CLI, invoked from the server via
Node's `child_process.execFile` (never a shell string). No new npm dependency was added for this feature.

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
encrypted tokens. The executor is the only code path that writes to Spotify **through the Web API**; there's no
other route in the app that mutates a playlist.

The Theme Manager (`server/src/lib/spicetify/`, `server/src/routes/spicetify.js`, `client/src/pages/CustomizePage.jsx`
and related components) is a separate, parallel path that never touches the Spotify Web API or the routes above —
it only writes local theme files and shells out to the Spicetify CLI. See
[Theme Manager](#theme-manager-spotify-desktop-personalization) for details.

## Screenshots

Not included in this repository. The application — including the Theme Manager's effect on the real Spotify
Desktop client — was validated visually during development, but no screenshot files were saved to disk as part
of that process, so none are published here rather than substituting a mockup. Screenshots can be added later.

## Requirements

- Node.js 18+ (uses the built-in `fetch` API).
- A Spotify account and a Spotify Developer Dashboard application.
- **Only for the Theme Manager**: Windows, the Spotify Desktop app, and the [Spicetify](https://spicetify.app) CLI
  installed separately (`spicetify --version` should work in a terminal). Everything else in this project works
  without it — the Theme Manager routes simply report Spicetify as not installed if it's missing.

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

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the same two commands plus the client build on
every push and pull request, on a plain Ubuntu runner — the automated suite never touches Windows APIs, a real
Spotify Desktop install, or the Spicetify CLI, so nothing about the Theme Manager's real-machine behavior is
exercised in CI (that part was validated manually, as described throughout this README).

Current suite: **server 133 tests, client 72 tests — 205 total**, all passing, all against real application
behavior (no placeholder/smoke-only tests). Server tests cover the analysis engine (duplicate detection,
similarity scoring, small/abandoned playlist detection), the operations planner, the Spotify client
(retry/rate-limit/token-refresh behavior), the executor (all 9 operation types, including the
retry/verification strategy below), and the Theme Manager (`child_process` mocked — no test ever invokes the real
Spicetify CLI or touches a real Spotify install) — all against mocked externals, so this suite is unit-level, not
integration-level. Separately from the automated suite, several playlist operations (including the ones described
in Known Limitations) and every Theme Manager code path (apply, restore, backup, and the automatic Spotify-close
step) were also validated with real calls against a live, authenticated Spotify account and a real Spotify Desktop
install during development; that validation isn't repeatable in CI and isn't counted in the 205 figure. Client
tests cover pure presentation logic (plan editing, operation labels, history detail formatting, Theme Manager
draft/preset/status logic) — no DOM rendering library is used.

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

## Theme Manager (Spotify Desktop personalization)

`/customize` in the app is a control panel for personalizing the **real, locally installed Spotify Desktop
client** — not a preview inside this app's own UI. It works through
[Spicetify](https://spicetify.app), a third-party CLI that patches Spotify Desktop's own files. This part of the
project is Windows-only and requires Spicetify to be installed separately (see [Requirements](#requirements)).

Flow: edit colors/background → live preview (clearly labeled as a preview, not the real Spotify) → **Apply to
Spotify** → if Spotify is open, the UI asks for explicit confirmation before closing it → the server closes
Spotify Desktop for real (`taskkill`, real process, not simulated) → waits for file handles to release → runs
`spicetify apply` → Spotify reopens → the real exit code / stdout / stderr / version-mismatch result is shown,
never a fabricated "success" → the result is logged in [History](#history-and-observability). Restore and manual
backup-refresh follow the same close-with-confirmation pattern.

### Supported properties

Every property below was confirmed by diffing the live Spotify Desktop DOM (via Chrome DevTools Protocol) before
and after changing it — not by trusting Spicetify's own documentation or its `css-map.json`, which turned out to
reference at least one class that no longer exists in this Spotify build.

| Property | What it actually changes |
|---|---|
| Button | Play button and progress bar color |
| Main | The library rail background |
| Sidebar | Sidebar, top bar, and the bottom player bar together (one shared background — despite the name, it is not sidebar-only) |
| Text | Primary text and icon color across the app |
| Subtext | Secondary/muted text (e.g. search placeholder, playlist subtitles) |
| Background | A custom image behind the main content area (see below) |

### Background image

The user picks an image in the browser; it's resized (long edge capped) and re-encoded as JPEG **entirely in the
browser via `<canvas>`** — no native image library (e.g. `sharp`) was added to the server for this. The result is
embedded as a `data:image/jpeg;base64,...` URI directly in the generated `user.css`. `file://` URLs were tested
and confirmed **not** to render in this Spotify Desktop build (blocked, likely by CSP); the data-URI approach is
the only one confirmed to work. The image sits behind the real UI using `background-size: cover` and
`background-position: center`, with an adjustable dark overlay so the interface stays readable.

### Overlay and blur

Overlay opacity is adjustable within safe bounds on both the client slider and the server-side validation.
**Blur is explicitly marked "experimental" in the UI** — it was never visually confirmed against the real Spotify
Desktop client, only against a synthetic preview, so it is not presented as a supported feature.

### Variables investigated and not implemented

The following Spicetify color variables were tested the same way (real DOM diff, not documentation) and found to
have no working visual consumer in this Spotify Desktop build, so they are **not** exposed in the editor:
`player`, `misc`, `tab-active`, `button-disabled`, `notification`, `notification-error`, `shadow`, `selected-row`,
`card`. Some of these (e.g. `tab-active`) do get consumed by a real CSS rule, but the rule itself has no visible
effect (a `border-color` applied to a `border-width: 0` element, for example) — a technical consumer without a
rendered effect is treated the same as no consumer at all.

### Presets

Five presets (Spotify Classic, Midnight, Crimson, Purple Night, Minimal) are bundled — combinations invented by
this project, not official Spotify themes. Each only sets the confirmed-working properties above; picking one
never touches the background image already chosen.

### Theme Manager limitations

- The mapping from Spicetify's variable names to real, rendered DOM elements is specific to the exact Spotify
  Desktop build tested (`1.2.98.301.gfcaeba72`). Spotify updates itself silently; a future version could change
  which elements exist or which classes they use, which could re-break a currently-working property or make a
  currently-dead one start working. This has not been re-verified against any other version.
- Spicetify's backup becomes incompatible whenever Spotify updates itself; the app detects this from Spicetify's
  own real output text and surfaces a clear "backup incompatible, refresh it" state — it does not attempt to
  guess or auto-fix silently.
- The Theme Manager is Windows-only (`taskkill`/`tasklist` and `%LOCALAPPDATA%`/`%APPDATA%` paths).
- Closing Spotify Desktop automatically requires the user's explicit confirmation every time; it is never done
  silently.

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
- Concurrent OAuth attempts are isolated by `state`: each `/login` gets its own `code_verifier`, states expire
  after a TTL, and a `state` is single-use — replaying a completed callback is rejected.
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

[MIT](LICENSE)

## Manual Step Required

Real Spotify OAuth login cannot be completed without live Spotify Developer credentials. Create a Spotify app,
populate `.env` with your own `SPOTIFY_CLIENT_ID` and matching `SPOTIFY_REDIRECT_URI`, then start the app and log in
through the browser.
