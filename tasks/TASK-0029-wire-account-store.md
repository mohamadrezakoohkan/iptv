---
id: TASK-0029
adr: ADR-0013
evolution: 7
status: done
attempts: 1
depends_on: [TASK-0027]
---

# TASK-0029 — Wire connect / reconnect / switch / disconnect through the account store

## Goal

After this task, the app's connection lifecycle runs on the account store from
TASK-0027 instead of the single `iptv_creds` record: load-time reconnect uses
the active account, a successful footer connect saves/updates + activates an
account, switching replays a saved account, and disconnect/remove update the
store correctly. No reads/writes of `iptv_creds` remain anywhere in the client.
(Also governed by ADR-0014 for the switch/add/remove entry points; the panel
rendering itself is TASK-0030.)

## Acceptance criteria

- [ ] `client/main.js` on load calls `loadAccts()` (TASK-0027), resolves the
      active account via `getAct`, and if present reconnects with its
      `{ url, user, pass, m3u }` (replaying the stored `m3u`, never
      re-detected). With no accounts it stays at INIT showing the footer login.
      No reference to `credsKey`/`iptv_creds` remains in `main.js`.
- [ ] `client/ui.js` `onOk` (successful footer connect) builds an `Acct` via
      `mkAcct` from the entered connection, `addAcct`s it (dedupe), persists
      with `saveAccts`, sets it active with `saveAct`, and stops writing
      `iptv_creds`. A failed connect (`onFail`) writes nothing to the store.
- [ ] A `goSwitch(id)` / `onAcctSwitch` path reconnects the selected saved
      account (replaying its `m3u`), tears down any playing stream first, sets
      it active on success, and surfaces the inline connect error on failure
      without mutating the store.
- [ ] An `onAcctRm(id)` / remove path deletes the account via `rmAcct` +
      `saveAccts`; removing the **active** account also clears the active id
      and disconnects (session cleared, footer login shown); removing a
      non-active account leaves the live session untouched.
- [ ] `onDisc` clears the active session and active id but preserves the saved
      `iptv_accts`, `iptv_sel`, and `iptv_favs` (no longer removes
      `iptv_creds`, which no longer exists).
- [ ] The full existing unit + UI suites still pass (no regression in connect,
      reconnect, footer, persistence, or playback behavior).

## Test requirements

- **Unit:** extend `tests/unit/acct.test.js` and update
      `tests/unit/persist.test.js` / `tests/unit/foot.test.js` — successful
      connect appends + activates an account (dedupe on re-connect of the same
      identity); failed connect leaves the store untouched; disconnect
      preserves accounts; remove-active clears the active id; load-time
      reconnect picks the active account and replays its `m3u`. Per R-0001,
      check baseline HTML before asserting any attribute mutation.
- **UI:** extend `tests/ui/acct.test.js` and update `tests/ui/persist.test.js`
      — after a successful demo connect, reloading the page auto-reconnects via
      the stored active account; disconnect returns to the footer login while
      the account remains saved.
- **Integration:** n/a — no new external connectivity (reuses the existing
      `IptvApi.connect` engine and proxy; live connectivity is already covered
      by the `tests/int/*` suite). The switch path calls the same
      `connect()` exercised by existing integration tests.

## Implementation notes

Moved the connection lifecycle off the single `iptv_creds` record onto the
ADR-0013 accounts store. The legacy compatibility shim TASK-0027 retained is
gone: `S.credsKey` removed from `client/cfg.js`; `loadSt()` and the private
`getCreds` helper no longer read/return `creds` — `loadSt()` now returns only
`{ sel }` (it still owns `iptv_sel` + `iptv_favs` under ADR-0003). No
read/write of `iptv_creds` remains in the client **except** the one-time
read-time migration inside `loadAccts`/`runMig` (`st.js`), which is the
intended ADR-0013 legacy migration.

Files touched:
- `client/cfg.js` — dropped `credsKey`.
- `client/st.js` — removed `getCreds` + the creds branch of `loadSt`; added
  `clearAct()` (removes the `iptv_act` key, leaves the accounts list intact)
  and exported it.
- `client/main.js` — load-time reconnect now reads `loadAccts()`, resolves the
  active account via `getAct`, and `goLoad(acct)` replays its
  `{ url, user, pass, m3u }` (stored m3u, never re-detected). No accounts →
  stays at INIT.
- `client/ui.js` — `onOk` now calls the new `saveActive` helper (mkAcct →
  addAcct dedupe → saveAccts → saveAct) instead of writing `iptv_creds`; a
  failed connect (`onFail`) still writes nothing. `onDisc` now `clearAct()` +
  the extracted `tearDown()` (preserves `iptv_accts`/`iptv_sel`/`iptv_favs`).
  Added `goSwitch(id)` (+ `runSwitch`/`onSwOk`) replaying a saved account and
  setting it active on success, surfacing the inline error on failure without
  mutating the store, and `onAcctRm(id)` deleting an account (clearing the
  active id + tearing down only when the removed account is the active one).
  `goSwitch` and `onAcctRm` are exported on `window.IptvUi` for TASK-0030 to
  wire to the panel rows (panel rendering itself is out of scope here).

Tests: rewrote the legacy `iptv_creds` assertions in
`tests/unit/persist.test.js` (UI harness now loads the real cfg.js+st.js so
the store helpers run against mocked localStorage), `tests/unit/cfg.test.js`
(credsKey removed), and `tests/ui/persist.test.js` (accounts-store + migration
model). Added switch/remove/disconnect unit coverage and account-store wiring
UI tests in `tests/ui/acct.test.js`. `tests/unit/foot.test.js` gained
account-store stubs so its connect-success path (which now calls `saveActive`)
runs. Full unit suite (350) and full UI suite (99) green.

Traceability: no `governs:` changes needed — every file is already listed
under ADR-0013 / ADR-0014, and all carry their `ADR:` comments. ADR-0003's
superseded-portion note stays accurate: `loadSt`/`saveSt` still own
`iptv_sel` + `iptv_favs`, so ADR-0003 keeps live code and stays `accepted`.
