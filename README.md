# IPTV Broadcast Console

A dark-themed, single-page web application that connects to any
Xtream-compatible IPTV portal **or any standard M3U/M3U8 playlist URL** and
lets you browse live channels by category, search by name, mark favourites,
and stream the selected channel via HLS directly in the browser.

A built-in **demo mode** (enter `demo` as the portal URL) loads a curated
playlist of publicly accessible HLS test streams — no real credentials required.

## Stack

| Layer   | Technology                                                  |
|---------|-------------------------------------------------------------|
| Runtime | Node.js >= 18                                               |
| Server  | Express 4 (static file serving + Xtream CORS proxy)         |
| Client  | Vanilla JS ES2020 — no framework, no bundler, no transpiler |
| Player  | hls.js 1.5 (CDN) + native HLS fallback (Safari)            |
| CSS     | Plain CSS with custom properties                            |
| Fonts   | Space Grotesk + IBM Plex Mono (Google Fonts CDN)            |

## Setup

```bash
npm install
```

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

The integration suite validates real connectivity to the public iptv-org
playlist (`https://iptv-org.github.io/iptv/index.m3u`): proxy fetch, engine
connect + parse at real scale, and sampled stream reachability. It fails by
design when the network is down and is excluded from the unit command.

## Features

- **M3U playlist support** — paste any `.m3u` or `.m3u8` URL to connect;
  detection is automatic, credentials are hidden, and channels arrive in the
  same browse/play UX as Xtream portals.
- **Category sidebar** — browse channels by category; "All Channels" shows
  everything.
- **Channel grid** — card per channel showing logo, number, and name; star to
  favourite.
- **Search** — live-filter channels by name from the sidebar search input.
- **HLS player** — idle, playing, and error states; autoplay on channel select.
- **Footer** — login form + connected status bar showing host and channel count;
  username/password fields are hidden automatically when an M3U URL is entered.
- **Persistence** — credentials, last-selected channel, and favourites survive
  page refreshes via `localStorage`.
- **CORS proxy** — server proxies all external URL fetches (Xtream API calls
  and M3U files) so remote hosts without CORS headers work from the browser.

## Architecture

See `CORE_FLOW.md` for how this project is built, `CHANGELOG.md` for the full
evolution history, and `adrs/` for every architecture decision.
