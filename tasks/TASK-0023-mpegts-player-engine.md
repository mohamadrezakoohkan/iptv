---
id: TASK-0023
adr: ADR-0010
evolution: 5
status: pending
attempts: 0
depends_on: []
---

# TASK-0023 — Dual-engine player: mpegts.js for TS, hls.js for HLS

## Goal

`client/play.js` plays raw MPEG-TS streams via mpegts.js (CDN, added to
`index.html`) while keeping hls.js for `.m3u8` URLs, choosing the engine
from the stream URL extension and always fetching through the local proxy;
the HLS/TS chips reflect the active engine.

## Acceptance criteria

- [ ] `index.html` loads mpegts.js 1.7.x from CDN alongside hls.js.
- [ ] Engine selection: URL path ending `.m3u8` (query ignored) → hls.js
      path (existing behavior incl. native fallback); any other extension
      (e.g. `.ts`) → mpegts.js live player.
- [ ] Stream URLs are wrapped as `/api/xtream?url=<encoded>` before being
      handed to either engine.
- [ ] mpegts.js path gates on `mpegts.getFeatureList().mseLivePlayback`;
      unsupported → error overlay "MPEG-TS not supported."
- [ ] Fatal errors from either engine show the error overlay.
- [ ] Switching channels destroys the previous engine instance in both
      directions (HLS→TS and TS→HLS); no leaked players.
- [ ] HLS/TS format chips (content-head) highlight the engine in use and
      are no longer rendered disabled.
- [ ] M3U/demo playback (hls.js path) keeps passing all existing tests.

## Test requirements

- **Unit:** engine-selection function (extension parsing incl. query
  strings), proxy URL wrapping, teardown called on engine switch (mock
  Hls/mpegts globals), unsupported-feature error paths. (R-0001: check
  baseline HTML before asserting attribute mutations on the chips.)
- **UI:** Playwright — demo mode still plays (HLS chip active); chips
  reflect engine state; error overlay shown when engine unsupported/fatal
  (stub as needed).
- **Integration:** n/a at this task's level — live playback proven in
  TASK-0024.

## Implementation notes

_Filled by implement-agent._
