---
id: TASK-0058
adr: ADR-0028
evolution: 17
status: pending
attempts: 0
depends_on: [TASK-0057]
---

# TASK-0058 — Log button (beside the account button) + slide-in log panel: markup, CSS, open/close

## Goal

After this task, a keyboard-accessible **log button** (`#log-btn`) sits in
`.content-head` immediately beside the account button (`#acct-btn`), and
clicking it slides in a **log panel** (`#log-panel`) with a backdrop scrim,
closable by its close button, the scrim, or Escape — structurally parallel to
the account panel (ADR-0028, ADR-0014). This task delivers the panel **shell**
and its open/close behavior only; rendering log content and the count badge is
TASK-0059.

## Acceptance criteria

- [ ] `src/index.html` gains, in `.content-head` **immediately before**
      `#acct-btn`, a `#log-btn` button (log glyph + label span + an empty
      `#log-count` badge child) with `aria-haspopup="dialog"`,
      `aria-controls="log-panel"`, and `aria-expanded="false"`. The account
      button stays last and keeps `margin-left:auto` so the pair sits at the
      right edge.
- [ ] `src/index.html` gains, inside `.app`, a `#log-scrim` backdrop and a
      `#log-panel` aside (`role="dialog"`, `aria-label="Playback failure log"`,
      `aria-hidden="true"`) containing a header with a `#log-clear` button and a
      `#log-close` button, and a `#log-list` container. Inner list content may
      be an empty placeholder here (TASK-0059 fills `#log-list`/`#log-count`).
- [ ] `src/client/app.css`: the panel is fixed to a screen edge, full height,
      ~320px wide, `--sur` background, inner-edge border `--ln`, above content
      via `z-index`, and **off-screen by default** via `transform: translateX`.
      An `is-open` class on `#log-panel` slides it in; `is-open` on `#log-scrim`
      shows the dimmed backdrop. Transition is CSS-driven; no inline styles
      drive open/close (CONVENTIONS §10). The `#log-count` badge is hidden via a
      CSS class (not inline style) when empty. Mobile `< 760px`: panel
      becomes full-width.
- [ ] `src/client/ui.js`: `EL` declares `lbtn, lcnt, lpnl, lscr, lcls, lclr,
      llst` and `mkEL` resolves them. `setLog(open)` toggles `is-open` on
      `#log-panel` + `#log-scrim`, sets `#log-btn` `aria-expanded`, and
      `#log-panel` `aria-hidden` (mirroring `setAcct`). `onLogBtn()` toggles
      from the panel's current `is-open`; `onLogClose()` closes it. The existing
      document Escape `keydown` handler also closes the log panel when it is the
      open one. Listeners wired in `mkEL` (button click, close click, scrim
      click, keydown). New handlers exported on `window.IptvUi`.
- [ ] Open/close changes **no** ST phase and uses no boolean control-flow flag
      (CONVENTIONS §6) — it is the `is-open` class plus the aria attributes, and
      opening the log panel does not force the account panel closed.
- [ ] `index.html`, `app.css`, and `ui.js` carry `ADR-0028` in their ADR
      comment lines.

## Test requirements

- **Unit:** `src/tests/unit/logui.test.js` (jsdom) — `mkEL` resolves the new
      `EL` entries; `onLogBtn` toggles `is-open` on `#log-panel` and
      `#log-scrim` and flips `#log-btn` `aria-expanded`; `onLogClose` and Escape
      close it. Per R-0001: assert `aria-expanded`/`aria-hidden` toggle between
      `"true"`/`"false"` only because the markup ships `aria-expanded="false"`
      on `#log-btn` and `aria-hidden="true"` on `#log-panel` (these ACs require
      it); do not assert any attribute is added that the baseline HTML does not
      declare.
- **UI:** add to `src/tests/ui/log.test.js` (Playwright) — the log button is
      visible in the top bar beside the account button; clicking it slides the
      panel into view; clicking close, the scrim, and pressing Escape each hide
      it; the button is reachable and operable by keyboard. (The full
      interact-and-record demo arc is TASK-0060.)
- **Integration:** n/a — no external connectivity (presentational shell).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
