---
id: ADR-0032
title: Program reminders are a client-side, localStorage-persisted store mirroring the favourites pattern, keyed off the in-memory EPG program data
date: 2026-06-15
evolution: 20
status: accepted
governs:
  - src/client/rem.js
  - src/client/cfg.js
  - src/index.html
  - src/tests/unit/rem.test.js
---

# ADR-0032 — Program reminders are a client-side, localStorage-persisted store mirroring the favourites pattern, keyed off the in-memory EPG program data

## Context

E20 prompt (the E19 Phase-4 research winner): add program reminders on top of
the EPG. A user can mark an upcoming program; reminders **persist in a new
localStorage-keyed store (mirroring the favourites pattern)**, with **no new
state-machine phase, no new playback engine, no new server route**, and they
**read the in-memory `IptvEpg` `Prg` store / now-next selectors**.

Constraints already in the codebase:

- **Favourites persistence pattern (ADR-0003).** `ST.favs` is a plain array of
  channel-id strings persisted to the single localStorage key `iptv_favs`,
  written through a guarded `saveSt('favs')` and read through a guarded
  `loadSt`, both swallowing localStorage exceptions. This is the exact pattern
  the prompt says to mirror.
- **EPG store (ADR-0030, `docs/specs/epg.md` §1–§2).** `window.IptvEpg` is an
  in-memory, session-scoped program-guide store keyed by channel id, exposing
  the canonical `Prg` schema plus `getNowNext`/`getSched`/`get` selectors.
  Reminders read it; they do not change it.
- **Self-contained client IIFE pattern (ADR-0027 errlog, ADR-0030 epg).** A
  small `window.Iptv*` module loaded in `src/index.html` before `ui.js`, with
  pure builders + a guarded global, is the established shape for added client
  stores.

## Decision

Add a self-contained client module **`src/client/rem.js`** exposing
`window.IptvRem`: a reminder store that **is persisted** to a **new
localStorage key `iptv_rems`** (added to `src/client/cfg.js` `S` as
`remsKey`), mirroring the favourites pattern (ADR-0003) — a plain array of
reminders, written/read through guarded `try/catch` that swallows localStorage
exceptions.

A reminder is the small shape **`Rem` = `{ chId, start, title }`** derived from
the canonical `Prg` (ADR-0030): identity is the `chId`+`start` pair (a program
start on a channel is remindable at most once); `title` is carried for display.
Data shape, store API, and selector rules are specified in
`docs/specs/reminders.md` §1–§2. In summary:

- Builders/identity: `mkRem(chId, prg)`, `key(chId, start)`.
- Store: `list` / `has` / `add` / `rm` / `toggle` / `count` / `clear`, each
  mutating member persisting through the guarded write.
- Load: `load()` reads `iptv_rems`, validates, drops malformed entries, never
  throws.
- Selector: `due(now)` is **pure** — returns reminders due at/before `now`
  within a small grace window; it never mutates (the timer, ADR-0034, decides
  what to do with the due list).

The module is loaded in `src/index.html` after `epg.js` and before `ui.js`
(which reads it), mirroring the `errlog.js`/`epg.js` load order, and callers
guard `window.IptvRem` for test isolation. It adds **no state-machine phase**
(CONVENTIONS §6 unchanged) and **no server route** — reminders are entirely
client-side.

## Consequences

**Easier:**
- Reuses the proven favourites localStorage pattern (ADR-0003) — one new key,
  guarded read/write, array-shaped — no migration, no account coupling.
- Reads the already-existing `Prg`/selectors (ADR-0030) — no new program type,
  no EPG store change.
- Pure `due(now)` selector keeps the timer (ADR-0034) trivial and testable.

**Harder:**
- A persisted reminder references a program by `chId`+`start`; the live guide
  may not contain that exact program anymore (guide refresh). The `due`
  selector and firing must tolerate that without throwing (carry `title` for
  copy; resolve `Ch` best-effort at jump time).

**Ruled out:**
- Persisting reminders inside the account/EPG store (the prompt scopes this to
  a new favourites-style key; the EPG store stays in-memory per ADR-0030).
- A server-side reminder store / route (unrequested scope; the prompt is
  explicit: no new server route).
- A new state-machine phase or boolean control flag (CONVENTIONS §6; the prompt
  is explicit: no new state-machine phase).

## Tasks derived

- TASK-0067 — `rem.js` store: `Rem` shape, builders (`mkRem`, `key`), store
  ops (`list`/`has`/`add`/`rm`/`toggle`/`count`/`clear`), `load()` +
  `iptv_rems` localStorage persistence (`remsKey` in `cfg.js`), `due(now)`
  selector; `index.html` load order.

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0032` comment near the top
(native comment syntax; `index.html` via HTML comment). When a change removes
the last governed code, this ADR is marked `status: deleted` — the file itself
is never removed; it is history.
