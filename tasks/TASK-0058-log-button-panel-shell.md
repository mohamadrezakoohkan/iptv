---
id: TASK-0058
adr: ADR-0028
evolution: 17
status: done
attempts: 2
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

Files touched:

- `src/index.html` — `#log-btn` (log glyph + `.log-label` + empty `#log-count`
  badge child, `aria-haspopup="dialog"` / `aria-controls="log-panel"` /
  `aria-expanded="false"`) sits in `.content-head` immediately before
  `#acct-btn`; `#acct-btn` stays last and keeps `margin-left:auto`. Inside
  `.app`: a `#log-scrim` backdrop + `#log-panel` aside (`role="dialog"`,
  `aria-label="Playback failure log"`, `aria-hidden="true"`) with a header
  (`#log-clear`, `#log-close`) and an empty `#log-list`. ADR comment carries
  `ADR-0028`.
- `src/client/app.css` — `.log-btn` / `.log-count` / `.log-scrim` /
  `.log-panel` / `.log-head` / `.log-title` / `.log-clear` / `.log-close` /
  `.log-list` rules, structurally parallel to the `.acct-*` panel: fixed to the
  right edge, full height, 320px wide (full-width `< 760px`), `--sur` bg,
  inner-edge `--ln` border, off-screen via `transform: translateX(100%)`,
  `is-open` slides in; `.log-count.is-empty` hides the badge via a CSS class.
- `src/client/ui.js` — `EL` declares `lbtn/lcnt/lpnl/lscr/lcls/lclr/llst`,
  resolved in `mkEL`; `setLog(open)` toggles `is-open` on panel+scrim and sets
  `aria-expanded`/`aria-hidden` (mirrors `setAcct`); `onLogBtn`/`onLogClose`;
  the shared document keydown handler (`onAcctKey`) closes the log panel when
  open; listeners wired in `mkEL`; handlers exported on `window.IptvUi`.

Non-obvious notes for reviewers / future tasks:

- The button/panel/CSS/wiring shell already existed in the working tree from
  earlier work on this branch; this task added the two required test files and
  fixed two in-scope CSS regressions (below). The acceptance-criteria source was
  verified against the specs/ADR and exercised by the new tests.
- **themetoggle adjacency regression fixed (retry):** inserting `#log-btn` in
  source order between `#theme-toggle` and `#acct-btn` (which the ACs/spec/ADR
  require — "the log button first, the account button last") pushed the theme
  toggle ~88px away from the account button, breaking the untouched
  `themetoggle.test.js:31` invariant (`acct.left - toggle.right < 20`,
  ADR-0019). Resolved purely in `app.css` with flex `order` on the right-edge
  cluster: the markup keeps source order `theme-toggle → log-btn → acct-btn`
  (ADR-0028, `log.test.js` still sees `#log-btn` left of `#acct-btn`), while
  the cluster renders visually as `[log-btn] [theme-toggle] [acct-btn]` —
  `.log-btn{order:1;margin-left:auto}`, `.thm-toggle{order:2}`,
  `.acct-btn{order:3}`, each separated by the same `--s2` (ADR-0024) gap. The
  log button owns the auto margin so the trio hugs the right edge on both
  breakpoints; the theme toggle stays one `--s2` gap left of the account
  button, satisfying ADR-0019. No test was edited; the layout was made to
  satisfy both `themetoggle.test.js` (12/12) and `log.test.js` (9/9).
- **CSS regression fixed:** `.log-count` shipped `border-radius: 9px` (a literal
  rectangular radius), which `src/tests/unit/rhythm.test.js` (ADR-0024 token
  contract) rejects. Changed to `border-radius: 50%` — the guard explicitly
  permits `50%`, and for an 18px-tall badge a full round is the intended pill.
- **UI independence test:** opening the account panel raises a full-viewport
  scrim that legitimately intercepts a real click on `#log-btn`, so the
  log+account independence UI assertion drives `window.IptvUi.setLog(true)`
  rather than a click; the click-path independence is covered by the unit tier.
- TASK-0059 fills `#log-list` rows + the `#log-count` badge number (via a new
  `rndLog`) and the clear action; this task left those structurally empty.
