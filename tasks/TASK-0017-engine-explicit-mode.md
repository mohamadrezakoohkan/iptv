---
id: TASK-0017
adr: ADR-0008
evolution: 4
status: pending
attempts: 0
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

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
