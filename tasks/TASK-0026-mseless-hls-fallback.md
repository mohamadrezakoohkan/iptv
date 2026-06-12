---
id: TASK-0026
adr: ADR-0012
evolution: 6
status: done
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

- `client/play.js`: added `RMX = '/api/hls?url='`, pure `getRmx(url)`
  (exported on `window.IptvPlay`), and `updChip(eng)` (calls
  `IptvUi.rndChip`). `runTs` now takes the **raw** stream URL: MSE present →
  `updChip('ts')` + `loadTs(getPrx(url))` (byte-identical E5 behavior); MSE
  absent → `updChip('hls')` + `runHls(getRmx(url), 'MPEG-TS not supported')`.
  `runHls` gained an optional `msg` second param overriding the failure
  message, so the "MPEG-TS not supported" overlay appears only on double
  failure (no hls.js, no native HLS); plain `.m3u8` failures keep
  "HLS not supported". `loadPlay` renders the chip for the engine actually
  in use. Teardown unchanged: `stopPlay()` runs before every load.
- `tests/unit/play.test.js`: replaced the obsolete "mpegts unsupported →
  error" describe (behavior changed by this task) with fallback coverage:
  `getRmx` construction, hls.js/native fallback with the remux URL (not the
  `/api/xtream` wrapper), no ERR on fallback, double-failure overlay message,
  `.m3u8` message preserved, fallback teardown both directions, chip hook.
- `tests/ui/fallback.test.js` (new): MSE-less stubbed `window.mpegts` — no
  overlay, `/api/hls` URL handed to the HLS engine, HLS chip active;
  MSE-capable run keeps the TS chip; double-failure overlay; demo-mode HLS
  unchanged.
- `tests/ui/chips.test.js`: the old "unsupported mpegts shows the error
  overlay" test now stubs `window.Hls.isSupported() === false` **and**
  `video.canPlayType → ''` (Chromium answers `'maybe'` for native HLS, which
  would otherwise engage `loadNative`) to exercise the double-failure case.
- `tests/int/e2e.test.js`: new test executes real `client/play.js` with no
  `mpegts` and a recording Hls stub, captures the exact fallback URL it
  builds for sampled live channels, and fetches it against the in-process
  server — expects 200 + `#EXTM3U` (>= 1 of 5, flake policy per
  specs/integration-testing.md); afterAll reaps remux sessions via
  `hls._rmSess`.
- ADR-0012 `governs:` trued up with `tests/unit/play.test.js`,
  `tests/ui/chips.test.js`, `tests/int/e2e.test.js`.
- Suites run locally: unit 297 passed, UI 89 passed, integration 25 passed.
