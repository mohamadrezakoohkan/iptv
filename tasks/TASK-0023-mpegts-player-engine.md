---
id: TASK-0023
adr: ADR-0010
evolution: 5
status: done
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

- `client/play.js` rewritten as a dual-engine wrapper: `getEng(url)` picks
  the engine from the path extension (query stripped, case-insensitive,
  `.m3u8` → hls, else ts); `getPrx(url)` wraps absolute URLs as
  `/api/xtream?url=<encoded>` (relative URLs pass through untouched);
  `runTs` gates on `mpegts.getFeatureList().mseLivePlayback` and uses
  `mpegts.createPlayer({ type: 'mpegts', isLive: true, url })`;
  `stopPlay()` destroys whichever engine instance exists. A shared
  `onEngErr(msg)` sets `ST.err`, transitions to `ERR` (guarded against an
  ERR→ERR transition), tears down, and calls `IptvUi.rndPhase()` so the
  error overlay actually renders (it previously relied on a later render).
  Both engine-unsupported paths (`HLS not supported`,
  `MPEG-TS not supported`) now also surface the overlay.
- `index.html`: added mpegts.js 1.7.3 CDN script next to hls.js, and the
  HLS/TS format chips (`#fmt-chips`, `#chip-hls`, `#chip-ts`) in the
  content-head — CSS for `.fmt-chips`/`.fmt-chip(.active)` already existed
  in `client/app.css`, so no CSS change was needed. Chips were never
  present in the baseline HTML before this task, so "no longer disabled"
  is realized by rendering them as plain spans with no disabled
  attribute/class (verified by UI test).
- `client/ui.js`: EL registry gains `chls`/`cts`; new `rndChip(eng)`
  toggles the `active` class; exported on `window.IptvUi`. `loadPlay`
  calls it lazily (play.js loads before ui.js — module order intact).
- `tests/unit/play.test.js` updated for proxy wrapping (the prior tests
  asserted raw URLs handed to hls.js; the E5 spec §10.3 now mandates
  proxied delivery, so the expectations changed to the wrapped form — all
  prior behaviors otherwise preserved) plus new coverage: engine
  selection, proxy wrapping, mpegts supported/unsupported, fatal mpegts
  error, teardown in both switch directions, chip hook.
- `tests/ui/chips.test.js` (new): chips baseline (visible, enabled,
  inactive), engine highlighting both ways, demo-mode flow → HLS chip
  active, error overlay for unsupported and fatal mpegts (stubbed
  `window.mpegts`), CDN library presence.
- ADR-0010 `governs:` trued up with the two test files.
- Integration tests deliberately none — live TS playback is TASK-0024.
