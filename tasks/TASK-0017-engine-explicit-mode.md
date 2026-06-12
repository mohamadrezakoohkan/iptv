---
id: TASK-0017
adr: ADR-0008
evolution: 4
status: done
attempts: 1
depends_on: []
---

# TASK-0017 — Engine: explicit `opts.m3u` connect routing + integration-test adaptation

## Goal

`IptvApi.connect(src, opts)` honours an explicit `opts.m3u` boolean: when
present it alone decides the path (true → M3U, false → Xtream), with demo
(`isDemo`) still checked first. The `isM3u` heuristic stops being the
decision-maker — it remains **only** as the fallback when `opts.m3u` is
absent (so the not-yet-updated UI keeps working until TASK-0018; TASK-0020
deletes it). Both integration tests state the mode explicitly.

## Acceptance criteria

- [ ] `connect(src, { user: 'u', pass: 'p', m3u: true })` takes the M3U
      path for a non-`.m3u` URL (e.g. `https://example.com/list`) — no
      `player_api.php` request is made.
- [ ] `connect(src, { user: '', pass: '', m3u: false })` takes the Xtream
      path even when `src` ends in `.m3u8`.
- [ ] `connect('demo', { m3u: true })` and `connect('demo', { m3u: false })`
      both resolve the demo playlist (demo wins in either mode).
- [ ] When `opts.m3u` is absent, routing is unchanged from E2 behavior
      (heuristic fallback) — the full existing unit/UI suites still pass.
- [ ] `tests/int/m3u.test.js` and `tests/int/strm.test.js` call
      `connect(LIVE_URL, { user: '', pass: '', m3u: true })`.
- [ ] `client/api.js` carries `ADR: ADR-0008` (kept alongside existing ADR
      references); ADR-0008 `governs:` trued up.

## Test requirements

- **Unit:** routing precedence in `tests/unit/api.test.js` — explicit
  `m3u: true` forces M3U path despite credentials and non-playlist URL;
  explicit `m3u: false` forces Xtream path despite `.m3u8` URL; demo
  short-circuits both modes; absent flag falls back to E2 heuristic
  (fetch mocked per existing test patterns).
- **UI:** n/a — not user-facing (engine flag only; footer unchanged in this
  task). Full UI suite must still pass as the regression gate.
- **Integration:** update `tests/int/m3u.test.js` and
  `tests/int/strm.test.js` to pass `m3u: true`; the full integration suite
  (`npx vitest run --config vitest.int.config.js`) must pass against the
  live iptv-org endpoint.

## Implementation notes

**Files touched:**

- `client/api.js` — `connect(src, opts)` now reads `opts.m3u`: routing order
  is (1) `isDemo(src)`, (2) `m3u === true` → `loadM3u`, (3) `m3u === false`
  → `loadXtream`, (4) flag absent → `isM3u` heuristic fallback (transitional,
  removed by TASK-0020). The flag is honoured only when it is a real boolean
  (`typeof opts.m3u === 'boolean'`), so `undefined`/missing falls through to
  the E2 heuristic and the not-yet-updated UI keeps working. ADR header now
  `ADR-0001, ADR-0005, ADR-0008`.
- `tests/unit/api.test.js` — new `connect — explicit opts.m3u routing` block
  (6 tests): `m3u: true` forces M3U for a non-playlist URL with credentials
  (no `player_api.php` request); `m3u: false` forces Xtream for a `.m3u8`
  URL; demo short-circuits in both modes (no fetch at all); absent flag
  falls back to the heuristic in both directions.
- `tests/int/m3u.test.js`, `tests/int/strm.test.js` — `connect(LIVE_URL,
  { user: '', pass: '', m3u: true })`; ADR headers now `ADR-0007, ADR-0008`.

**Non-obvious:** ADR-0008 `governs:` already listed every file touched here,
so no governs edits were needed. `isM3u` is still exported on `window.IptvApi`
and its unit tests are untouched — both are TASK-0020's removal scope.

**Verified locally:** unit 212/212, UI 66/66, integration 10/10 (live
iptv-org endpoint, 3/5 sampled streams alive).
