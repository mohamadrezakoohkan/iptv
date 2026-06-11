---
id: TASK-0003
adr: ADR-0001
evolution: 1
status: done
attempts: 2
depends_on: [TASK-0001]
---

# TASK-0003 — Client state machine (client/st.js)

## Goal

`client/st.js` implements the flat `ST` object, the `PHASES` transition map,
the `go()` function, and all setter functions that other client modules call
to mutate state. This is the single file allowed to write `ST` properties
(except `ST.phase`, which only `go()` writes). All state that drives UI
rendering lives here.

## Acceptance criteria

- [ ] `client/st.js` exists and carries `// ADR: ADR-0001, ADR-0003`.
- [ ] `ST` is declared `const` at the top of the file, fully initialized, with
      these properties at minimum: `phase` (`'INIT'`), `chs` (`[]`), `cats`
      (`[]`), `cur` (`null`), `srch` (`''`), `flt` (`'all'`), `vol` (`1.0`),
      `muted` (`false`), `err` (`null`), `favs` (`[]`), `host` (`''`),
      `user` (`''`).
- [ ] `PHASES` is declared as a `const` object mapping each phase name to its
      valid next phases (CONVENTIONS.md §6).
- [ ] `go(next)` validates the transition against `PHASES[ST.phase]`; throws
      an `Error` with message `"bad: ${ST.phase}->${next}"` on invalid transition;
      sets `ST.phase` on valid transition; calls `rndPhase()` from `ui.js`
      if it has been registered via `onPhase(cb)`.
- [ ] Setter functions exported: `setErr(msg)`, `setChs(chs, cats, host, user)`,
      `setCur(ch)`, `setSrch(q)`, `setFlt(cat)`, `setVol(v)`, `setMuted(b)`,
      `setFavs(arr)`.
- [ ] Each setter mutates only the relevant `ST` properties; none exceeds
      20 lines.
- [ ] `onPhase(cb)` registers a single callback invoked after every `go()`
      call; replaces any previous registration.
- [ ] No property may be added to `ST` after its declaration
      (no `ST.newProp = …` anywhere).
- [ ] `go()` is exported and is the only function that writes `ST.phase`.

## Test requirements

- **Unit:** `go()` — valid transitions succeed; invalid transitions throw with
  correct message; `ST.phase` is updated after valid call. All setter
  functions — verify they mutate only their intended `ST` properties. `onPhase`
  callback is invoked after `go()`.
- **UI:** n/a — pure logic module.

## Implementation notes

**Files touched:**
- `client/st.js` — created (new file)
- `tests/unit/st.test.js` — created (new file)
- `tasks/TASK-0003-state-machine.md` — status updated to `validating`, attempts set to 2

**Design notes:**
- `ST` is declared with `const` and fully initialized per acceptance criteria. The properties use `cats`, `favs`, `host`, `user` (as specified by the task) which differ from the generic example in CONVENTIONS.md §5 — the acceptance criteria takes precedence.
- `_phaseCb` is a module-level `let` variable (not a property on ST); this keeps the callback registry out of the state object (no new ST properties after declaration rule respected).
- `go()` sets `ST.phase` first, then calls `_phaseCb()`, so the callback always sees the updated phase — matching the acceptance criteria requirement that `rndPhase()` is called after state change.
- All setter functions are named function declarations (RULE-FN-5) and each is under 20 lines (RULE-FN-2).
- The IIFE wrapping pattern from `api.js` was not used; `st.js` uses a flat top-level module with `'use strict'` and `window.IptvSt = {...}` directly, since the IIFE pattern is an `api.js` artifact, not required by CONVENTIONS.md for `st.js`.
- ADR traceability: `client/st.js` already appeared in `governs:` for ADR-0001 (no update needed there); ADR-0003 `governs:` already lists `client/st.js` (no update needed).

**Test coverage (65 tests passing):**
- `go()` valid transitions: all 10 defined transitions in PHASES map
- `go()` invalid transitions: 9 cases including BOGUS target
- `ST.phase` mutation: starts as INIT, updates on valid call, unchanged on invalid call
- `onPhase(cb)`: callback invoked, called after phase update, replaces previous, not called on throw
- Each setter (`setErr`, `setChs`, `setCur`, `setSrch`, `setFlt`, `setVol`, `setMuted`, `setFavs`): correct mutation + no side-effects on unrelated properties
- ST initial state: all 12 properties verified
