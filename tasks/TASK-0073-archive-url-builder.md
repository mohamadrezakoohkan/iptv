---
id: TASK-0073
adr: ADR-0036
evolution: 21
status: done
attempts: 1
depends_on: []
---

# TASK-0073 — Pure archive-URL builder (getArchUrl) in play.js

## Goal

`src/client/play.js` exposes a pure `getArchUrl` helper (on `window.IptvPlay`)
that builds the Xtream timeshift archive URL for a program on an archive-capable
channel, mirroring the live-URL form. It is side-effect-free and returns the
absolute archive URL string; the existing `loadPlay`/`getEng`/`getPrx` path then
proxies and engine-selects it unchanged.

## Acceptance criteria

- [ ] `getArchUrl({ ch, prg })` (or equivalent signature) returns
      `<base>/timeshift/<user>/<pass>/<durationMinutes>/<YYYY-MM-DD:HH-MM>/<stream_id>.<ext>`,
      derived from the channel's live `url` (same base/user/pass/stream_id/ext as
      the live URL `mkXtCh` built) and the program's `start`/`stop`.
- [ ] The timeshift time stamp is the program `start` (unix ms) formatted as
      local `YYYY-MM-DD:HH-MM`.
- [ ] The duration is whole minutes from `round((stop - start) / 60000)`, with a
      minimum of `1`.
- [ ] The URL ends in the **same** extension the channel's live `url` ends in
      (`.ts` or `.m3u8`), so `getEng` resolves the same engine — verified by a
      unit assertion that `getEng(getArchUrl(...))` equals `getEng(ch.url)`.
- [ ] The helper is pure (no DOM, no ST mutation, no fetch) and is exported on
      `window.IptvPlay`.

## Test requirements

- **Unit:** `getArchUrl` produces the expected timeshift URL for a TS channel and
  an HLS channel; duration rounds correctly (e.g. a 30-min program → `30`,
  a sub-minute program → `1`); the start stamp is formatted `YYYY-MM-DD:HH-MM`;
  `getEng(getArchUrl(...)) === getEng(ch.url)` for both engines.
- **UI:** n/a — pure builder, no DOM in this task (the affordance ships in
  TASK-0074).
- **Integration:** n/a — no external connectivity in this task (URL building is
  pure; the live archive fetch is exercised by the catch-up flow tasks and the
  integration tier in TASK-0072 / live play).

## Implementation notes

- `src/client/play.js`: added three pure helpers and exported `getArchUrl` on
  `window.IptvPlay`:
  - `pad2(n)` — zero-pads to two digits.
  - `getStamp(ts)` — formats a unix-ms instant as the Xtream **local-time**
    timeshift stamp `YYYY-MM-DD:HH-MM` (uses `Date` local getters, not UTC,
    per spec §2).
  - `getArchDur(start, stop)` — `Math.round((stop - start) / 60000)`, clamped
    to a minimum of `1`.
  - `getArchUrl({ ch, prg })` — parses the channel's live `url`
    (`<base>/live/<user>/<pass>/<id>.<ext>`) by splitting on `/live/`, reuses
    the exact base/user/pass/stream-id/ext, and rebuilds the timeshift form
    `<base>/timeshift/<user>/<pass>/<dur>/<stamp>/<id>.<ext>`. Pure: no DOM, no
    ST writes, no fetch. Because the ext is carried verbatim, `getEng` resolves
    the same engine as for the live URL. No new dependency, engine, phase, or
    route. The caller (TASK-0075) hands the result to the unchanged
    `loadPlay`/`getPrx`.
- `src/tests/unit/play.test.js`: added a `getArchUrl()` describe block (16
  tests) covering TS + HLS URL shape, base/user/pass/id/ext preservation,
  local-stamp format, duration rounding (30 → 30, 89s → 1, 91s → 2, sub-minute
  → 1, zero-length → 1), `getEng(getArchUrl(...)) === getEng(ch.url)` for both
  engines, and purity (no ST mutation, returns a string). The expected stamp is
  computed the same way the builder does so the assertion is timezone-
  independent.
- Traceability: `ADR: ADR-0036` appended to both file headers; ADR-0036
  `governs:` already listed both files, so no `governs:` change was needed.
- No UI/integration tests — pure builder, no DOM or external connectivity
  (matches the task's test requirements).
