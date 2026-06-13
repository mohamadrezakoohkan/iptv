---
id: ADR-0028
title: Surface the playback failure log via a top-bar button beside the account button
date: 2026-06-13
evolution: 17
status: accepted
governs:
  - src/index.html
  - src/client/app.css
  - src/client/ui.js
  - src/tests/unit/logui.test.js
  - src/tests/ui/log.test.js
---

# ADR-0028 — Surface the playback failure log via a top-bar button beside the account button

## Context

E17 prompt: *"logs must be a button besides account buton"* — the recorded
failures (ADR-0027 decides the capture model and the `window.IptvErrLog` store)
must be revealed from a button rendered **beside the existing account button**.

The account button (`#acct-btn`, ADR-0014) already sits at the right end of
`.content-head`, pushed right with `margin-left:auto`, with the sun/moon theme
toggle (ADR-0019) immediately before it. Clicking `#acct-btn` (`onAcctBtn` in
`client/ui.js`) toggles a right slide-in `#acct-panel` aside with an
`#acct-scrim` backdrop, opened/closed by a single `is-open` class plus
`aria-expanded`/`aria-hidden` (`setAcct(open)`), closable by its close button,
the scrim, and Escape. That account-button + slide-in-panel affordance is the
exact pattern the prompt asks the log control to mirror.

ADR-0027 decides **what** is logged and the read API (`IptvErrLog.list()`,
`count()`, `clear()`). This ADR decides only the **UI surface**: the button
beside the account button and the panel that renders the log.

CONVENTIONS apply: all DOM writes via `rnd*`/`set*` in `ui.js`, no inline
styles (visual state via CSS class toggling, §10), handlers `on*`, the `EL`
registry declared once and resolved in `mkEL`, kebab-case ids, no new
state-machine phase (§6).

## Decision

### Log button (in `.content-head`, beside the account button)

A new `#log-btn` button mounts in `.content-head` **immediately before
`#acct-btn`**, so the two controls sit together at the right edge — the log
button first, the account button last (the account button keeps
`margin-left:auto`, which pushes the pair to the right). It is
keyboard-focusable, carries a list/log glyph and an accessible label ("Log"),
and has `aria-haspopup="dialog"`, `aria-controls="log-panel"`, and
`aria-expanded` reflecting panel state. A small **count badge** child
(`#log-count`) shows the number of recorded failures and is hidden (a CSS
class, not inline style) when the count is zero. The badge's number is part of
the button's accessible name (not colour-only). Clicking the button toggles the
panel.

### Log panel (slide-in, parallel to the account panel)

A new `#log-panel` aside is added inside `.app`, structurally parallel to
`#acct-panel`: fixed to a screen edge, full height, ~320px wide, `--sur`
background, an inner-edge border `--ln`, `z-index` above content,
**off-screen by default** via `transform: translateX`, sliding in solely by an
`is-open` class (CSS transition, no inline styles). A dimmed `#log-scrim`
overlay sits behind it. The panel is `role="dialog"`,
`aria-label="Playback failure log"`, `aria-hidden` toggled with `is-open`. The
scrim click, an in-panel close button (`#log-close`), and Escape all close it.

Panel contents (top to bottom):

1. **Header row** — "Playback log" title, a `#log-clear` button that empties
   the log (`IptvErrLog.clear()` then re-render), and a `#log-close` button.
2. **Entry list** (`#log-list`) — one row per entry, **newest-first**
   (`IptvErrLog.list()`): channel name (+ number when present) as the primary
   line, the failure detail string as a dimmed secondary line, and the failure
   time. Names/urls truncate. All row text is HTML-escaped.
3. **Empty state** — when `IptvErrLog.count() === 0`, the list shows a single
   calm placeholder ("No playback failures this session.") instead of rows.

### Rendering & handlers (`ui.js`)

- `EL` gains `lbtn` (`#log-btn`), `lcnt` (`#log-count`), `lpnl`
  (`#log-panel`), `lscr` (`#log-scrim`), `lcls` (`#log-close`),
  `lclr` (`#log-clear`), `llst` (`#log-list`) — declared once, resolved in
  `mkEL`.
- `rndLog()` — renders the button's count badge (visible/hidden + number) and
  the panel's entry rows / empty state from `window.IptvErrLog`. Guarded so it
  no-ops when `IptvErrLog` is absent (test isolation), mirroring the existing
  guarded global reads. Called after every capture (the new `onEngErr` hook
  re-renders the log) and after `clear()`.
- `setLog(open)` — the single presentational toggle (no ST phase, no boolean
  flag): toggles `is-open` on `#log-panel` + `#log-scrim`, sets the button's
  `aria-expanded`, and the panel's `aria-hidden` — exactly mirroring
  `setAcct(open)`.
- `onLogBtn()` toggles the panel from its current `is-open`; `onLogClose()`
  closes it; `onLogClear()` empties the log and re-renders; Escape closes it
  via the existing document keydown handler (extended to also close the log
  panel when open). All wired in `mkEL` alongside the account-panel listeners.
- New handlers exported on `window.IptvUi` so `play.js`'s capture hook and the
  tests can drive re-rendering.

The capture hook in `play.js` (ADR-0027) calls `window.IptvUi.rndLog()` after
recording a failure, guarded like its existing `rndPhase` call, so the button
badge and any open panel reflect the new entry immediately.

### Responsive

On the mobile breakpoint (`< 760px`) the log panel becomes full-width
(`width: 100%`), like the account panel; the log button stays in
`.content-head`.

## Consequences

**Easier:**
- The log reuses an already-proven, accessible button + slide-in-panel pattern
  (ADR-0014), so the control is immediately familiar and the implementation
  parallels existing `setAcct`/`rndAcct` code.
- Panel visibility is one CSS class; no new ST phase, no boolean-flag control
  flow (CONVENTIONS §6 respected).

**Harder:**
- A second slide-in aside + scrim + transitions add CSS; the shared document
  Escape handler must close whichever panel is open without coupling the two.
- `rndLog` must stay in sync with the capture hook so the badge count and panel
  never lag behind `IptvErrLog`.

**Ruled out:**
- Putting the log control in the footer or sidebar (prompt says beside the
  account button, which lives in the top bar).
- A new state-machine phase for the panel (it is presentational; phases stay
  INIT/LOAD/READY/PLAY/SRCH/ERR — CONVENTIONS §6).
- Forcing the account panel closed when the log panel opens (each is an
  independent presentational toggle, matching today's account-panel behavior).

## Tasks derived

- TASK-0058 — Log button (beside `#acct-btn`) + slide-in log panel markup, CSS, open/close
- TASK-0059 — Render the log panel + button badge from `IptvErrLog`; clear action; wire capture re-render
- TASK-0060 — UI test + demo recording of the failure-log button/panel

## Traceability

Every file in `governs:` carries an `ADR: ADR-0028` comment near the top
(native comment syntax; `index.html` via HTML comment). When a change removes
the last governed code, this ADR is marked `status: deleted` — the file itself
is never removed; it is history.
