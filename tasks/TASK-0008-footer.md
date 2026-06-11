---
id: TASK-0008
adr: ADR-0001
evolution: 1
status: done
attempts: 1
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

## Implementation notes

### Files touched
- `index.html` — replaced old `<footer class="footer"><div class="footer-form" id="footer-form">` with the two-section structure: `id="footer"` on the footer element, `id="footer-login"` (login form with `id="login-form"`, field ids `f-url`/`f-user`/`f-pass`, `id="btn-conn"`, `id="footer-hint"`, `id="footer-err"`) and `id="footer-conn"` (status bar with `id="conn-text"`, `id="btn-disc"`).
- `client/ui.js` — expanded `EL` declaration with 10 new properties (`url`, `uname`, `pwd`, `conn`, `logi`, `hint`, `ferr`, `bcon`, `bdis`, `ctxt`); updated `EL.foot` to point to `#footer`; replaced `rndFooter()` with `rndFoot()` implementing INIT/ERR→login visible/conn hidden, READY/PLAY/SRCH→conn visible/login hidden with status text; added `onUrlInput()`, `onOk()`, `onFail()`, `runConn()`, `onConn()`, `onDisc()`; updated `mkEL()` to wire all new element refs and events; updated public API export.
- `tests/unit/foot.test.js` — new file; 20 unit tests covering `rndFoot()` in all phases, connect success/failure paths via form submit handler introspection.
- `tests/ui/foot.test.js` — new file; 13 Playwright tests covering initial state, URL-input→button-enable, demo connect flow, disconnect flow.

### Non-obvious decisions
- `onDisc()` guards `stopPlay()` with `cur === 'PLAY'` check because `play.js`'s `stopPlay()` dereferences `_vid` unconditionally — calling it before `mkPlay()` initializes `_vid` (which happens in TASK-0009's `main.js`) would throw. The guard is semantically correct: only a channel actively playing (PLAY phase) needs stopping.
- `runConn()` is an async function (RULE-FN-4 compliant) called from `onConn()` with `.catch()` to handle any unexpected rejections, keeping `onConn` itself synchronous and side-effect-prefix-correct.
- The existing `rndFooter` export was replaced by `rndFoot` — no external consumers referenced `rndFooter` in any test file.
