---
id: ADR-0010
title: MPEG-TS playback via mpegts.js, engine selected by stream URL extension
date: 2026-06-12
evolution: 5
status: accepted
governs:
  - client/play.js
  - client/ui.js
  - index.html
---

# ADR-0010 — MPEG-TS playback via mpegts.js, engine selected by stream URL extension

## Context

The E5 target portal only outputs raw MPEG-TS
(`allowed_output_formats: ["ts"]`; `.m3u8` stream requests return HTTP 405).
The current player (`client/play.js`, ADR-0004) is HLS-only via hls.js and
cannot play raw TS. ADR-0004 already anticipated mpegts.js behind the
disabled "TS" format chip. M3U and demo paths remain `.m3u8`-based and must
keep working through hls.js.

## Decision

Add **mpegts.js (1.7.x) via CDN** in `index.html`, consistent with how
hls.js is loaded. `client/play.js` selects the engine from the stream URL's
path extension (query ignored): `.m3u8` → hls.js (native fallback per
ADR-0004), anything else → mpegts.js
(`mpegts.createPlayer({ type: 'mpegts', isLive: true, url })`, gated on
`mpegts.getFeatureList().mseLivePlayback`). Stream URLs are always routed
through the local `/api/xtream` proxy before reaching either engine (both
fetch via XHR; third-party hosts lack CORS). Channel switches destroy the
previous engine instance of either type. The HLS/TS chips become live
indicators of the engine in use instead of a disabled placeholder
(spec §5a/§10). `new` is used only for library built-ins (CONVENTIONS.md
§13 carve-out). This refines ADR-0004 (which stays `accepted` — hls.js
remains the HLS engine) rather than replacing it.

## Consequences

- Xtream `.ts` live streams become playable; HLS paths are untouched.
- One more CDN dependency (mpegts.js).
- Engine teardown is now polymorphic — tests must cover both switch
  directions.

## Tasks derived

- TASK-0023 — Dual-engine player: mpegts.js for TS, hls.js for HLS
- TASK-0024 — Live Xtream end-to-end: connect, list, and play mymax.top

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0010` comment near the top
(HTML uses `<!-- ADR: ... -->`).
