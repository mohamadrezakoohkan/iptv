---
id: TASK-0008
adr: ADR-0001
evolution: 1
status: pending
attempts: 0
depends_on: [TASK-0003, TASK-0004]
---

# TASK-0008 — Footer component (login form + connected status)

## Goal

The footer renders two states: a login form (portal URL, username, password,
Connect button) when `ST.phase === 'INIT'` or `ST.phase === 'ERR'`, and a
connected status bar (green dot, host/user summary, Disconnect button) when
`ST.phase === 'READY'` or `ST.phase === 'PLAY'`. Phase transitions are
handled by the state machine and reflected by CSS classes on `body`.

## Acceptance criteria

- [ ] `client/ui.js` contains `rndFoot()` which toggles footer child visibility
      based on `ST.phase`.
- [ ] `.footer-login` section contains: Portal URL input (`flex-grow: 2`),
      Username input, Password input, Connect button (amber fill), hint text
      "Type 'demo' to try a sample playlist."
- [ ] `.footer-conn` section contains: green status dot, text "Connected to
      {host} as {user} · {N} channels · {M} categories", Disconnect button.
- [ ] Connect button: on click → disable button, show `.spinner` inside button,
      call `go('LOAD')`, call `IptvApi.connect(url, user, pass)`. On success:
      call `setChs(...)`, `go('READY')`, `rndSide()`, `rndGrid()`. On failure:
      call `go('ERR')`, `setErr(err)`, re-enable button and show error message.
- [ ] Disconnect button: on click → call `stopPlay()`, call `setChs([], [], '', '')`,
      remove `iptv_creds` from localStorage, call `go('INIT')` (after
      transitioning via ERR→INIT if needed, or READY→INIT directly).
- [ ] While connecting (LOAD phase): Connect button is disabled; URL, username,
      password inputs are disabled.
- [ ] On LOAD→ERR transition: inline error message appears below the footer
      fields; button is re-enabled.
- [ ] `EL.foot`, `EL.url`, `EL.uname`, `EL.pwd`, `EL.conn` references wired
      in `mkEL()`.

## Test requirements

- **Unit:** `rndFoot()` — mock ST in various phases; verify correct section
  visibility. Connect handler — mock `IptvApi.connect` resolving with
  `{ ok: true, val: {...} }`; verify `setChs` called with correct args;
  verify `go('READY')` called. Mock `{ ok: false, err: 'Login failed' }`;
  verify error displayed and button re-enabled.
- **UI:** Playwright — load app; verify login form visible; enter "demo" as
  URL; click Connect; verify spinner appears; verify connected status bar
  appears after ~1s; verify channel count shown; click Disconnect; verify
  login form reappears.
