---
id: TASK-0003
adr: ADR-0001
evolution: 1
status: pending
attempts: 0
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
