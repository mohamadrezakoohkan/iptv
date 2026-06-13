# IPTV Broadcast Console

A single-page web application — with a switchable **light/dark theme** (a
sun/moon toggle in the top-right; dark by default) — that connects to any
Xtream-compatible IPTV portal **or any standard M3U/M3U8 playlist URL** and
lets you browse live channels by category, sort the channel
list, search by name, mark favourites, and stream the selected channel directly
in the browser — HLS (`.m3u8`)
streams play via hls.js, raw MPEG-TS streams (the common Xtream live output)
via mpegts.js. On browsers without Media Source Extensions (e.g. iOS Safari),
the server remuxes live TS to HLS on the fly so streams still play.

It remembers **multiple accounts** at once: a top-right nav button opens a
right slide-in panel that names the connected account and its server URL, and
lets you switch between saved accounts, add a new one, or remove one. The same
panel offers a built-in **Community playlists** section — a curated list of
public iptv-org playlists you can connect to with one click, no URL typing.

A built-in **demo mode** (enter `demo` as the portal URL) loads a curated
playlist of publicly accessible HLS test streams — no real credentials required.

## Stack

| Layer   | Technology                                                  |
|---------|-------------------------------------------------------------|
| Runtime | Node.js >= 18                                               |
| Server  | Express 4 (static file serving + Xtream CORS proxy)         |
| Client  | Vanilla JS ES2020 — no framework, no bundler, no transpiler |
| Player  | hls.js 1.5 (CDN, + native HLS fallback) for `.m3u8` · mpegts.js 1.7 (CDN) for raw MPEG-TS · server-side TS→HLS remux fallback (ffmpeg-static, stream copy) for MSE-less browsers |
| CSS     | Plain CSS with custom properties                            |
| Fonts   | Space Grotesk + IBM Plex Mono (Google Fonts CDN)            |

## Setup

```bash
npm install
```

`npm install` is the only setup step — the ffmpeg binary used for the
TS→HLS remux fallback ships with the `ffmpeg-static` package (no system
ffmpeg required).

## Run

```bash
node src/server/srv.js
```

Open `http://localhost:3000` in your browser. Enter `demo` as the portal URL
to try without real credentials.

## Test

```bash
# Unit tests (Vitest)
npx vitest run

# UI / e2e tests (Playwright)
npx playwright test

# Integration tests (Vitest, requires live outbound network)
npx vitest run --config vitest.int.config.js   # alias: npm run test:int
```

The integration suite validates real connectivity over the live network:
the public iptv-org playlist (`https://iptv-org.github.io/iptv/index.m3u`)
for the M3U path, and a real Xtream portal end-to-end (connect, list
categories/channels, fetch playable MPEG-TS bytes through the proxy). It
fails by design when the network is down and is excluded from the unit
command.

## Deployment

The app deploys to **Fly.io** as a Docker container named **`teeatr`**:

```bash
fly deploy
```

`fly deploy` builds the repo `Dockerfile` (multi-stage Node image — `npm ci`
installs dependencies including the bundled `ffmpeg-static` binary) and runs
the same `node src/server/srv.js` server that runs locally, listening on
port **8080** (`fly.toml` sets `[env] PORT = '8080'` matching
`http_service.internal_port = 8080` and the Dockerfile `EXPOSE 8080`).

The image **self-binds PORT 8080 by default** — `ENV PORT=8080` is baked into
the Dockerfile — so `fly deploy` works without any extra env and a bare
`docker run -p 8080:8080 teeatr` also serves on 8080 (an explicit `PORT` still
overrides). See ADR-0028 for the self-bind rationale and the 4-way
port-coherence invariant.

A long-running container — rather than static or serverless hosting — is the
deployment target precisely because the product needs a stateful process: the
**CORS proxy** pipes unbounded, long-lived live streams, and the **server-side
TS→HLS ffmpeg remux** spawns `ffmpeg` per source and serves the produced HLS
segments. Both keep working in production unchanged.

Secrets are set with `fly secrets set …` (never baked into the image — the
`.dockerignore` keeps `.env.secrets` out of the build context). The deployment
artifacts (`Dockerfile`, `fly.toml`, `.dockerignore`) are guarded by a
config-consistency unit test (in the `npx vitest run` gate) and a Docker
build-smoke test; see `docs/specs/deployment.md` and ADR-0027 for the full
rationale, invariants, and validation strategy.

## Features

- **Xtream portal playback** — connect with portal URL + username/password;
  channels are normalized into one canonical schema, and live MPEG-TS
  streams (including 302-redirected, tokenized stream URLs) play through
  the local proxy via mpegts.js.
- **M3U playlist support** — pick the "Playlist URL only" login mode and
  paste any `.m3u` or `.m3u8` URL; credentials are hidden and channels
  arrive in the same browse/play UX as Xtream portals.
- **Explicit login mode** — a footer selector chooses between
  Xtream (username & password) and M3U (playlist URL only); the choice
  persists across refreshes.
- **Category sidebar** — browse channels by category; "All Channels"
  shows everything, "Favourites" is pinned. Categories come from the
  connected source's own grouping, in the source's own delivery order
  (Xtream from `get_live_categories`, M3U / community presets from the
  first-level segment of each entry's `group-title` — the text before the
  first `;`, trimmed and deduped, so `Classic;Comedy` and `Classic;Series`
  collapse to a single `Classic` category); clicking one filters the channel
  grid.
- **Channel grid** — card per channel showing logo, number, and name; star to
  favourite. When a list renders no rows, the grid shows a contextual,
  actionable placeholder that explains *why* it is empty (no search matches,
  empty category, no favourites yet, or a source with no channels) and offers a
  one-tap way out where one exists (Clear search, Browse all channels).
- **Channel sort** — a "Sort" control in the channel-grid toolbar orders the
  visible channels by number, name (A→Z or Z→A), or favourites-first; the
  choice persists across reloads (global, not per-account).
- **Search** — live-filter channels by name from the sidebar search input.
- **Dual-engine player** — idle, playing, and error states; autoplay on
  channel select; engine chosen from the stream URL (`.m3u8` → hls.js,
  otherwise mpegts.js). A single contextual format chip appears on top of the
  player only while a channel is playing, labelled for the resolved engine
  (HLS / TS); clicking it toggles an inline "Playing via …" detail. The
  no-signal states are guided rather than terse: the idle player tells you to
  pick a channel (or connect a source when there is no session), and a failed
  stream shows a human-readable "This channel won't play" message with a
  **Retry** button — the raw engine detail is kept only as a small diagnostic
  line, not the headline.
- **MSE-less fallback (iOS Safari)** — when the browser lacks Media Source
  Extensions, raw TS streams are remuxed server-side to live HLS
  (`GET /api/hls?url=…`, ffmpeg stream copy, per-source sessions reaped
  when idle) and played through native HLS or hls.js — no
  "MPEG-TS not supported" dead end.
- **Multiple accounts** — a top-right account nav button opens a right
  slide-in panel showing the connected account name + server URL; from there
  you can switch to another saved account (its stored connection is replayed,
  no re-typing), add a new account (returns to the footer login), or remove a
  saved account. All saved accounts persist across refreshes; a pre-existing
  single-account install is migrated automatically on first load.
- **Community playlists** — the account panel includes an always-present,
  curated list of public iptv-org playlists (All, English, News, Sports,
  Music). Click one to connect on the M3U path with no typing; on success it
  becomes an ordinary saved account (deduped, switchable, removable). The
  list is read-only — present even before you have saved any account of your
  own — so it is the default account list provided by the community.
- **Light / dark theme** — a sun/moon toggle in the top-right corner (left of
  the account button) switches between the default dark "broadcast console"
  look and a light theme. The whole palette recolours through CSS custom-
  property tokens overridden by a `data-theme` attribute on the document root;
  the choice persists across reloads (`localStorage`, single client-wide
  setting — not per account). It is an explicit user choice, not OS-detected.
- **Footer** — login-mode selector + login form + connected status bar
  showing host and channel count.
- **Persistence** — saved accounts and the active account, login mode (per
  account), last-selected channel, the channel sort preference, the chosen
  theme, and favourites survive page refreshes via `localStorage`.
- **CORS proxy** — server proxies all external URL fetches (Xtream API calls,
  M3U files, and live streams) so remote hosts without CORS headers work from
  the browser; it follows validated redirects (up to 5 hops, SSRF-checked)
  and pipes unbounded live streams, aborting upstream on disconnect.

## Architecture

See `CORE_FLOW.md` for how this project is built, `CHANGELOG.md` for the full
evolution history, and `docs/adrs/` for every architecture decision.
