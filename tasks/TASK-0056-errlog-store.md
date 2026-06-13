---
id: TASK-0056
adr: ADR-0027
evolution: 17
status: pending
attempts: 0
depends_on: []
---

# TASK-0056 — In-memory playback failure-log store (`client/errlog.js`)

## Goal

After this task, a self-contained client module `src/client/errlog.js` exposes
`window.IptvErrLog`, an in-memory, session-scoped store of channel-playback
failures with the `add` / `list` / `count` / `clear` / `mkEntry` API decided in
ADR-0027. Nothing else consumes it yet (the capture hook is TASK-0057, the UI is
TASK-0058+); this task delivers and unit-tests the store in isolation.

## Acceptance criteria

- [ ] `src/client/errlog.js` exists, carries an `ADR: ADR-0027` comment near the
      top, uses CommonJS-free browser globals (`window.IptvErrLog = …`), and
      follows the existing client-module style (`'use strict'`, `/* global
      window */`).
- [ ] `mkEntry(cur, detail)` returns a normalized
      `{ at, name, num, url, detail }`: `at = Date.now()`; `name = cur.name`
      or `"Unknown channel"` when absent; `num = cur.num` or `null`;
      `url = cur.url` or `''`; `detail = String(detail)`. It tolerates `cur`
      being `null`/`undefined` or partial without throwing.
- [ ] `add(entry)` appends one entry newest-last and caps the log at 50 by
      dropping the oldest when the cap is exceeded.
- [ ] `list()` returns entries **newest-first** as a fresh array copy; mutating
      the returned array does not affect internal state.
- [ ] `count()` returns the current number of entries; `clear()` empties the log
      (`count()` becomes 0 afterward).

## Test requirements

- **Unit:** `src/tests/unit/errlog.test.js` (jsdom or plain) — `mkEntry`
      normalizes a full channel, a partial channel, and `null` (no throw,
      correct defaults, `at` is a number); `add`/`count` accumulate; the 50-cap
      drops the oldest and keeps the newest 50; `list()` is newest-first and is
      a copy (mutating it leaves `count()` unchanged); `clear()` empties.
- **UI:** n/a — not user-facing (store module only; the surfaced UI is
      TASK-0058+).
- **Integration:** n/a — no external connectivity (pure in-memory store).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
