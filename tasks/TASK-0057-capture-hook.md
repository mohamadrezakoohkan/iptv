---
id: TASK-0057
adr: ADR-0027
evolution: 17
status: pending
attempts: 0
depends_on: [TASK-0056]
---

# TASK-0057 — Capture playback failures at the `onEngErr` choke point

## Goal

After this task, every fatal playback failure — and only a failure — records
exactly one entry into `window.IptvErrLog` from the single shared handler
`onEngErr(msg)` in `src/client/play.js`, and `errlog.js` is loaded in
`src/index.html` before `play.js` (which writes it) and before `ui.js` (which
reads it). No success path can reach `onEngErr`, so successes are structurally
never logged (ADR-0027).

## Acceptance criteria

- [ ] `onEngErr(msg)` in `src/client/play.js`, **before** it tears the engine
      down (`stopPlay()`), records one entry:
      `if (window.IptvErrLog) window.IptvErrLog.add(window.IptvErrLog.mkEntry(window.IptvSt.ST.cur, msg))`.
      The call is guarded so `play.js` still works when `IptvErrLog` is absent
      (test isolation), mirroring the existing guarded `window.IptvUi` reads.
- [ ] The capture happens for all three fatal paths that funnel through
      `onEngErr` (fatal hls.js error via `onHlsErr`, mpegts.js error via
      `onTsErr`, and the "not supported" dead-end), because they all call
      `onEngErr` — no second capture site is added.
- [ ] No successful-play code path calls `onEngErr` or `IptvErrLog.add`
      (verified by the unit test: a normal `loadPlay`/`goPlay` success records
      nothing).
- [ ] `src/index.html` loads `/errlog.js` before `/play.js` and before `/ui.js`
      in the existing script block, and the file's HTML ADR comment lists
      `ADR-0027`.
- [ ] `src/client/play.js`'s ADR comment line includes `ADR-0027`.

## Test requirements

- **Unit:** extend `src/tests/unit/errlog.test.js` (or a focused play-capture
      unit test) — with a stubbed `window.IptvErrLog` and `window.IptvSt.ST.cur`
      set to a channel, calling `onEngErr('mediaError')` records exactly one
      entry with that channel's name/num/url and `detail === 'mediaError'`;
      calling it with `ST.cur` null records an `"Unknown channel"` entry; with
      `window.IptvErrLog` absent `onEngErr` does not throw. Assert that a
      success path (e.g. invoking the play success flow, no engine error) adds
      nothing. Per R-0001: do not assert any DOM attribute is added that the
      baseline markup does not declare — this task asserts log entries and load
      order, not attribute mutations.
- **UI:** n/a — not user-facing on its own (the surfaced button/panel is
      TASK-0058+); this task only wires capture and load order.
- **Integration:** n/a — no external connectivity (capture is local; no live
      stream is fetched in the test).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
