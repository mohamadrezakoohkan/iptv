---
id: ADR-0003
title: Persistence strategy — localStorage keys for credentials, selection, favourites
date: 2026-06-11
evolution: 1
status: accepted   # credential-persistence decision superseded (by ADR-0013, E7); iptv_sel + iptv_favs decisions remain in force
governs:
  - src/client/st.js
  - src/client/cfg.js
  - src/client/ui.js
  - src/client/main.js
---

# ADR-0003 — Persistence strategy — localStorage keys for credentials, selection, favourites

## Context

The design requires three pieces of client-side state to survive page
refreshes:

1. **Credentials** — portal URL, username, password — so the app can
   silently reconnect without re-entering them.
2. **Last-selected channel** — `stream_id` of the most recently played
   channel — so playback can resume on reload.
3. **Favourites** — the set of `stream_id` values the user has starred.

All three are client-only (the server has no user accounts). localStorage is
the appropriate API: it is synchronous, requires no network, persists across
sessions, and is available in all target browsers.

The design prototype uses three constants (`STORE_KEY`, `SELECT_KEY`,
`FAVS_KEY`) with literal string values. CONVENTIONS.md §4 requires all
constants to live in the config object `S` in `client/cfg.js`.

## Decision

> **E7 update:** the `iptv_creds` row below — the single-credential record and
> its load-time reconnect — is **superseded by ADR-0013**, which replaces it
> with a saved-accounts list (`iptv_accts`) plus an active pointer (`iptv_act`).
> The `iptv_sel` and `iptv_favs` rows, and the `loadSt`/`saveSt` helpers that
> own them, remain in force under this ADR.

Three localStorage keys, declared in `S` (client `cfg.js`):

| `S` property  | localStorage key   | Value schema                         |
|---------------|--------------------|--------------------------------------|
| `S.credsKey`  | `"iptv_creds"`     | JSON `{ url:string, user:string, pass:string }` |
| `S.selKey`    | `"iptv_sel"`       | plain string (stream_id as string)   |
| `S.favsKey`   | `"iptv_favs"`      | JSON array of stream_id strings      |

**Read / write rules:**
- All localStorage reads and writes go through two helper functions in
  `st.js`: `loadSt()` (reads all three keys on startup) and
  `saveSt(field)` (writes one key after a state mutation).
- Credentials (`iptv_creds`) are written only after a successful connect;
  a failed connect attempt never writes to localStorage.
- Disconnect removes `iptv_creds` but leaves `iptv_sel` and `iptv_favs`
  intact so they are available on the next session.
- On page load, if `iptv_creds` is present, `main.js` calls
  `IptvApi.connect()` with the stored credentials; on success the session
  is restored (last channel re-selected if present in the new playlist,
  favourites merged from storage).
- Values that fail JSON.parse are silently dropped and treated as absent.

**Stream ID format:** stream IDs from the Xtream API are numbers. They are
stored as strings (`String(stream_id)`) to avoid JSON number precision issues
and to make localStorage lookups uniform (`===` string comparison).

## Consequences

**Easier:**
- Auto-reconnect works with zero user interaction after the first successful
  login.
- Favourites and last selection survive portal disconnects.
- No server-side session state is needed.

**Harder:**
- Credentials are stored in plaintext in localStorage — standard browser
  storage; acceptable for an IPTV player but worth documenting.
- If the portal's channel list changes between sessions, `iptv_sel` may
  reference a stream_id that no longer exists; `loadSt()` must handle this
  gracefully (ignore unknown ids).

**Ruled out:**
- `sessionStorage` (would not survive page refresh).
- Cookie-based storage (server-side; unnecessarily complex).
- IndexedDB (overkill for three small values).

## Tasks derived

- TASK-0010 — localStorage persistence layer (loadSt, saveSt, auto-reconnect)

## Traceability

Every file listed in `governs:` must carry `// ADR: ADR-0003` near the top.
`st.js` already governs ADR-0001; it carries both `ADR: ADR-0001, ADR-0003`.
