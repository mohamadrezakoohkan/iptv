---
id: TASK-0085
adr: ADR-0039
evolution: 23
status: done
attempts: 1
depends_on: [TASK-0084]
---

# TASK-0085 — Control module (`src/client/ctrl.js`): feature detection + toggles + media actions + state sync

## Goal

When this task is done, a new self-contained module `src/client/ctrl.js`
(`window.IptvCtrl`) exposes the client-only control primitives that act on the
resolved shared `<video>` and the `#player-card` region: feature-detection
predicates, fullscreen/PiP toggles, media actions (play/pause, mute,
volume up/down), and state-sync subscriptions. It introduces no server route, no
engine, no state-machine phase. (Markup, wiring, and the keyboard handler are
later tasks; this is the pure-where-possible engine layer.)

## Acceptance criteria

- [ ] `src/client/ctrl.js` exists, is a `'use strict'` IIFE exposing
      `window.IptvCtrl`, carries the `ADR: ADR-0039` comment, and uses unique
      top-level binding names (no shared-`window`-scope collision).
- [ ] `IptvCtrl.hasFs()` returns true only when the Fullscreen API is available
      (`requestFullscreen` / `webkitRequestFullscreen` present and
      `document.fullscreenEnabled !== false`); false otherwise.
- [ ] `IptvCtrl.hasPip()` returns true only when PiP is available
      (`document.pictureInPictureEnabled === true` AND
      `HTMLVideoElement.prototype.requestPictureInPicture` present); false
      otherwise (e.g. iOS Safari).
- [ ] `IptvCtrl.toggleFs()` requests/exits fullscreen on the player element
      (prefixed fallbacks), swallowing a rejected promise; no-op when `hasFs()`
      is false.
- [ ] `IptvCtrl.togglePip()` requests/exits PiP on the `<video>` (`document`
      exit), swallowing a rejected promise; no-op when `hasPip()` is false.
- [ ] `IptvCtrl.togglePlay()` plays when paused / pauses when playing on the
      `<video>` (play rejection swallowed).
- [ ] `IptvCtrl.toggleMute()` flips `video.muted`, calls `IptvSt.setMuted`
      (persisting via ADR-0040).
- [ ] `IptvCtrl.volUp()` / `IptvCtrl.volDn()` step volume by `S.volStp`, clamp
      to `[0,1]`, apply to `video.volume`, and call `IptvSt.setVol` (persisting).
- [ ] An init entry (e.g. `IptvCtrl.mkCtrl(videoEl, cardEl)`) stores the element
      references and subscribes to `fullscreenchange` (+ `webkit` prefix) and the
      `<video>`'s `enterpictureinpicture` / `leavepictureinpicture` events,
      invoking a render callback so button state can follow the actual browser
      state.
- [ ] All native APIs are reached via `window` / `document` / the element so they
      are mockable in unit tests; nothing throws when an API is absent.

## Test requirements

- **Unit:** `src/tests/unit/ctrl.test.js` — mock Fullscreen and PiP on
  `document` / a fake `<video>` / `HTMLVideoElement.prototype`. Cover: `hasFs` /
  `hasPip` true and false branches (incl. iOS-Safari-like no-PiP); `toggleFs` /
  `togglePip` call the right request/exit based on current state and swallow
  rejected promises; `togglePlay` toggles paused/playing; `toggleMute` flips and
  calls `setMuted`; `volUp` / `volDn` step by `S.volStp` and clamp at 0 and 1 and
  call `setVol`; the state-sync subscription invokes its callback on a simulated
  `fullscreenchange` / `enterpictureinpicture` / `leavepictureinpicture` event.
- **UI:** n/a — exercised through the chrome in TASK-0086/0087 (this module has
  no DOM surface of its own).
- **Integration:** n/a — no external connectivity (all client-side native APIs).

## Implementation notes

Files touched:

- `src/client/ctrl.js` — NEW. `'use strict'` IIFE-style non-module client
  script exposing `window.IptvCtrl`, carrying the `ADR: ADR-0039` comment.
  Module-level refs use unique `_ctrl*` binding names to avoid the recurring
  shared-`window`-scope "Identifier already declared" collision. Public API:
  `mkCtrl(opts)`, `hasFs`, `hasPip`, `isFs`, `isPip`, `toggleFs`, `togglePip`,
  `togglePlay`, `toggleMute`, `volUp`, `volDn`.
- `src/tests/unit/ctrl.test.js` — NEW. 36 unit tests; loads cfg.js + st.js +
  ctrl.js into a fabricated window with a mocked `document` (Fullscreen / PiP
  surfaces), a fake `<video>`, and an `HTMLVideoElement.prototype` that can omit
  `requestPictureInPicture` (iOS-Safari-like no-PiP shape).

Non-obvious notes for reviewers / later tasks:

- `mkCtrl` takes a single `opts` object `{ vid, card, rnd }` (CONVENTIONS §FN-3:
  max 2 params, 3+ merged into one opts object) rather than the positional
  `mkCtrl(videoEl, cardEl)` sketched in the task header — the third argument is
  the render callback the state-sync subscription invokes.
- `hasFs()` requires the `card` reference (set by `mkCtrl`); it returns `false`
  before init and is reached via the element / `document` so it is mockable.
- All native APIs (`requestFullscreen`/`webkitRequestFullscreen`,
  `exitFullscreen`/`webkitExitFullscreen`, `requestPictureInPicture`,
  `exitPictureInPicture`, `play`) are accessed through `window` / `document` /
  the element, and every rejected request/exit promise is swallowed via the
  shared `swallow()` helper — nothing throws when an API is absent.
- Volume/mute changes call `IptvSt.setVol` / `IptvSt.setMuted` (TASK-0084), so
  they persist to `iptv_vol` (ADR-0040); volume steps `S.volStp` and clamps to
  `[0,1]`.
- State sync reflects the ACTUAL browser fullscreen/PiP state via
  `fullscreenchange` (+ webkit) and the `<video>`'s `enterpictureinpicture` /
  `leavepictureinpicture` events, invoking the render callback — never an
  optimistic toggle.
- This module has no DOM surface of its own: markup/wiring is TASK-0086 and the
  `onPlayKey` keyboard handler is TASK-0087. The ADR `governs:` already listed
  both new files; both now exist with the `ADR: ADR-0039` comment, so
  traceability is true with no ADR edit required.

Full unit suite: 981 passed (42 files), including the 36 new `ctrl.test.js`
tests. No UI/integration tests for this task (no DOM surface; no external
connectivity).
