---
id: ADR-0013
title: Multiple saved accounts — accounts list + active pointer replace the single iptv_creds record
date: 2026-06-12
evolution: 7
status: accepted
supersedes: ADR-0003
governs:
  - src/client/cfg.js
  - src/client/st.js
  - src/client/main.js
  - src/client/ui.js
  - src/tests/unit/acct.test.js
  - src/tests/unit/persist.test.js
  - src/tests/unit/cfg.test.js
---

# ADR-0013 — Multiple saved accounts — accounts list + active pointer replace the single iptv_creds record

## Context

E7 prompt: *"create a account feature where you display connected account and
server url, allows account switching and adding a new account; this account
is appearing as a navigation button on top right corner; when clicked it
opens a side bar on right side of the screen."*

Today the app persists exactly **one** connection identity in localStorage
under `iptv_creds` = `{ url, user, pass, m3u }` (ADR-0003, extended by
ADR-0008 with the `m3u` mode flag). On load `main.js` silently reconnects
with that single record; a successful footer connect overwrites it; Disconnect
removes it. There is no notion of more than one account, no way to switch
between connections, and no surface that names the connected account.

The prompt requires the app to **remember several connection identities at
once**, name the currently connected one, and let the user switch the active
one or add another. That is a data-model change: a single record can no longer
hold the state. The persistence decision (ADR-0003) and the reconnect path
(ADR-0003 + ADR-0008) must change; selection (`iptv_sel`) and favourites
(`iptv_favs`) persistence are **unaffected** and carry forward unchanged.

Constraints:

- CONVENTIONS.md §4: all keys/constants live in `S` (`client/cfg.js`); §5:
  `ST` is flat, fully declared up front, depth ≤ 2, writes via setters in
  `st.js`; RULE-FN-4 Result type; RULE-ID tokens (account → `acct`, accounts
  → `accts` — both new tokens requested below); kebab-case DOM ids.
- ADR-0008 mode flag (`m3u`) is part of each connection identity and must be
  preserved per account and replayed on reconnect — never re-detected.
- A failed connect must never mutate persisted accounts (ADR-0003 invariant).

## Decision

A **saved account** is the connection identity ADR-0003/ADR-0008 already
defined, plus a stable id and a display name:

```
/** @typedef {{ id:string, name:string, url:string, user:string, pass:string, m3u:boolean }} Acct */
```

- `id` — stable unique string (timestamp-derived, e.g. `String(Date.now())`),
  the switch/remove key.
- `name` — human label shown in the account panel and nav button. Derived at
  save time from the connection: the Xtream host + user, or the playlist host,
  or `"Demo"` for the demo playlist. Never blank.
- `url`, `user`, `pass`, `m3u` — exactly the ADR-0008 connection identity.

### Persistence: accounts list + active pointer

Two new localStorage keys, declared in `S` (`client/cfg.js`), **replacing**
ADR-0003's single `credsKey`:

| `S` property   | localStorage key  | Value schema                         |
|----------------|-------------------|--------------------------------------|
| `S.acctsKey`   | `"iptv_accts"`    | JSON `Acct[]` — all saved accounts   |
| `S.actKey`     | `"iptv_act"`      | plain string — id of the active acct |

`S.credsKey` (`"iptv_creds"`) is **removed** from `S`. `iptv_sel` (`S.selKey`)
and `iptv_favs` (`S.favsKey`) are unchanged and remain owned by ADR-0003's
carried-forward selection/favourites decision.

Account-store helpers live in `st.js` (the only file that touches
localStorage for app state):

- `loadAccts()` — pure read: returns `{ accts: Acct[], actId: string|null }`.
  Values failing `JSON.parse` are treated as absent (`[]` / `null`).
- `getAct(accts, actId)` — pure: the active `Acct` or `null`.
- `saveAccts(accts)` / `saveAct(actId)` — write one key each.
- `addAcct(accts, acct)` — pure: returns a new array with `acct` appended, or
  with the existing same-identity account replaced (dedupe by `url+user+m3u`),
  so reconnecting an existing account never duplicates it.
- `rmAcct(accts, id)` — pure: returns a new array without that id.

These keep RULE-FN-2 (≤ 20 lines) and RULE-FN-3 (≤ 2 params) — `addAcct`
takes `(accts, acct)`, the rest take one argument.

### Reconnect on load (replaces ADR-0003/ADR-0008 single-record path)

`main.js` on load reads `loadAccts()`. If an active account resolves, it
reconnects with that account's `{ url, user, pass, m3u }` (replaying the
stored `m3u` mode per ADR-0008 — never re-detected). If no accounts exist, the
app starts at INIT with the footer login, exactly as before.

### Successful connect saves/updates the active account

On a successful connect (footer login or "add account" from the panel), the
connection identity is turned into an `Acct` (id minted if new, name derived),
added via `addAcct` (dedupe), persisted with `saveAccts`, and made active with
`saveAct`. A **failed** connect writes nothing — the accounts store is
untouched.

### Legacy migration (one-time, read-time)

A pre-E7 install has `iptv_creds` but no `iptv_accts`. `loadAccts()` migrates
once, deterministically: if `iptv_accts` is absent/empty **and** a valid
`iptv_creds` exists, it is wrapped into a single `Acct` (id minted, name
derived, `m3u` resolved via the existing `getM3u()` legacy rule from
ADR-0008), becomes the sole + active account, and is written to the new keys.
`iptv_creds` is then removed. Migration touches stored data only.

## Consequences

**Easier:**
- Several portals/playlists coexist; switching is a stored-account replay, not
  re-typing credentials.
- The active account gives the panel and nav button a name + server URL to
  show with no new server state (still client-only, ADR-0002 untouched).
- Reconnect logic generalizes cleanly: "reconnect the active account" subsumes
  the old "reconnect the one record".

**Harder:**
- Credentials for several accounts now sit in plaintext localStorage (already
  true for one — ADR-0003 documented it; the surface widens).
- The single-record assumptions in `main.js`, `ui.js` (`onOk`/`onDisc`), and
  the persistence tests must all move to the accounts model in one evolution
  or reconnect breaks.
- `getM3u()` (ADR-0008) is reused for legacy migration, so it must survive.

**Ruled out:**
- Keeping `iptv_creds` as a parallel store (two sources of truth for the same
  thing — drift). It is migrated then removed.
- Server-side account storage (no user accounts on the server; ADR-0002 proxy
  is stateless — out of scope for the prompt).
- Encrypting stored credentials (out of scope; consistent with ADR-0003).

## Supersedes

Supersedes **ADR-0003** for the **credential-persistence** decision only
(pointer there: `superseded (by ADR-0013)`). ADR-0003's `iptv_sel`
(last-selected channel) and `iptv_favs` (favourites) persistence decisions,
and the `loadSt`/`saveSt` helpers that own them, are reaffirmed and carry
forward unchanged. Only the single-`iptv_creds` credential record and its
load-time reconnect are replaced by the accounts list + active pointer
decided above.

## Tasks derived

- TASK-0027 — Account store: `Acct` type, `S` keys, `st.js` helpers + legacy migration
- TASK-0029 — Wire connect/reconnect/switch/disconnect through the account store

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0013` comment near the top
(native comment syntax). When a change removes the last governed code, this
ADR is marked `status: deleted` — the file itself is never removed; it is
history.
