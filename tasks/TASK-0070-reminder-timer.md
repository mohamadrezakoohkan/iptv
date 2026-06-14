---
id: TASK-0070
adr: ADR-0034
evolution: 20
status: pending
attempts: 0
depends_on: [TASK-0067, TASK-0069]
---

# TASK-0070 — Client reminder timer wired on page load

## Goal

A lightweight repeating client timer, started once on page load, that checks
pending reminders against program start times each tick (`IptvRem.due`), fires
each newly-due reminder exactly once via the TASK-0069 firing function, and
removes it from the store so it never re-fires. When done, set reminders fire
on their own without any further user action, degrading silently.

## Acceptance criteria

- [ ] A timer interval is started once on page load through the existing
      `onReady`/main wiring (`src/client/main.js`); the interval value lives in
      `src/client/cfg.js` `S` (coarse — e.g. a check every ~15–30s) and `S`
      stays frozen.
- [ ] Each tick calls `IptvRem.due(Date.now())`; for each newly-due reminder it
      invokes the firing function (TASK-0069) once, then `IptvRem.rm(...)` it so
      the same reminder never fires twice across ticks.
- [ ] The tick is a guarded no-op when `window.IptvRem` is absent (test
      isolation) and never throws when no guide is loaded (no due reminders).
- [ ] No new state-machine phase, no new boolean control flag, no new server
      route; touched files carry `ADR: ADR-0034`.

## Test requirements

- **Unit:** extend `src/tests/unit/remfire.test.js` (or a focused
  `remtimer` describe) — with a mocked clock (`vi.useFakeTimers`) and a stubbed
  `IptvRem`, assert a tick reads `due(now)`, fires each due reminder once, and
  removes it so a second tick does not re-fire it; assert a tick with
  `window.IptvRem` absent is a silent no-op (no throw). Honor R-0001 for any
  DOM-attribute assertions (none expected — timer is non-visual).
- **UI:** covered by `src/tests/ui/reminders.test.js` (TASK-0069's
  set→fire→watch flow exercises the timer end-to-end on the demo fixture).
- **Integration:** n/a — no external connectivity (client timer + browser
  APIs, mocked in tests).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
