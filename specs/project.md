---
status: current
---

# Project

> Maintained by spec-agent. This file is the single source of truth for what
> the product is and how to build and test it. `validate-agent` refuses to run
> without the canonical commands below.

## Overview

**IPTV Broadcast Console** — a single-page web application that connects to
an Xtream-compatible IPTV portal **or** a standard M3U playlist URL and lets
the user browse live channels by category, search by name, mark favourites,
and stream the selected channel via HLS (hls.js) directly in the browser.
The login mode is an **explicit user choice** in the footer — "Username &
Password" (Xtream) or "Playlist URL only" (M3U) — never auto-detected from
the URL shape.

The product ships as a Node.js + Express server that serves the static client
files and proxies Xtream API calls to avoid browser CORS restrictions. The
client is pure vanilla JS (no framework), styled with CSS custom properties,
and uses a flat state machine (CONVENTIONS.md §6) instead of reactive
component hooks.

A built-in **demo mode** (enter "demo" as portal URL) loads a curated playlist
of publicly accessible HLS test streams, so the app works out of the box
without real credentials.

## Stack

| Layer   | Technology                                                  |
|---------|-------------------------------------------------------------|
| Runtime | Node.js >= 18 (ESM forbidden — use CommonJS `require`)      |
| Server  | Express 4                                                   |
| Client  | Vanilla JS (ES2020, no transpiler, no bundler, no framework)|
| Player  | hls.js 1.5 (CDN) + native HLS fallback (Safari)            |
| CSS     | Plain CSS, custom properties, no preprocessor               |
| Fonts   | Space Grotesk + IBM Plex Mono (Google Fonts CDN)            |
| Testing | Vitest (unit + integration) + Playwright (UI/e2e)           |

## Canonical commands

| Purpose                | Command                                       |
|------------------------|-----------------------------------------------|
| Setup                  | `npm install`                                 |
| Build / run            | `node server/srv.js`                          |
| Unit test suite        | `npx vitest run`                              |
| UI test suite          | `npx playwright test`                         |
| Integration test suite | `npx vitest run --config vitest.int.config.js`|

The integration suite requires live outbound network access (it validates
real connectivity to public IPTV endpoints). It is intentionally excluded
from the unit suite's config so `npx vitest run` stays network-free.

## Feature specs

- `specs/iptv-player.md` — full IPTV player broadcast console feature spec
- `specs/integration-testing.md` — live-network integration test tier
