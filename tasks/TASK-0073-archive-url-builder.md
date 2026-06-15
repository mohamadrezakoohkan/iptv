---
id: TASK-0073
adr: ADR-0036
evolution: 21
status: pending
attempts: 0
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

_Filled by implement-agent._
