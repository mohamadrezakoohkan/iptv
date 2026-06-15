---
status: current
---

# In-player controls layer (Fullscreen, Picture-in-Picture, keyboard shortcuts)

A thin **client-only** control layer over the existing dual-engine `<video>`
player (`#player-video`, `docs/specs/iptv-player.md` §5b, §10). It adds a
Fullscreen toggle, a Picture-in-Picture (PiP) toggle, and keyboard shortcuts
that drive the already-resolved `<video>` element directly. It reuses the one
shared player for **live, catch-up, and VOD** playback alike — they share a
single `<video>` element and a single play path, so the controls apply
uniformly.

It adds **no** new server route, **no** new playback engine, **no** new
state-machine phase (§11 of the player spec is unchanged), and **no** new
playback localStorage key beyond a single client-wide volume/mute preference
(below), mirroring the `iptv_theme` / `iptv_sort` chrome-persistence pattern
(ADR-0019, ADR-0017).

The native browser `<video controls>` UI keeps working as-is; this layer is
**additive** chrome plus keyboard ergonomics on top of it.

---

## 1. Surface

The controls are accessible, keyboard-focusable buttons rendered on the player
chrome **alongside the existing contextual format chip** (ADR-0025) in the
content-head cluster region. They are secondary controls and read the
ADR-0024 spacing/sizing tokens and ADR-0019 colour tokens, consistent with the
format chip and theme toggle.

| Control          | Element id         | Action                                    |
|------------------|--------------------|-------------------------------------------|
| Fullscreen toggle| `#fs-btn`          | toggle native Fullscreen on the player    |
| PiP toggle       | `#pip-btn`         | toggle native Picture-in-Picture on `<video>` |

- Both are real `<button type="button">` elements with an accessible label and
  `aria-pressed` reflecting the current on/off state. Per Rule R-0001,
  `aria-pressed` is **present in the baseline HTML** (`aria-pressed="false"`),
  so render code only mutates its value, never adds the attribute.
- Both are **focusable** and operable by mouse, keyboard (Enter/Space on the
  button), and the keyboard shortcuts below.

### 1a. Feature detection — degrade silently

- The **PiP** toggle is **hidden** (not rendered / `hidden` attribute set) on
  browsers that lack PiP — detected via
  `document.pictureInPictureEnabled !== true` **or** the absence of
  `HTMLVideoElement.prototype.requestPictureInPicture` (e.g. iOS Safari). No
  error, no console noise — it simply does not appear.
- The **Fullscreen** toggle is hidden where the Fullscreen API is unavailable —
  detected via the absence of a `requestFullscreen` (or vendor-prefixed
  `webkitRequestFullscreen`) method on the player element / document, and
  `document.fullscreenEnabled === false`. Where unavailable it does not appear.
- Detection runs once at render time; an unsupported control leaves the rest of
  the chrome (format chip, theme toggle) untouched and correctly laid out.

---

## 2. Behaviors

### 2a. Fullscreen toggle

- Toggles native fullscreen of the **player element** (the `#player-card`
  region containing the `<video>`, so overlays remain visible), using
  `requestFullscreen()` / `document.exitFullscreen()` with the
  `webkit`-prefixed fallbacks where present.
- `aria-pressed` and the button's visual state follow the actual fullscreen
  state, kept in sync via the `fullscreenchange` (and prefixed) event — so an
  Escape-driven browser exit from fullscreen also updates the button.
- A `requestFullscreen()` rejection (user gesture missing, blocked) is swallowed
  silently; the button state reflects reality from the change event, never an
  optimistic assumption.

### 2b. Picture-in-Picture toggle

- Toggles native PiP on the `<video>` via
  `video.requestPictureInPicture()` / `document.exitPictureInPicture()`.
- `aria-pressed` and visual state follow the actual PiP state, kept in sync via
  the `<video>`'s `enterpictureinpicture` / `leavepictureinpicture` events.
- A rejected `requestPictureInPicture()` (no active video, blocked, unsupported
  codec) is swallowed silently; state reflects reality from the events.

### 2c. Keyboard shortcuts

A single document-level `keydown` handler, **active only while a stream is
playing** (the state machine is in `PLAY` — `IptvSt.ST.phase === 'PLAY'`), maps
keys to actions on the resolved `<video>`:

| Key              | Action                                              |
|------------------|-----------------------------------------------------|
| `F`              | toggle fullscreen (same as `#fs-btn`)               |
| `P`              | toggle PiP (same as `#pip-btn`; no-op where PiP unsupported) |
| `Space` / `K`    | play / pause the `<video>`                          |
| `M`              | toggle mute                                         |
| `ArrowUp`        | volume up by `S.volStp` (0.1), clamped to `[0, 1]`  |
| `ArrowDown`      | volume down by `S.volStp` (0.1), clamped to `[0, 1]`|

- **Active only while playing.** When not in `PLAY` (idle, connecting, error,
  logged-out, browsing the grid without a stream) the shortcut handler does
  nothing and lets the keystroke pass through.
- **No collisions.** The handler does **not** intercept keys when the event
  target is a text input, textarea, or other editable/typing context (so search
  typing is never hijacked), and it leaves `Escape` entirely to the existing
  panel-close handler (`onAcctKey`, ADR-0014/ADR-0028) — `Escape` is **not** a
  player shortcut. `Space`/`ArrowUp`/`ArrowDown` are `preventDefault`-ed only
  when the handler actually consumes them (in `PLAY`, non-typing target), so
  page scroll / button activation elsewhere is unaffected.
- `P` and `F` reuse the same toggle functions the buttons call. `P` is a silent
  no-op where PiP is unsupported (the button is hidden anyway).
- Volume and mute changes drive `video.volume` / `video.muted` directly and
  persist the client-wide preference (§3).

### 2d. Uniform across playback kinds

The controls and shortcuts operate on the single shared `<video>` element and
therefore apply identically to **live**, **catch-up / archive** (ADR-0036), and
**VOD** (ADR-0038) playback. No per-kind branching.

---

## 3. Persistence — single client-wide volume/mute preference

A single client-wide volume/mute preference persists across sessions, mirroring
the theme/sort chrome pattern (ADR-0019, ADR-0017):

| Key        | Type   | Contents                                                |
|------------|--------|---------------------------------------------------------|
| `iptv_vol` | JSON   | `{ vol: <0..1 number>, muted: <boolean> }`              |

- It is **client-wide**, not per-account and not per-channel — one preference
  for the whole app, like theme and sort.
- Declared as `S.volKey` in `src/client/cfg.js` (matching the `iptv_*` /
  `S.*Key` naming, ADR-0003). `src/client/st.js` owns the read/write
  (`loadVol()` / `saveVol()`), alongside the existing `loadTheme`/`saveTheme`.
- It is **not** added to the phase machine. The existing `ST.vol` / `ST.muted`
  fields and `IptvSt.setVol` / `IptvSt.setMuted` writers hold the live values;
  the writers persist via `saveVol()` (mirroring how sort persists on write).
- On load (`onReady`, `src/client/main.js`), the stored preference is read and
  applied to the `<video>` (`video.volume`, `video.muted`) and to the controls'
  visual/ARIA state, before/independent of any connect flow. A missing,
  malformed, or out-of-range value falls back to the defaults (`vol: 1.0`,
  `muted: false`, already the `ST` defaults).

---

## 4. Demo mode

Demo mode already plays a stream offline (`docs/specs/iptv-player.md` §8). The
controls must work there: in demo playback the user can toggle fullscreen,
toggle PiP (where the browser supports it), and use every keyboard shortcut on
the demo stream — all client-side, no network. This is the surface the run's
demo recording exercises.

---

## 5. Accessibility

- Fullscreen and PiP buttons are keyboard-focusable, carry an accessible label
  that reflects the action, and expose `aria-pressed` reflecting on/off state
  (present in the baseline per R-0001).
- A hidden (unsupported) control is removed from the tab order.
- Keyboard shortcuts never trap focus and never interfere with typing in inputs
  or with the Escape panel-close behavior.
