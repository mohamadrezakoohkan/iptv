---
id: ADR-0039
title: Client-only in-player controls layer (Fullscreen + PiP toggles + keyboard shortcuts) over the shared <video>
date: 2026-06-15
evolution: 23
status: accepted
governs:
  - src/index.html
  - src/client/ctrl.js
  - src/client/ui.js
  - src/client/main.js
  - src/client/app.css
  - src/tests/unit/ctrl.test.js
  - src/tests/ui/ctrl.test.js
  - src/tests/ui/ctrl-demo.test.js
---

# ADR-0039 — Client-only in-player controls layer over the shared `<video>`

## Context

E23 prompt (the E22 RESEARCH winner): add an in-player controls layer over the
existing dual-engine `<video>` player — a **Fullscreen** toggle (native
Fullscreen API), a **Picture-in-Picture** toggle (native
`HTMLVideoElement.requestPictureInPicture`, feature-detected and hidden where
unsupported, e.g. iOS Safari), and **keyboard shortcuts** active only while a
stream is playing (F = fullscreen, P = PiP, Space/K = play-pause, M = mute,
ArrowUp/ArrowDown = volume) — surfaced as accessible, keyboard-focusable
controls on the player chrome alongside the existing format chip. The controls
drive the already-resolved `<video>` element directly and apply uniformly to
live, catch-up, and VOD (one shared player). Hard constraints: **no** new server
route, **no** new playback engine, **no** new state-machine phase, **no** new
playback localStorage key (one client-wide volume/mute preference may persist —
see ADR-0040). Degrade silently where Fullscreen / PiP is unavailable; demo
mode (which already plays a stream) must demonstrate the controls offline.

Reality at the E22 tip:

- The shared player is `#player-video` inside `#player-card`
  (`src/index.html`), with native `controls playsinline`. `src/client/play.js`
  owns the engines (hls.js / mpegts.js / server remux) and exposes the
  `<video>` reference via `mkPlay`; live, catch-up (ADR-0036) and VOD
  (ADR-0038) all route through the one `loadPlay` path on this single element.
- The content-head cluster already hosts secondary controls — the contextual
  format chip `#fmt-chip` (ADR-0025), the theme toggle `#theme-toggle`
  (ADR-0019), the log button, and the account button — each a focusable
  `<button>` reading the ADR-0024 spacing tokens and ADR-0019 colour tokens.
- `src/client/ui.js` owns the `EL` element registry (fully declared, never
  extended — CONVENTIONS §10), the `rnd*`/`on*` render/handler convention, and a
  single document `keydown` handler `onAcctKey` that closes whichever slide-in
  panel is open on **Escape** (ADR-0014/ADR-0028).
- `src/client/st.js` already declares `ST.vol` (1.0) and `ST.muted` (false) and
  the `setVol`/`setMuted` writers, and `src/client/cfg.js` already declares
  `S.volStp` (0.1 step) and `S.skpSec` — scaffolding that is **not yet wired**
  to any control, video element, or persistence. This decision wires them.
- The state machine (`src/client/st.js`, §11 of the player spec) is fixed:
  INIT/LOAD/READY/PLAY/SRCH/ERR. `PLAY` is exactly "channel selected and
  streaming".

Constraints bounding this decision: CONVENTIONS.md (vanilla JS, flat state,
`rnd*`/`on*`, single `EL` registry, shared non-module `window` scope — the
recurring "Identifier already declared" load collision means any new top-level
binding needs a unique name), ADR-0001 (no framework), ADR-0024 (spacing tokens),
ADR-0019 (colour tokens). No accepted ADR is contradicted: ADR-0025 keeps owning
the format chip; this decision adds **sibling** controls, not a replacement.

## Decision

Add a **client-only** in-player controls layer as a new module
`src/client/ctrl.js` plus markup in `src/index.html`, wiring in
`src/client/ui.js`, init in `src/client/main.js`, and styling in
`src/client/app.css`. It introduces **no** server route, **no** engine, **no**
state-machine phase.

### Module — `src/client/ctrl.js` (`window.IptvCtrl`)

A self-contained IIFE exposing pure-where-possible control primitives that act
on the resolved `<video>` (obtained the same way `play.js` does, or handed the
element at init):

- **Feature detection** (pure predicates): `hasFs()` — Fullscreen API present
  (`requestFullscreen`/`webkitRequestFullscreen` + `document.fullscreenEnabled`);
  `hasPip()` — PiP present (`document.pictureInPictureEnabled === true` **and**
  `HTMLVideoElement.prototype.requestPictureInPicture`). These drive the
  silent-degrade hide of each control.
- **Toggles**: `toggleFs()` (request/exit fullscreen on `#player-card`,
  prefixed fallbacks, rejection swallowed) and `togglePip()` (request/exit PiP
  on the `<video>`, rejection swallowed; no-op when `hasPip()` is false).
- **Media actions** on the `<video>`: `togglePlay()`, `toggleMute()`,
  `volUp()` / `volDn()` stepping `ST.vol` by `S.volStp` clamped to `[0,1]` and
  applying to `video.volume`; mute/volume changes call `IptvSt.setVol` /
  `IptvSt.setMuted` so they persist (ADR-0040).
- **State sync**: subscribes to `fullscreenchange` (+ prefixed) and the
  `<video>`'s `enterpictureinpicture` / `leavepictureinpicture` events so the
  buttons' `aria-pressed` and visual state follow the **actual** browser state
  (e.g. an Escape-driven fullscreen exit), never an optimistic guess.

All native APIs are accessed through `window`/`document`/the element so unit
tests can **mock** Fullscreen/PiP (per the design guidance and R-0001 baseline
discipline). Any new top-level binding carries a unique name (shared-scope rule).

### Markup (`src/index.html`)

Add, in the content-head cluster **alongside the format chip**, two real
buttons:
`<button type="button" id="fs-btn" aria-pressed="false" …>` and
`<button type="button" id="pip-btn" aria-pressed="false" …>`, each with an
inline-SVG glyph and an accessible label, carrying the `ADR: ADR-0039` HTML
comment. `aria-pressed` is **present in the baseline** (`"false"`) so render
code only mutates the value (Rule R-0001). A control hidden by feature detection
gets the `hidden` attribute (removed from tab order).

### Wiring (`src/client/ui.js`)

- `EL` gains `fsb` (`#fs-btn`) and `pipb` (`#pip-btn`), declared once in the
  `EL` literal and set in `mkEL`.
- `rndCtrls()` applies feature detection (hide unsupported buttons) and syncs
  each button's `aria-pressed` + visual state from the current fullscreen / PiP
  state; it is invoked at init and from the `IptvCtrl` state-sync callbacks.
- `onFsBtn` / `onPipBtn` click handlers call `IptvCtrl.toggleFs` /
  `IptvCtrl.togglePip`, registered through the same `mkEL` wiring as the other
  content-head controls.
- A **new document `keydown` handler** `onPlayKey` implements the shortcuts. It
  returns immediately unless `IptvSt.ST.phase === 'PLAY'` (active only while
  playing) and the event target is **not** a typing context (input / textarea /
  contenteditable). It maps F→`toggleFs`, P→`togglePip`, Space/K→`togglePlay`,
  M→`toggleMute`, ArrowUp→`volUp`, ArrowDown→`volDn`, and `preventDefault`s only
  the keys it actually consumes. It **never** handles `Escape` — that stays with
  `onAcctKey` (ADR-0014/0028). It is a separate handler from `onAcctKey` so the
  two concerns do not collide.

### Init (`src/client/main.js`)

In `onReady`, after `mkEL` and after the player video reference is established,
initialise `IptvCtrl` with the `<video>` / `#player-card`, apply the persisted
volume/mute preference (ADR-0040) to the `<video>` and controls, and call
`rndCtrls()` so the chrome reflects feature support and current state before any
connect flow.

### Styling (`src/client/app.css`)

`#fs-btn` / `#pip-btn` styled as secondary content-head controls — sized via the
ADR-0024 tokens, coloured via the ADR-0019 tokens, an accent / pressed treatment
for the active (`aria-pressed="true"`) state consistent with the format chip and
theme toggle, a `hidden` state, and a focus ring matching the other content-head
controls. Carries the `ADR: ADR-0039` CSS comment.

## Consequences

**Easier:**
- One shared `<video>` means the controls cover live, catch-up, and VOD with no
  per-kind branching.
- Native APIs + feature detection = the controls just disappear where the
  browser cannot support them (iOS Safari PiP), no error path.
- Reusing `ST.vol`/`ST.muted`/`setVol`/`setMuted`/`S.volStp` (already present)
  keeps the change small and avoids a new phase.

**Harder:**
- The keyboard layer must coexist with the existing Escape handler and with
  typing in inputs — a deliberate "active only in PLAY, never in a typing
  target, never Escape" contract, covered by UI tests for collisions.
- Button state must follow the **actual** browser fullscreen/PiP state via
  change events, not optimistic toggling (an Escape exit from fullscreen must
  un-press the button).
- `aria-pressed` discipline (present in baseline, only mutate the value — R-0001).

**Ruled out:**
- A new server route, a new playback engine, a new state-machine phase, a new
  playback localStorage key beyond the single volume/mute preference (ADR-0040)
  — all forbidden by the prompt.
- Replacing or moving the native `<video controls>` UI (the layer is additive).
- A custom seek/scrubber or other controls the prompt did not ask for (smallest
  coherent set).

## Tasks derived

- TASK-0085 — `src/client/ctrl.js`: feature detection + toggle/media primitives
  + state-sync subscriptions (unit; mock Fullscreen/PiP).
- TASK-0086 — Controls chrome: `#fs-btn`/`#pip-btn` markup (aria-pressed in
  baseline), `EL.fsb`/`EL.pipb`, `rndCtrls`, click handlers + wiring, init in
  main.js, CSS (unit + UI: feature-detect hide, click toggles, state sync).
- TASK-0087 — Keyboard shortcuts: `onPlayKey` document handler, active only in
  PLAY, non-typing target, no Escape collision (unit + UI).
- TASK-0088 — Demo recording: boot → demo mode play → exercise fullscreen /
  PiP / keyboard controls offline → revert runtime state → stop (UI).

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0039` comment near the top
(native comment syntax; `index.html` via HTML comment, CSS via CSS comment).
When a change removes the last governed code, this ADR is marked
`status: deleted` — the file itself is never removed; it is history.
