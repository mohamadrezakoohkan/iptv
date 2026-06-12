---
id: TASK-0027
adr: ADR-0013
evolution: 7
status: pending
attempts: 0
depends_on: []
---

# TASK-0027 — Account store: Acct type, S keys, st.js helpers + legacy migration

## Goal

After this task, the client persists **multiple accounts** instead of a
single `iptv_creds` record. `client/cfg.js` declares the two new localStorage
keys and drops `credsKey`; `client/st.js` exposes pure helpers to read, write,
add (dedupe), remove, and resolve the active account, plus a one-time
read-time migration of any legacy `iptv_creds` into the new accounts list.
No UI or reconnect wiring yet (TASK-0029/0030) — this is the data layer.

## Acceptance criteria

- [ ] `S` (`client/cfg.js`) declares `acctsKey: 'iptv_accts'` and
      `actKey: 'iptv_act'`, and **no longer** declares `credsKey`. `S` stays
      frozen; `selKey`/`favsKey` unchanged.
- [ ] `st.js` exports `loadAccts()` returning `{ accts: Acct[], actId:
      string|null }`; values failing `JSON.parse` are treated as absent
      (`[]` / `null`).
- [ ] `st.js` exports `getAct(accts, actId)` → the active `Acct` or `null`.
- [ ] `st.js` exports `saveAccts(accts)` and `saveAct(actId)` writing
      `iptv_accts` / `iptv_act` respectively.
- [ ] `st.js` exports `addAcct(accts, acct)` (pure) returning a new array with
      the account appended, or with an existing same-identity account
      (matched by `url` + `user` + `m3u`) replaced — never a duplicate.
- [ ] `st.js` exports `rmAcct(accts, id)` (pure) returning a new array without
      that id.
- [ ] `mkAcct(opts)` (pure, RULE-FN tokens) builds an `Acct` from a connection
      `{ url, user, pass, m3u, host, user (display) }`: mints `id`
      (`String(Date.now())`) when absent, derives a non-blank `name` (Xtream
      `host · user`, playlist `host`, or `"Demo"` for the demo url).
- [ ] **Legacy migration**: when `iptv_accts` is absent/empty and a valid
      `iptv_creds` exists, `loadAccts()` wraps it into one saved + active
      account (using `getM3u()` for the mode), writes the new keys, and removes
      `iptv_creds`. Returns the migrated `{ accts, actId }`.
- [ ] `getM3u()` (ADR-0008) and `loadSt`/`saveSt` for `sel`/`favs`
      (ADR-0003, carried forward) remain present and unchanged in behavior.
- [ ] All new functions respect CONVENTIONS: ≤ 20 body lines, ≤ 2 params,
      tokens from §1 (`acct`/`accts`), Result/pure-function prefixes.

## Test requirements

- **Unit:** `tests/unit/acct.test.js` — `loadAccts` (empty store, populated
  store, corrupt JSON dropped); `getAct` (hit / miss / null actId);
  `addAcct` (append new, replace same-identity dedupe); `rmAcct`;
  `mkAcct` name derivation for Xtream / playlist / demo and id minting;
  legacy `iptv_creds` migration (with and without `m3u`, demo case) writing
  the new keys and removing `iptv_creds`. Update `tests/unit/persist.test.js`
  / `tests/unit/cfg.test.js` for the removed `credsKey` and the new keys.
  Per R-0001, do not assert DOM attribute mutations here (no DOM in this task).
- **UI:** n/a — not user-facing (data layer only; UI lands in TASK-0028/0030).
- **Integration:** n/a — no external connectivity (localStorage only).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
