---
id: TASK-0067
adr: ADR-0032
evolution: 20
status: done
attempts: 1
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

Implemented the reminders data layer (ADR-0032). No DOM, no new state-machine
phase, no server route — pure store + pure selector.

**Files touched**

- `src/client/rem.js` (new) — `window.IptvRem`: `mkRem`, `key`, `list`, `has`,
  `add`, `rm`, `toggle`, `count`, `clear`, `load`, `due`. Persists the whole
  `Rem[]` to `iptv_rems` through a guarded `try/catch` on every mutator (mirrors
  `saveSt('favs')`); `load()` reads + JSON-parses + validates through a guarded
  parse (mirrors `loadSt`), drops malformed/non-object entries, never throws.
  `due(now)` is pure (no mutation, no persistence): selects reminders with
  `now - REM_GRACE <= start <= now` (`REM_GRACE` = 5 min), so a just-due
  reminder fires once and a long-past one is ignored. Defaults `now` to
  `Date.now()`.
- `src/client/cfg.js` — added `remsKey: 'iptv_rems'` to `S` (stays frozen);
  appended `ADR-0032` to the file's ADR comment line.
- `src/index.html` — loads `/rem.js` immediately after `/epg.js` (before
  `/play.js`/`/ui.js`), with an `ADR: ADR-0032` HTML comment.
- `src/tests/unit/rem.test.js` (new) — 26 unit tests.

**Non-obvious for reviewers / future tasks**

- **Shared-window-scope collision avoided (prior near-miss).** Client scripts
  are flat (non-IIFE) and share one browser global scope; `epg.js`/`errlog.js`
  already declare top-level `add`/`clear`/`count`/`has`/`set`. To avoid a
  redeclaration/overwrite collision, every top-level binding in `rem.js` is
  uniquely named (`REMS`, `REM_GRACE`, `remMk`, `remKey`, `remAdd`, `remRm`,
  `remToggle`, `remHas`, `remList`, `remCount`, `remClear`, `remLoad`,
  `remDue`, `isRem`, `remSave`). The public `window.IptvRem` object maps the
  spec member names (`mkRem`, `key`, `add`, …) onto those bindings.
- `list()`/`load()` follow the established **shallow-copy** contract (like
  `epg.js` `get` returning `list.slice()` and `ST.favs` holding plain values) —
  a fresh array, not deep-cloned entries.
- The store is guarded for test isolation: `remSave`/`remLoad` no-op when
  `window.S` or `window.localStorage` is absent, and a throwing localStorage is
  swallowed (store degrades to in-memory).
- ADR-0032 `governs:` was already correctly seeded with all four files; no
  true-up needed. No ADR became `deleted`.
