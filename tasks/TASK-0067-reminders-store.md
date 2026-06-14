---
id: TASK-0067
adr: ADR-0032
evolution: 20
status: pending
attempts: 0
depends_on: []
---

# TASK-0067 — Reminders store (`rem.js`) with localStorage persistence + `due` selector

## Goal

A new self-contained client module `src/client/rem.js` exposing
`window.IptvRem`: a reminder store that persists to a new localStorage key
`iptv_rems` (mirroring the favourites pattern, ADR-0003), built from the
canonical `Prg` (ADR-0030). When done, the rest of the feature has a tested,
guarded store to read/write and a pure `due(now)` selector to drive firing.

## Acceptance criteria

- [ ] `src/client/cfg.js` `S` gains a `remsKey: 'iptv_rems'` entry (and `S`
      stays frozen); the module carries `ADR: ADR-0032`.
- [ ] `src/client/rem.js` defines `window.IptvRem` with: `mkRem(chId, prg)`
      → `{ chId, start, title }`; `key(chId, start)` → `"<chId>|<start>"`;
      `list()` (fresh copy); `has(chId, start)`; `add(rem)` (de-duped by
      identity, persists); `rm(chId, start)` (persists); `toggle(chId, prg)`
      (add/remove, returns resulting pressed boolean, persists); `count()`;
      `clear()` (persists); `load()` (reads + validates `iptv_rems`, drops
      malformed entries, never throws); `due(now)` (pure — reminders due
      at/before `now` within a small grace window).
- [ ] Identity is the `chId`+`start` pair: `add` of a duplicate identity does
      not create a second entry; `toggle` of a set reminder removes it.
- [ ] Persistence mirrors favourites: every mutating op writes `iptv_rems`
      through a guarded `try/catch`; `load()` reads through a guarded parse. A
      thrown localStorage call is swallowed (store degrades to in-memory, never
      throws).
- [ ] `due(now)` is pure (no mutation, no persistence); it returns only
      reminders whose `start <= now` and within the grace window, never
      long-past ones.
- [ ] `src/index.html` loads `/rem.js` after `/epg.js` and before `/ui.js`
      (HTML comment carries `ADR: ADR-0032`).
- [ ] The module is guarded for test isolation (callers tolerate a missing
      `window.IptvRem`), mirroring `errlog.js`/`epg.js`.

## Test requirements

- **Unit:** `src/tests/unit/rem.test.js` — `mkRem` shape from a `Prg`; `key`
  format; `add`/`has`/`rm`/`toggle` including de-dup by identity and toggle
  return value; `count`/`clear`; `load()` validates and drops malformed
  entries and never throws (including a throwing localStorage stub);
  persistence writes `iptv_rems` (mocked localStorage); `due(now)` selects only
  in-window due reminders and never mutates. Honor R-0001 for any DOM-attribute
  assertions (none expected here — this is a pure/store module).
- **UI:** n/a — not user-facing on its own (covered by TASK-0068+).
- **Integration:** n/a — no external connectivity (client-only store).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
