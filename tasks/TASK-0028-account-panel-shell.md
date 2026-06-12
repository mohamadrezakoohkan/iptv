---
id: TASK-0028
adr: ADR-0014
evolution: 7
status: pending
attempts: 0
depends_on: []
---

# TASK-0028 — Account nav button + right slide-in panel: markup, CSS, open/close

## Goal

After this task, a keyboard-accessible **account button** sits at the right
edge of the content-head bar, and clicking it slides in a **right-side
account panel** (with a backdrop scrim) that can be closed by its close
button, the scrim, or the Escape key. This task delivers the panel **shell**
and its open/close behavior only — the panel's account contents are rendered
in TASK-0030.

## Acceptance criteria

- [ ] `index.html` gains, at the right end of `.content-head`, an
      `#acct-btn` button (account glyph + label span), pushed to the right
      edge, with `aria-haspopup="dialog"`, `aria-controls="acct-panel"`, and
      `aria-expanded="false"`.
- [ ] `index.html` gains, inside `.app`, an `#acct-scrim` backdrop element and
      an `#acct-panel` aside (`role="dialog"`, `aria-label="Accounts"`,
      `aria-hidden="true"`) containing a header with an `#acct-close` button,
      a `#acct-conn` connected-account block, an `#acct-list` container, and an
      `#acct-add` button. Inner content may be empty placeholders here
      (TASK-0030 fills `#acct-conn`/`#acct-list`).
- [ ] `client/app.css`: the panel is fixed to the right edge, full height,
      ~320px wide, `--sur` background, left border `--ln`, above content via
      `z-index`, and **off-screen by default** via `transform: translateX`.
      An `is-open` class on `#acct-panel` slides it in; `is-open` on
      `#acct-scrim` shows the dimmed backdrop. Transition is CSS-driven. No
      inline styles drive open/close (CONVENTIONS §10). Mobile `< 760px`:
      panel becomes full-width.
- [ ] `client/ui.js`: `EL` declares `apnl, abtn, ascr, acls, aadd, alst,
      acon` and `mkEL` resolves them. `onAcctBtn()` toggles the panel,
      `onAcctClose()` closes it; opening adds `is-open` to panel + scrim and
      sets the button `aria-expanded="true"` and panel `aria-hidden="false"`,
      closing reverses all three. An Escape `keydown` handler closes the panel
      when open. Listeners wired in `mkEL` (button click, close click, scrim
      click, document/panel keydown).
- [ ] Open/close changes **no** ST phase and uses no boolean control-flow flag
      (CONVENTIONS §6) — it is the `is-open` class plus the aria attributes.

## Test requirements

- **Unit:** `tests/unit/acctui.test.js` (jsdom) — `mkEL` resolves the new
      `EL` entries; `onAcctBtn` toggles `is-open` on `#acct-panel` and
      `#acct-scrim` and flips `aria-expanded`/`aria-hidden`; `onAcctClose`
      and Escape close it. Per R-0001: assert `aria-expanded` toggles between
      `"true"`/`"false"` only because the markup ships `aria-expanded="false"`
      and `aria-hidden="true"` on those elements (this AC requires it); do not
      assert any attribute is added that the baseline HTML does not declare.
- **UI:** `tests/ui/acct.test.js` (Playwright) — the account button is
      visible at the top-right; clicking it slides the panel into view;
      clicking the close button, the scrim, and pressing Escape each hide it
      again; the button is reachable and operable by keyboard.
- **Integration:** n/a — no external connectivity (presentational shell).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
