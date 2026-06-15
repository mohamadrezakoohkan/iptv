---
id: TASK-0086
adr: ADR-0039
evolution: 23
status: pending
attempts: 0
depends_on: [TASK-0085]
---

# TASK-0086 — Controls chrome: Fullscreen + PiP buttons, render, feature-detect hide, wiring, init, CSS

## Goal

When this task is done, the player chrome shows accessible, keyboard-focusable
**Fullscreen** (`#fs-btn`) and **Picture-in-Picture** (`#pip-btn`) buttons in the
content-head cluster alongside the format chip. Clicking each toggles the
corresponding `IptvCtrl` action; each button's `aria-pressed` and visual state
follow the actual fullscreen/PiP state via `IptvCtrl`'s state-sync callback; an
unsupported control is hidden (removed from tab order). The persisted volume/mute
preference is applied to the `<video>` at load.

## Acceptance criteria

- [ ] `src/index.html` adds `#fs-btn` and `#pip-btn` as real
      `<button type="button">` elements in the content-head cluster alongside
      `#fmt-chip`, each with an inline-SVG glyph, an accessible label, and
      `aria-pressed="false"` **present in the baseline** (Rule R-0001), carrying
      an `ADR: ADR-0039` HTML comment.
- [ ] `EL` in `src/client/ui.js` gains `fsb` (`#fs-btn`) and `pipb` (`#pip-btn`),
      declared once in the `EL` literal and set in `mkEL`.
- [ ] `rndCtrls()` hides (`hidden` attribute) `#pip-btn` when `IptvCtrl.hasPip()`
      is false and `#fs-btn` when `IptvCtrl.hasFs()` is false, and syncs each
      visible button's `aria-pressed` (value only — never adds the attribute) and
      visual state from the current fullscreen / PiP state.
- [ ] Clicking `#fs-btn` calls `IptvCtrl.toggleFs`; clicking `#pip-btn` calls
      `IptvCtrl.togglePip`; handlers registered in `mkEL` alongside the other
      content-head controls.
- [ ] `IptvCtrl`'s state-sync callback (fullscreenchange / PiP enter/leave) drives
      `rndCtrls()` so the buttons un-press on a browser-initiated exit (e.g.
      Escape from fullscreen).
- [ ] `src/client/main.js` `onReady` initialises `IptvCtrl` with the `<video>` /
      `#player-card`, applies the persisted volume/mute preference
      (`IptvSt.loadVol()`) to `ST` and the `<video>` (`video.volume`,
      `video.muted`), and calls `rndCtrls()` before any connect flow.
- [ ] `src/client/app.css` styles `#fs-btn` / `#pip-btn` as secondary
      content-head controls using ADR-0024 spacing tokens and ADR-0019 colour
      tokens, with an accent treatment for `aria-pressed="true"`, a `hidden`
      state, and a focus ring matching the other controls; carries an
      `ADR: ADR-0039` CSS comment.

## Test requirements

- **Unit:** `src/tests/unit/ctrl.test.js` (extend) — `rndCtrls` hides the PiP
  button when `hasPip()` is false and the FS button when `hasFs()` is false,
  shows them when supported, and mutates `aria-pressed` value (never adds the
  attribute; assert it is present in the baseline first, R-0001). Click handlers
  call the right `IptvCtrl` toggle. Mock `IptvCtrl`/native APIs.
- **UI:** `src/tests/ui/ctrl.test.js` — in demo playback (or with PiP/FS mocked),
  the buttons render, are keyboard-focusable, toggle on click, their
  `aria-pressed` reflects state, and an unsupported control does not appear /
  is not tab-reachable. At least one committed screenshot of the controls on the
  player chrome.
- **Integration:** n/a — no external connectivity.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
