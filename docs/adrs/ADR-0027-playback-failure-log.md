---
id: ADR-0027
title: Capture only channel-playback failures into an in-memory failure log
date: 2026-06-13
evolution: 17
status: accepted
governs:
  - src/client/errlog.js
  - src/client/play.js
  - src/index.html
  - src/tests/unit/errlog.test.js
  - src/tests/unit/playcap.test.js
---

# ADR-0027 — Capture only channel-playback failures into an in-memory failure log

## Context

E17 prompt: *"enable logging only failures when selecting a channel throws an
error for playing it"*. The product must record an entry **only** when a
playback attempt for a selected channel fails — successful plays are never
logged.

Channel selection already converges on a single failure path. Clicking a
channel card (`client/ui.js` `onGridClick`) calls `IptvPlay.loadPlay(ch.url)`
after `setCur(ch)`. Every fatal failure in `client/play.js` — fatal hls.js
errors (`onHlsErr`), mpegts.js errors (`onTsErr`), and the "not supported"
dead-ends in `runHls` — already funnels through one shared handler,
`onEngErr(msg)`, which sets `ST.err`, transitions to `ERR`, tears the engine
down, and re-renders. That single choke point is the natural, non-duplicating
hook for failure capture, and `ST.cur` holds the channel that failed. ADR-0023
already renders the human-facing stream-error placeholder from this same `ERR`
state; this ADR is about the **persistent record** of failures, not the
in-card message.

There is no existing log store. The decision here is the **capture model** (what
is logged, when, and where it lives); ADR-0028 decides the button + panel that
surface it.

## Decision

Add a small, self-contained client module `client/errlog.js` exposing
`window.IptvErrLog`, an **in-memory, session-scoped** failure log (no
persistence — failures are a live diagnostic for the current session, not a
stored artifact; this keeps it out of the localStorage/account model entirely).

### Entry shape

```
/** @typedef {{ at:number, name:string, num:(number|null), url:string, detail:string }} ErrEntry
 *  at     — Date.now() when the failure was recorded
 *  name   — failed channel's display name (ST.cur.name; "Unknown channel" when absent)
 *  num    — failed channel's number (ST.cur.num) or null
 *  url    — failed channel's stream url (ST.cur.url) or ''
 *  detail — the engine failure detail string passed to onEngErr (the raw token)
 */
```

### API (`window.IptvErrLog`)

- `add(entry)` — pure-ish appender: pushes one `ErrEntry`, newest-last, capping
  the log at a fixed maximum (e.g. 50) by dropping the oldest, so a long session
  cannot grow unbounded.
- `list()` — returns the entries **newest-first** (a fresh array copy; callers
  never mutate internal state).
- `count()` — number of entries currently held.
- `clear()` — empties the log.
- `mkEntry(cur, detail)` — pure builder: turns the current channel (`ST.cur`,
  possibly `null`) plus a detail string into a normalized `ErrEntry`, stamping
  `at = Date.now()`. Tolerates a null/partial channel.

### Capture hook (the only writer)

`onEngErr(msg)` in `client/play.js` records exactly one failure entry **before**
it tears the engine down: `window.IptvErrLog.add(window.IptvErrLog.mkEntry(
window.IptvSt.ST.cur, msg))`. This is the single capture site, so the rule
"**only** failures are logged" holds structurally — there is no success path
that reaches `onEngErr`. The call is guarded (`if (window.IptvErrLog) …`) so
play.js still works when the log module is absent (test isolation), mirroring
the existing guarded `window.IptvUi` / `updChip` calls.

`errlog.js` is loaded in `index.html` **before** `play.js` (which calls it) and
before `ui.js` (which reads it for ADR-0028), in the existing script block.

## Consequences

**Easier:**
- A single, already-shared choke point means failures are captured exactly once
  with no parallel error path to keep in sync; successes structurally cannot be
  logged.
- In-memory only ⇒ no schema migration, no localStorage key, no account
  coupling, and the existing `ERR` rendering (ADR-0023) is untouched.

**Harder:**
- `play.js` gains one more guarded global dependency (`window.IptvErrLog`);
  load order in `index.html` must place `errlog.js` before `play.js`.

**Ruled out:**
- Persisting the log to localStorage (the prompt asks to *log failures*, a live
  diagnostic; persistence is unrequested scope and would entangle the account
  store).
- A second capture site or a new state-machine phase (CONVENTIONS §6: phases
  stay INIT/LOAD/READY/PLAY/SRCH/ERR; logging rides the existing `ERR` path).

## Tasks derived

- TASK-0056 — `errlog.js` failure-log store (entry shape, add/list/count/clear/mkEntry)
- TASK-0057 — Hook failure capture into `play.js` `onEngErr` + `index.html` load order

## Traceability

Every file in `governs:` carries an `ADR: ADR-0027` comment near the top
(native comment syntax; `index.html` via HTML comment). When a change removes
the last governed code, this ADR is marked `status: deleted` — the file itself
is never removed; it is history.
</content>
</invoke>
