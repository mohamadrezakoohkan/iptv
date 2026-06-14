---
status: current
---

# Project

> Maintained by spec-agent. This file is the single source of truth for what
> the product is and how to build and test it. `validate-agent` refuses to run
> without the canonical commands below.

## Product memory

This project keeps a durable, authoritative product-project memory file at
**`docs/MEMORY.md`** — the cross-cutting facts, conventions, and rationale that
are NOT derivable from the source code or git history (domain vocabulary,
product codename / deployment identity, durable project posture). Anyone (human
or AI) working on the product should consult `docs/MEMORY.md` as durable memory.
It complements — never replaces — this file, the ADRs, and the Evolution Log.
See `product-memory.md` for the full contract.

## Overview

**IPTV Broadcast Console** — a single-page web application that connects to
an Xtream-compatible IPTV portal **or** a standard M3U playlist URL and lets
the user browse live channels by category, search by name, mark favourites,
and stream the selected channel directly in the browser — HLS streams via
hls.js, raw MPEG-TS streams (the Xtream live format) via mpegts.js, with
the engine chosen automatically from the stream URL. On browsers without
MSE live playback (iOS Safari), raw TS streams are remuxed to HLS
server-side (ffmpeg stream copy) and played natively.
The login mode is an **explicit user choice** in the footer — "Username &
Password" (Xtream) or "Playlist URL only" (M3U) — never auto-detected from
the URL shape.

The product ships as a Node.js + Express server that serves the static client
files and proxies Xtream API calls to avoid browser CORS restrictions. The
client is pure vanilla JS (no framework), styled with CSS custom properties,
and uses a flat state machine (CONVENTIONS.md §6) instead of reactive
component hooks. The colour palette is theme-switchable: a sun/moon toggle in
the top-right swaps between a dark (default) and a light theme by overriding
the CSS custom-property tokens via a `data-theme` attribute on the document
root, and the choice persists across sessions.

A built-in **demo mode** (enter "demo" as portal URL) loads a curated playlist
of publicly accessible HLS test streams, so the app works out of the box
without real credentials.

## Stack

| Layer   | Technology                                                  |
|---------|-------------------------------------------------------------|
| Runtime | Node.js >= 18 (ESM forbidden — use CommonJS `require`)      |
| Server  | Express 4                                                   |
| Client  | Vanilla JS (ES2020, no transpiler, no bundler, no framework)|
| Player  | hls.js 1.5 (CDN) + native HLS fallback (Safari); mpegts.js 1.7 (CDN) for raw MPEG-TS; server-side TS→HLS remux fallback (ffmpeg via `ffmpeg-static`) for MSE-less browsers (iOS Safari) |
| CSS     | Plain CSS, custom properties, no preprocessor               |
| Fonts   | Space Grotesk + IBM Plex Mono (Google Fonts CDN)            |
| Testing | Vitest (unit + integration) + Playwright (UI/e2e)           |

## Canonical commands

| Purpose                | Command                                       |
|------------------------|-----------------------------------------------|
| Setup                  | `npm install`                                 |
| Build / run            | `node src/server/srv.js`                      |
| Unit test suite        | `npx vitest run`                              |
| UI test suite          | `npx playwright test`                         |
| Integration test suite | `npx vitest run --config vitest.int.config.js`|

The integration suite requires live outbound network access (it validates
real connectivity to public IPTV endpoints). It is intentionally excluded
from the unit suite's config so `npx vitest run` stays network-free.

The test-runner config files (`vitest.config.js`, `vitest.int.config.js`,
`playwright.config.js`) and `package.json` stay at the repository root by
tooling convention, with their internal paths pointing at the `src/...` layout,
so the canonical commands above are run from the root unchanged.

## Where the code lives

Product source and tests live under `src/`; product documentation lives under
`docs/`. See `repo-structure.md` for the full layout and the path-resolution
invariants the structure preserves.

- `src/index.html` — product HTML entry point (served at `/`).
- `src/client/**` — vanilla-JS client modules and `app.css` (incl. `epg.js`, the in-memory program-guide store + parsers + now/next selectors).
- `src/server/**` — Express server (`srv.js`, `rtr.js`, `cfg.js`, `hls.js`).
- `src/tests/{unit,ui,int}/**` — Vitest unit, Playwright UI, and Vitest
  integration suites.
- `docs/specs/**` — living specifications (this file, plus the feature specs
  below).
- `docs/adrs/**` — architecture decision records.
- `docs/notes/**` — implementation-notes home (see `docs/notes/README.md`).

## Feature specs

- `iptv-player.md` — full IPTV player broadcast console feature spec
- `empty-states.md` — empty & no-signal placeholder states (player idle, stream error, empty channel lists)
- `theme.md` — light / dark theme toggle (sun/moon switch, top-right)
- `spacing-sizing.md` — 4px-grid spacing/sizing/radius token contract (UI alignment pass)
- `playback-failure-log.md` — session failure log for channels that fail to play, surfaced via a log button beside the account button
- `integration-testing.md` — live-network integration test tier
- `product-memory.md` — durable product-project memory file (`docs/MEMORY.md`) and how it is referenced
- `epg.md` — electronic program guide: now/next on cards + expandable per-channel schedule (Xtream short-EPG + XMLTV via tvg-id)
- `reminders.md` — program reminders on the EPG: Remind toggle (aria-pressed) on schedule rows + NOW/NEXT line, localStorage-persisted store, client timer firing an in-app toast + best-effort permission-gated browser Notification with jump-to-channel
