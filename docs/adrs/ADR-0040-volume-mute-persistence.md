---
id: ADR-0040
title: Persist a single client-wide volume/mute preference (iptv_vol) mirroring the theme/sort pattern
date: 2026-06-15
evolution: 23
status: accepted
governs:
  - src/client/cfg.js
  - src/client/st.js
  - src/tests/unit/vol.test.js
---

# ADR-0040 — Persist a single client-wide volume/mute preference (`iptv_vol`)

## Context

The E23 prompt forbids any new **playback** localStorage key, with one explicit
exception: *"a single client-wide volume/mute preference may persist, mirroring
the theme/sort pattern."* The in-player controls layer (ADR-0039) changes
`<video>` volume and mute via keyboard shortcuts (M, ArrowUp/ArrowDown) and the
controls; without persistence those changes reset on every reload, which is the
behavior the exception is allowed to fix.

Reality at the E22 tip:

- `src/client/st.js` already declares `ST.vol` (1.0), `ST.muted` (false) and the
  `setVol` / `setMuted` writers; `src/client/cfg.js` already declares
  `S.volStp` (0.1). These exist but are **not persisted** and **not wired** to
  any control or `<video>`.
- The established chrome-persistence pattern (ADR-0019 theme, ADR-0017 sort):
  a key declared in `cfg.js` as `S.*Key` (`iptv_*` naming), read/written by
  helpers in `st.js` (`loadTheme`/`saveTheme`, sort persisted on write), and
  applied at `onReady` — **not** part of the phase machine (`ST` drives phases;
  this is chrome). This decision follows that pattern exactly.

Constraint: the prompt says **one** client-wide preference key — not per-account,
not per-channel. ADR-0003 owns the persistence model and the `iptv_*` / `S.*Key`
naming.

## Decision

Persist a **single client-wide** volume/mute preference under one new
localStorage key, following the theme/sort pattern.

- **Key**: `S.volKey = 'iptv_vol'` in `src/client/cfg.js`.
- **Shape**: JSON `{ vol: <number 0..1>, muted: <boolean> }`.
- **Read/write in `st.js`**:
  - `loadVol()` — reads `iptv_vol`, parses JSON, validates: `vol` is a finite
    number clamped to `[0,1]`, `muted` is a boolean. Any absent, malformed, or
    out-of-range value falls back to the defaults (`vol: 1.0`, `muted: false`),
    guarded against localStorage / JSON exceptions like the other readers.
  - `saveVol()` — serialises the current `ST.vol` / `ST.muted` to `iptv_vol`,
    guarded against exceptions like the other writers.
  - The existing `setVol` / `setMuted` writers call `saveVol()` after mutating
    `ST` (mirroring how sort persists on write), so any volume/mute change made
    by the controls or shortcuts (ADR-0039) is persisted immediately.
- **Not in the phase machine**: `iptv_vol` is chrome, like theme — it is not
  added to `ST`'s phase fields and triggers no phase transition.
- **Applied at load**: `src/client/main.js` `onReady` calls `loadVol()` and
  applies it to `ST` and the `<video>` (ADR-0039 owns the apply-to-element +
  control-sync step); the default case leaves today's behavior unchanged.

## Consequences

**Easier:**
- One key, one shape, the same read/validate/write discipline as theme/sort —
  trivially inspectable (`localStorage.iptv_vol`) and easy to test.
- Reuses the already-present `ST.vol`/`ST.muted`/`setVol`/`setMuted` so the
  controls layer just calls the existing writers and gets persistence for free.

**Harder:**
- `loadVol` must validate two fields (number-in-range + boolean) and degrade to
  defaults on any malformed value — covered by unit tests for the malformed and
  out-of-range cases.

**Ruled out:**
- Per-account or per-channel volume (the prompt says one client-wide
  preference).
- Adding volume/mute to the state-machine phase fields (it is chrome).
- Any second new playback key (forbidden by the prompt).

## Tasks derived

- TASK-0084 — `S.volKey = 'iptv_vol'` in cfg.js; `loadVol`/`saveVol` in st.js
  with validation + defaults; `setVol`/`setMuted` persist on write (unit:
  round-trip, malformed/out-of-range fallback, write-on-set).

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0040` comment near the top
(native comment syntax). When a change removes the last governed code, this ADR
is marked `status: deleted` — the file itself is never removed; it is history.
