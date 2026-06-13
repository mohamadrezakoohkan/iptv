---
id: ADR-0012
title: Server-side TS→HLS remux fallback (ffmpeg-static) for MSE-less clients
date: 2026-06-12
evolution: 6
status: accepted
governs:
  - src/server/hls.js
  - src/server/rtr.js
  - src/client/play.js
  - package.json
  - src/tests/unit/hls.test.js
  - src/tests/unit/play.test.js
  - src/tests/ui/fallback.test.js
  - src/tests/ui/chips.test.js
  - src/tests/int/remux.test.js
  - src/tests/int/e2e.test.js
---

# ADR-0012 — Server-side TS→HLS remux fallback (ffmpeg-static) for MSE-less clients

## Context

The Xtream portal under test only outputs raw MPEG-TS
(`allowed_output_formats: ["ts"]`; `.m3u8` stream requests return HTTP 405).
The dual-engine player (ADR-0010) plays TS via mpegts.js, which requires
Media Source Extensions live playback (`getFeatureList().mseLivePlayback`).
iOS Safari (and some other mobile browsers) has no usable MSE, so on those
devices every Xtream stream fails with the "MPEG-TS not supported" overlay
after a successful login — the exact reported E6 issue, seen on a LAN device
at `http://192.168.1.36:3000`.

No client-side JS engine can play raw TS without MSE. But MSE-less browsers
that matter here (iOS Safari) play **HLS natively** via `video.src`. The
server already proxies and pipes live TS streams (ADR-0011). Alternatives
weighed: requiring a system ffmpeg install (breaks zero-setup `npm install`),
a WebAssembly demuxer in the client (heavy, unproven for live), or doing
nothing on MSE-less devices (fails the prompt).

## Decision

Add a **server-side live remux endpoint** that converts a raw MPEG-TS stream
to HLS on demand, using **ffmpeg with stream copy (`-c copy`)** — a remux,
not a transcode (near-zero CPU). The ffmpeg binary comes from the
**`ffmpeg-static` npm package**, so `npm install` remains the only setup
step.

Server (`server/hls.js`, mounted from `server/rtr.js`):

- `GET /api/hls?url=<encoded>` — validates `url` with the same
  validation/blocklist as `/api/xtream` (ADR-0002/0011), starts (or reuses)
  a remux **session** keyed by the source URL: spawns ffmpeg reading the
  upstream TS (redirects followed, per ADR-0011 semantics) and writing a
  live HLS playlist + segments into a per-session temp directory; responds
  with the playlist once ffmpeg has produced it (bounded startup wait,
  502 on failure/timeout).
- `GET /api/hls/<session>/<segment>.ts` — serves session segments.
- **Session lifecycle**: a session whose playlist/segments go unrequested
  for an idle window is reaped — ffmpeg killed, temp dir deleted. Reuse:
  concurrent or repeated requests for the same source URL share one session.
- Live tuning: short segments, small sliding window, `+delete_segments` —
  the temp dir never grows unbounded.

Client (`client/play.js`): in `runTs`, when `hasTs()` is false, instead of
erroring, **fall back** to the remux endpoint — build the `/api/hls?url=`
URL for the (un-proxied) stream URL and hand it to the existing HLS path
(`runHls`: hls.js where supported, else native HLS — the iOS case). The
format chip reflects the engine actually in use (HLS when remuxing). The
"MPEG-TS not supported" overlay remains only for the case where the HLS
fallback itself cannot play. MSE-capable clients are untouched: `hasTs()`
true → mpegts.js direct, exactly as shipped in E5. M3U/demo `.m3u8` paths
are untouched.

ADR-0010 and ADR-0011 stay `accepted`; this decision extends them.

## Consequences

- Xtream TS streams become playable on iOS Safari and any MSE-less browser
  with native or hls.js HLS support; desktop behavior is unchanged.
- New runtime dependency (`ffmpeg-static`, large binary download at
  install) and server-side process management (spawn, reap, temp files).
- Remux adds a few seconds of startup latency on MSE-less devices (HLS
  segment priming) — acceptable versus not playing at all.
- Unit tests must mock the ffmpeg spawn; integration tests prove a real
  live-portal TS stream remuxes to a fetchable playlist + valid segments;
  UI tests emulate the MSE-less environment by stubbing `window.mpegts`
  feature flags.

## Tasks derived

- TASK-0025 — Server TS→HLS live remux endpoint (/api/hls)
- TASK-0026 — Client MSE-less fallback to remuxed HLS

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0012` comment near the top
(package.json is linked from this side only).
