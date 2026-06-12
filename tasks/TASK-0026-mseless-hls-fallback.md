---
id: TASK-0026
adr: ADR-0012
evolution: 6
status: pending
attempts: 0
depends_on: [TASK-0025]
---

# TASK-0026 — Client MSE-less fallback to remuxed HLS

## Goal

`client/play.js` no longer dead-ends on "MPEG-TS not supported" when the TS
engine is selected on an MSE-less browser (iOS Safari being the canonical
case). When `hasTs()` is false, playback falls back to the server remux
endpoint (`/api/hls?url=<encoded>` from TASK-0025) through the existing HLS
path (hls.js where supported, else native HLS). Desktop (MSE-capable)
playback and the M3U/demo HLS paths behave exactly as before.

## Acceptance criteria

- [ ] With `window.mpegts` missing or `getFeatureList().mseLivePlayback`
      false, selecting a `.ts` channel loads `/api/hls?url=<encoded raw
      stream URL>` (not the `/api/xtream` proxy wrapper) via `runHls`,
      and no "MPEG-TS not supported" overlay appears.
- [ ] In the fallback, the format chip shows **HLS** (engine actually in
      use); with MSE available the chip shows **TS** as in E5.
- [ ] The error overlay "MPEG-TS not supported" appears only when the
      fallback HLS path itself cannot play (no hls.js support and no
      native HLS).
- [ ] With MSE available (`mseLivePlayback` true), behavior is
      byte-for-byte E5: mpegts.js direct via the `/api/xtream` proxy.
- [ ] `.m3u8` channels (M3U mode, demo mode) are untouched.
- [ ] Channel switching in/out of the fallback fully destroys the previous
      engine instance (no orphaned XHRs), in both directions.

## Test requirements

- **Unit:** fallback URL construction (remux endpoint, raw URL encoded);
  `runTs` routing — MSE present → mpegts.js, absent → HLS path with remux
  URL; overlay only on double failure; engine teardown across
  fallback↔mpegts↔hls switches. Per R-0001, verify baseline DOM attributes
  before asserting any attribute mutations.
- **UI:** Playwright with `window.mpegts` feature flags stubbed to emulate
  an MSE-less browser: select a TS channel → no "MPEG-TS not supported"
  overlay, video source/engine is the `/api/hls` URL, HLS chip highlighted;
  unstubbed (MSE-capable) run still highlights the TS chip; demo/HLS
  channel playback unchanged.
- **Integration:** extend the live Xtream e2e: with the in-process server,
  the exact `/api/hls` URL the client fallback would build for a sampled
  live channel returns a valid HLS playlist (200, `#EXTM3U`) — proving the
  client-built URL and server endpoint agree end to end. Bounded reads;
  flake policy per specs/integration-testing.md.

## Implementation notes

_Filled by implement-agent._
