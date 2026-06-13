---
id: TASK-0056
adr: ADR-0027
evolution: 17
status: done
attempts: 1
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

Files touched:

- `src/client/errlog.js` (created) — the in-memory, session-scoped store. Carries
  the `// ADR: ADR-0027` reference comment near the top and follows the existing
  client-module idiom (`'use strict'`, `/* global window */`, single
  `window.IptvErrLog = { … }` export; no CommonJS). A module-private `const LOG = []`
  holds entries newest-last; only `add` / `clear` mutate it, and `list()` never
  hands it out by reference.
- `src/tests/unit/errlog.test.js` (created, 16 unit tests) — loads `errlog.js`
  against a fresh `window` via `new Function(...)` per test, so each test gets an
  isolated in-memory `LOG` (no shared-state bleed between cases).

Non-obvious points for reviewers / future tasks:

- `num` normalization uses `(c.num === 0 || c.num) ? c.num : null` so a legitimate
  channel number `0` is preserved (not coerced to `null` by a falsy check), while
  missing/undefined `num` still defaults to `null` per ADR-0027.
- The 50-entry cap is enforced in `add` with `while (LOG.length > MAX) LOG.shift()`
  (drops oldest from the front), keeping the newest 50. `list()` returns
  `LOG.slice().reverse()` — a fresh, newest-first copy.
- This task delivers the store in isolation; nothing consumes it yet. The single
  capture hook (`onEngErr` in `play.js`) and the `index.html` load-order change are
  TASK-0057, and the button/panel UI is TASK-0058+. ADR-0027's `governs:` already
  lists `play.js` and `index.html` as seeded paths for TASK-0057, so they are left
  in place (they will gain their `ADR: ADR-0027` comments there); the two files
  this task creates are already in `governs:`, so no traceability change was needed.
- API surface is exactly `add / clear / count / list / mkEntry` (asserted by a test).
