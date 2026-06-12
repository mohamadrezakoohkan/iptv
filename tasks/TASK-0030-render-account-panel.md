---
id: TASK-0030
adr: ADR-0014
evolution: 7
status: done
attempts: 1
depends_on: [TASK-0027, TASK-0028, TASK-0029]
---

# TASK-0030 — Render account panel contents: connected block, list, switch / remove / add

## Goal

After this task, the account panel (TASK-0028 shell) shows the **connected
account name + server URL**, lists all saved accounts with the active one
marked, lets the user **switch** to another saved account or **remove** one,
and offers **add account** that returns to the footer login. The nav button
label reflects the active account name. This wires the panel UI to the store
helpers (TASK-0027) and lifecycle paths (TASK-0029).

## Acceptance criteria

- [ ] `client/ui.js` `rndAcct()` renders, from the account store: the
      `#acct-btn` label (active account `name`, or "Account" when none),
      the `#acct-conn` connected-account block (name + server URL + green
      "Connected" dot when an account is active; a "Not connected" line
      otherwise), and the `#acct-list` rows.
- [ ] Each `#acct-list` row shows the account `name` + server `url`, marks the
      active account (`is-active` class + indicator), carries a switch target
      (`data-acct="<id>"`) and a remove control (`data-rm="<id>"`).
- [ ] `onAcctList(evt)` delegates: a click on `[data-rm]` removes that account
      (TASK-0029 remove path); a click on a non-active `[data-acct]` switches
      to it (TASK-0029 switch path); clicking the already-active row is a
      no-op. After any of these, `rndAcct` re-renders.
- [ ] `onAcctAdd()` (the `#acct-add` button) closes the panel, resets the
      footer to the logged-out login form, and focuses the URL field; a
      subsequent successful footer connect saves it as a new active account
      (TASK-0029 `onOk`).
- [ ] `rndAcct` is called after connect, disconnect, switch, add, and remove,
      so the nav button, connected block, list, and footer never disagree
      about the active account.
- [ ] The demo account's server URL renders as `demo` and its name as
      `"Demo"`; an Xtream account renders `host · user` and a playlist account
      its host.

## Test requirements

- **Unit:** extend `tests/unit/acctui.test.js` (jsdom) — `rndAcct` produces
      the correct button label, connected block (connected vs not-connected),
      and list rows with the active marker and `data-acct`/`data-rm`
      attributes; `onAcctList` dispatches switch vs remove vs active-no-op;
      `onAcctAdd` resets to the login form. Per R-0001, confirm against the
      baseline markup which attributes the rendered rows actually carry before
      asserting on attribute presence/mutation.
- **UI:** extend `tests/ui/acct.test.js` (Playwright) — after a demo connect,
      the panel shows the connected account name + server URL and one list
      row marked active; the nav button label shows the account name; "Add
      account" closes the panel and reveals the footer login with the URL
      field focused; removing the connected account returns to the footer
      login.
- **Integration:** n/a — no external connectivity (rendering + delegation;
      the underlying connect/switch is exercised by TASK-0029 and the existing
      `tests/int/*` suite).

## Implementation notes

**Files touched**

- `client/ui.js` — new render + handler functions: `getSrv` (pure: server URL
  shown for an account; demo → its stored `"demo"` url), `mkRow` (one
  `.acct-row` HTML string: `data-acct`/`data-rm`, `is-active` marker + dot),
  `rndConn` (connected block: name + server url + green Connected dot, or a
  "Not connected" line), `rndList` (one row per saved account, empty-state
  line when none), `rndAcct` (composes the nav-button label, connected block,
  and list from `loadAccts()`/`getAct()`), `onAcctList` (delegates row clicks:
  `[data-rm]` → `onAcctRm` then re-render; non-active `[data-acct]` →
  `goSwitch`; active row → no-op), `onAcctAdd` (closes the panel, `tearDown` to
  the logged-out footer, focuses `#f-url`). Listeners for `#acct-list` and
  `#acct-add` wired in `mkEL`; the three new entry points exported on
  `window.IptvUi`. `rndAcct()` is now called from `onOk` (connect), `onSwOk`
  (switch complete), and `tearDown` (disconnect / add / remove-active), so the
  nav button, connected block, list, and footer never disagree.
- `client/main.js` — `onReady` calls `window.IptvUi.rndAcct()` once at init so
  the button + panel reflect the active account on load.
- `client/app.css` — styles for `.acct-conn*` (connected block) and
  `.acct-row*` (list rows incl. `.is-active`), plus an `.acct-empty` line.
- `tests/unit/acctui.test.js` — TASK-0030 unit tests: a richer loader
  (`loadUiStore`) providing a configurable account store + a real
  `#acct-label`; covers the button label, connected vs not-connected block,
  demo server-url rendering, list rows with `data-acct`/`data-rm` and the
  `is-active` marker, the empty state, and `onAcctList` switch / remove /
  active-no-op + `onAcctAdd` reset.
- `tests/ui/acct.test.js` — TASK-0030 e2e: after a demo connect the panel
  shows the connected name + server url, the nav label shows the name, the
  list has one active row; "Add account" closes the panel and focuses
  `#f-url`; removing the connected account returns to the footer login and
  empties the list.
- `tests/unit/foot.test.js`, `tests/unit/persist.test.js` — test-stub upkeep
  only: added `getAct` (foot) and a `rndAcct: vi.fn()` (persist) to the
  hand-rolled `IptvSt`/`IptvUi` stubs so they match the new contract
  (`onOk`/`onReady` now call `rndAcct`). No assertions weakened.

**Non-obvious**

- Switch is asynchronous: `onAcctList` calls `goSwitch` (which tears down then
  reconnects); the final panel state is rendered by `onSwOk`/`tearDown`, not by
  the immediate post-call `rndAcct` (kept only for the active-no-op case).
- Per R-0001: the rendered rows are produced fresh by `rndAcct` (not mutated
  in place), and the asserted `data-acct`/`data-rm`/`is-active` attributes are
  exactly the ones `mkRow` emits — confirmed against the emitted HTML, not
  against pre-existing baseline markup.
- No `governs:` change needed: every file touched is already governed by its
  ADR (ui.js/app.css/index.html/acctui/acct → ADR-0014; main.js → ADR-0013)
  and carries its `ADR:` comment.
