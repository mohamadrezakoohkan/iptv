---
id: ADR-0015
title: Community preset accounts — a curated iptv-org playlist list selectable from the account panel
date: 2026-06-12
evolution: 8
status: accepted
governs:
  - client/cfg.js
  - client/st.js
  - tests/unit/preset.test.js
---

# ADR-0015 — Community preset accounts — a curated iptv-org playlist list selectable from the account panel

## Context

E8 prompt: *"add https://github.com/iptv-org/iptv as the default account in
the other accounts lists user can select from other accounts list provided by
community."*

E7 (this same branch/PR) shipped the account panel (ADR-0014) with a connected
block, a saved-accounts list (switch/remove), and an "Add account" button that
returns to the footer login. Today the only way to connect is to **type** a URL
(footer, ADR-0008) or **switch** to an account you previously saved (ADR-0013).
There is no way to connect to a public community playlist without knowing and
typing its URL.

[iptv-org](https://github.com/iptv-org/iptv) publishes free, public IPTV
playlists in standard M3U format. The repo already exercises the canonical
iptv-org index playlist `https://iptv-org.github.io/iptv/index.m3u` in the live
integration tier (ADR-0006/0007, `tests/int/m3u.test.js`), so the M3U engine
path (ADR-0005 parse strategy, reaffirmed by ADR-0008; CORS proxy reuse via
`/api/xtream?url=` from ADR-0002) already supports these URLs end-to-end.

The prompt asks for these community playlists to appear **by default** in the
account panel — even before the user has saved any account of their own — and
to be **selectable** (connect with one click, no typing). The data-model and
connect-flow part of that is decided here; the panel UI surface is ADR-0016.

Two questions this ADR must answer:

1. **Where does the curated list live, and what is in it?** It must be small
   (avoid a maintenance/flakiness burden), all-M3U (the engine path already
   covers them), and tokenized per CONVENTIONS.md §1/§4.
2. **What does selecting a preset produce?** Specifically: is a preset a new,
   distinct "preset" account kind in the store, or does selecting it connect
   and become an ordinary saved account?

Constraints:

- CONVENTIONS.md §4: all constants live in `S` (`client/cfg.js`); §1 tokens —
  `pl`/`pls` (playlist/playlists) already exist; **a new `preset → pst` token**
  is requested below (CONVENTIONS.md §1 forbids coining short forms without a
  table entry). §9: pure helpers carry `get`/`mk`/`is` prefixes, ≤ 20 lines,
  ≤ 2 params; RULE-ID-4 PascalCase typedefs.
- ADR-0013 `Acct` model and its `st.js` helpers (`mkAcct`, `addAcct`,
  `saveAccts`, `saveAct`, `loadAccts`) are accepted and must not change shape.
- ADR-0008: the connection mode is explicit. A preset is a **playlist**, so it
  connects with `m3u: true` — never auto-detected.
- A failed connect must never mutate the saved-accounts store (ADR-0013
  invariant) — selecting a preset is no exception.

## Decision

### Community presets are a static, curated, all-M3U list in `S`

A **preset** is a named public community playlist. The curated list is a
frozen constant declared in `S` (`client/cfg.js`) as `S.psts`:

```
/** @typedef {{ name:string, url:string }} Pst */
```

The set is deliberately small and stable — the iptv-org index plus a few of its
themed playlists, all served from `https://iptv-org.github.io/iptv/`:

| `name`              | `url`                                                       |
|---------------------|-------------------------------------------------------------|
| iptv-org · All      | `https://iptv-org.github.io/iptv/index.m3u`                 |
| iptv-org · English  | `https://iptv-org.github.io/iptv/languages/eng.m3u`         |
| iptv-org · News     | `https://iptv-org.github.io/iptv/categories/news.m3u`       |
| iptv-org · Sports   | `https://iptv-org.github.io/iptv/categories/sports.m3u`     |
| iptv-org · Music    | `https://iptv-org.github.io/iptv/categories/music.m3u`      |

Five entries: enough to be useful, few enough that they are not a maintenance
or flakiness burden. `S.psts` is part of the frozen `S` object (CONVENTIONS.md
§4); it carries no credentials (all M3U).

### A new CONVENTIONS token: `preset → pst`

`preset`/`presets` have no §1 token. This ADR introduces `preset → pst` (max 3
chars; scope: var, prop, module) and `presets → psts` (max 4 chars; scope:
var, prop), added to CONVENTIONS.md §1 so `S.psts`, the `Pst` typedef, and the
preset helpers are compliant. (CONVENTIONS.md is a project artifact, not a
harness file — adding a token entry is in-scope for this evolution.)

### Selecting a preset connects via M3U and becomes an ordinary saved account

A preset is **not** a distinct account kind in the store. Selecting a preset:

1. connects through the existing engine on the **M3U path**: `connect(pst.url,
   { user: '', pass: '', m3u: true })` (ADR-0008 explicit mode; ADR-0002 proxy);
2. on **success** becomes a normal `Acct` (ADR-0013): `mkAcct({ url: pst.url,
   host: pst.url, user: '', pass: '', m3u: true })` → `addAcct` (dedupe by
   `url+user+m3u`, so re-selecting the same preset never duplicates it) →
   `saveAccts` + `saveAct`. It then appears in the saved-accounts list exactly
   like any other account and can be switched to or removed thereafter;
3. on **failure** writes nothing to the store (ADR-0013 invariant) and surfaces
   the existing inline connect error (ADR-0008).

This keeps ADR-0013's `Acct` model untouched (no `kind` field, no second
store): the curated list is a *catalog of connect shortcuts*, and a selected
preset is just an account the user connected without typing. The wiring of the
connect action reuses the account-switch machinery (`runSwitch`/`onSwOk`) and
is decided in ADR-0016/TASK-0032.

### Default visibility

`S.psts` is static data, present on every load. The panel renders the community
section from it unconditionally (ADR-0016), so the community list is the
"default account list" the prompt asks for — visible even with zero saved
accounts.

### A pure helper resolves a preset's connection identity

`st.js` gains one pure helper so the UI never constructs connection options
inline:

- `getPst(pst)` — pure: returns the connection identity for a preset as
  `{ url, user: '', pass: '', m3u: true, host: pst.url }`, ready for both
  `connect()` (the `user`/`pass`/`m3u` fields) and `mkAcct()` (adds `host`).
  ≤ 20 lines, 1 param (RULE-FN-2/3).

No other `st.js` change: `mkAcct`/`addAcct`/`saveAccts`/`saveAct` are reused
as-is.

## Consequences

**Easier:**
- One-click connect to well-known public playlists, no URL typing — the prompt.
- Zero new external connectivity: every preset URL is an iptv-org M3U already
  covered end-to-end by the existing live integration tier
  (`tests/int/m3u.test.js` hits `index.m3u`); the engine path is unchanged.
- The store stays single-model: a selected preset is an ordinary `Acct`, so
  switch/remove/dedupe/persistence all work with no new code (ADR-0013 reused).

**Harder:**
- The curated URLs are external and can drift if iptv-org reorganizes its repo;
  kept small (5) and all under the stable `iptv-org.github.io/iptv/` path to
  bound the risk. A broken preset URL fails the connect gracefully (inline
  error, store untouched) — it does not break the app.
- `S` now carries structured data (`psts`), not just scalars; it remains frozen
  and is still the single config source (CONVENTIONS.md §4).

**Ruled out:**
- A distinct "preset" account kind / second store (drift between two account
  models; the prompt only asks to *select* community playlists, which the
  existing `Acct` model already represents once connected).
- Fetching the preset catalog dynamically from the iptv-org repo at runtime
  (network dependency on app load, CORS, and flakiness — a static curated list
  is sufficient for the prompt and far more robust).
- Auto-detecting the M3U mode for a preset (ADR-0008 forbids URL-shape
  inference; presets state `m3u: true` explicitly).
- Adding more than a handful of presets (maintenance/flakiness burden — the
  orchestrator guidance and ADR-0006/0007 live-tier constraints both push for
  a small, stable set).

## Tasks derived

- TASK-0031 — Community presets data: `S.psts` curated list, `Pst` typedef,
  `getPst()` helper, `preset → pst` CONVENTIONS token
- TASK-0032 — Render the community presets section + wire selection to connect
  (ADR-0016)

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0015` comment near the top
(native comment syntax). When a change removes the last governed code, this
ADR is marked `status: deleted` — the file itself is never removed; it is
history.
