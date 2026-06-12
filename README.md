# IPTV Broadcast Console

A dark-themed, single-page web application that connects to any
Xtream-compatible IPTV portal **or any standard M3U/M3U8 playlist URL** and
lets you browse live channels by category, search by name, mark favourites,
and stream the selected channel directly in the browser — HLS (`.m3u8`)
streams play via hls.js, raw MPEG-TS streams (the common Xtream live output)
via mpegts.js. On browsers without Media Source Extensions (e.g. iOS Safari),
the server remuxes live TS to HLS on the fly so streams still play.

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
node server/srv.js
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
- **Category sidebar** — browse channels by category; "All Channels" shows
  everything.
- **Channel grid** — card per channel showing logo, number, and name; star to
  favourite.
- **Search** — live-filter channels by name from the sidebar search input.
- **Dual-engine player** — idle, playing, and error states; autoplay on
  channel select; engine chosen from the stream URL (`.m3u8` → hls.js,
  otherwise mpegts.js), with HLS/TS chips indicating the engine in use.
- **MSE-less fallback (iOS Safari)** — when the browser lacks Media Source
  Extensions, raw TS streams are remuxed server-side to live HLS
  (`GET /api/hls?url=…`, ffmpeg stream copy, per-source sessions reaped
  when idle) and played through native HLS or hls.js — no
  "MPEG-TS not supported" dead end.
- **Footer** — login-mode selector + login form + connected status bar
  showing host and channel count.
- **Persistence** — credentials, login mode, last-selected channel, and
  favourites survive page refreshes via `localStorage`.
- **CORS proxy** — server proxies all external URL fetches (Xtream API calls,
  M3U files, and live streams) so remote hosts without CORS headers work from
  the browser; it follows validated redirects (up to 5 hops, SSRF-checked)
  and pipes unbounded live streams, aborting upstream on disconnect.

## Architecture

See `CORE_FLOW.md` for how this project is built, `CHANGELOG.md` for the full
evolution history, and `adrs/` for every architecture decision.
