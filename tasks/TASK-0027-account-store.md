---
id: TASK-0027
adr: ADR-0013
evolution: 7
status: done
attempts: 2
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

- [x] `S` (`client/cfg.js`) declares `acctsKey: 'iptv_accts'` and
      `actKey: 'iptv_act'`. **`credsKey` is retained** (orchestrator-directed,
      attempt 2): the live `ui.js`/`main.js` connect/reconnect/disconnect
      runtime still uses it, so dropping it before TASK-0029 rewires that path
      half-migrates the runtime and breaks reconnect (the attempt-1 regression).
      TASK-0029 removes `credsKey` when it moves the runtime to the accounts
      store. `S` stays frozen; `selKey`/`favsKey` unchanged.
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

Data layer only — no UI/reconnect wiring (TASK-0029/0030).

**Files touched:**

- `client/cfg.js` — added `S.acctsKey: 'iptv_accts'` and `S.actKey: 'iptv_act'`
  (the forward accounts store). `S.credsKey: 'iptv_creds'` is **retained** so the
  existing `ui.js`/`main.js` connect/reconnect/disconnect runtime keeps working
  until TASK-0029 rewires it onto the accounts store; dropping it half-migrates
  the runtime and breaks reconnect (see retry note). `S` stays frozen;
  `selKey`/`favsKey` unchanged. `ADR-0013` in the header comment.
- `client/st.js` — added the account store (ADR-0013): `Acct` typedef, exported
  `mkAcct`, `getAct`, `addAcct`, `rmAcct`, `saveAccts`, `saveAct`, `loadAccts`,
  plus module-private helpers `getName` (name derivation), `isSame` (identity
  predicate), `getOld` (pure legacy→store), `runMig` (migration side effects).
  `loadSt` continues to read `sel` + `favs` + the legacy `iptv_creds` record and
  return `{ sel, creds }` (new pure helper `getCreds` resolves the `m3u` mode via
  `getM3u`) so the live reconnect path in `main.js` keeps functioning until
  TASK-0029. `saveSt` unchanged. `getM3u` unchanged and reused by
  `mkAcct`/migration/`getCreds`. `ADR-0013` in the header.
- `tests/unit/acct.test.js` — new: `loadAccts` (empty / populated / corrupt /
  no-migrate-when-present), `getAct`, `addAcct` (append / same-identity replace /
  m3u-distinguishes / no-mutate), `rmAcct`, `mkAcct` (name derivation for
  Xtream / playlist / demo, id minting, m3u resolution), `saveAccts`/`saveAct`,
  and full legacy migration (writes new keys, removes `iptv_creds`, m3u rule).
- `tests/unit/persist.test.js` — sel/favs, `getM3u`, `onOk`, and auto-reconnect
  coverage unchanged; added a `loadSt() — legacy iptv_creds reconnect path`
  block (creds absent / explicit m3u / missing-flag resolution / corrupt JSON).
  `ADR-0013` in header.
- `tests/unit/cfg.test.js` — added `acctsKey` / `actKey` assertions; asserts
  `credsKey` is `'iptv_creds'` (legacy reconnect path, retained until TASK-0029).
- `adrs/ADR-0013` — `governs:` already lists all touched files; no change needed.

**Retry note (attempt 1 → 2):** Attempt 1 dropped `S.credsKey` and narrowed
`loadSt` to sel+favs, moving creds entirely into the new accounts store. The
unit suite stayed green (it stubs `S`/`loadSt`), but `ui.js`/`main.js` still
read/write `iptv_creds` via `window.S.credsKey` and `loadSt().creds`, which were
now `undefined`/absent — so the live Playwright `persist.test.js` reconnect /
disconnect flow broke (6 failures). Fix: keep the legacy `iptv_creds`
read/write functional in the data layer (retain `S.credsKey`, keep
`loadSt().creds`) while adding the accounts store **additively**. TASK-0029 owns
moving the runtime onto `loadAccts`/`saveAccts`/`saveAct` and then removing the
legacy `credsKey`/`loadSt().creds` path.

**Non-obvious for reviewers / TASK-0029:**

- `client/ui.js` (lines ~359/412) and `client/main.js` (auto-reconnect via
  `loadSt().creds`) still drive the single-record `iptv_creds` path. TASK-0029
  must rewire connect/reconnect/switch/disconnect onto the accounts store and
  then drop `S.credsKey` and `loadSt().creds`/`getCreds`.
- `addAcct` dedupe identity is `url + user + m3u` (per the ADR), so the same
  portal connected once as Xtream and once as M3U are two distinct accounts.
- Account name derivation lives in `getName`: demo url → `"Demo"`, Xtream →
  `host · user`, playlist → `host`, with a `"Account"` floor so names are never
  blank.
