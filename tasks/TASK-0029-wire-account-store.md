---
id: TASK-0029
adr: ADR-0013
evolution: 7
status: pending
attempts: 0
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

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
