---
id: TASK-0086
adr: ADR-0039
evolution: 23
status: done
attempts: 1
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

Files touched:

- `src/index.html` — added `#fs-btn` and `#pip-btn` as real
  `<button type="button">` elements in `.content-head` immediately after
  `#fmt-detail` (alongside the format chip), each with an inline-SVG glyph, an
  `aria-label`, and `aria-pressed="false"` **present in the baseline** (Rule
  R-0001) under an `ADR: ADR-0039` HTML comment. `#fs-btn` carries two glyphs
  (expand / contract) toggled purely by CSS on `aria-pressed`. Also added the
  missing `<script src="/ctrl.js">` tag (TASK-0085 created the module but never
  wired its include) before `ui.js`/`main.js`, so `window.IptvCtrl` exists at
  runtime.
- `src/client/ui.js` — `EL` gains `fsb` (`#fs-btn`) and `pipb` (`#pip-btn`),
  set in `mkEL` with click listeners wired to new `onFsBtn` / `onPipBtn`
  (which delegate to `IptvCtrl.toggleFs` / `togglePip`). New `rndCtrls()`
  feature-detects (`hasFs` / `hasPip`) to hide an unsupported control via the
  `hidden` attribute and syncs each visible button's `aria-pressed` **value
  only** + an `is-on` class from the actual browser state (`isFs` / `isPip`),
  via a small `setCtrl` helper. All three exported from `IptvUi`. Guarded to
  no-op when `IptvCtrl` is absent (test isolation).
- `src/client/main.js` — new `mkCtrls(vid)` in `onReady` (after `mkPlay`):
  calls `IptvCtrl.mkCtrl({ vid, card, rnd: rndCtrls })`, applies the persisted
  `loadVol()` preference to `ST` (`setVol`/`setMuted`) and the `<video>`
  (`video.volume`/`video.muted`), then calls `rndCtrls()` before any connect
  flow.
- `src/client/app.css` — `.ctrl-btn` secondary content-head control styling
  (ADR-0024 spacing tokens, ADR-0019 colour tokens), an accent treatment for
  `[aria-pressed="true"]`, a `[hidden]` state, the fullscreen enter/exit glyph
  swap, and reuse of the one global focus ring. `ADR: ADR-0039` CSS comment.

Non-obvious:

- `rndCtrls` reflects the **actual** browser fullscreen/PiP state (via
  `IptvCtrl.isFs`/`isPip`), never an optimistic flip — `IptvCtrl`'s state-sync
  callback (`mkCtrl`'s `rnd`) is `rndCtrls`, so a browser-initiated exit
  (Escape from fullscreen, closing the PiP window) un-presses the button.
- The content-head cluster orders its right-side controls via CSS `order`
  (theme=2, log=1, acct=3); `#fs-btn`/`#pip-btn` have the default `order: 0`,
  so they sit right after the format chip and before the theme/log/acct
  cluster — exactly "alongside the format chip".
- Keyboard shortcuts (`onPlayKey`) are TASK-0087, not part of this task.
- UI state transitions are exercised in the Playwright test by overriding the
  `IptvCtrl` predicates and re-running `rndCtrls` (the same render path the
  browser state-change events drive), because headless Chromium cannot reliably
  enter native fullscreen/PiP without a user gesture.

ADR-0039 `governs:` already listed every file created here (seeded by
spec-agent); no true-up needed.
