---
id: TASK-0007
adr: ADR-0004
evolution: 1
status: done
attempts: 1
depends_on: [TASK-0003, TASK-0004]
---

# TASK-0007 — Player component (hls.js, idle state, error overlay)

## Goal

`client/play.js` wraps hls.js and `<video>` with three functions: `mkPlay`,
`loadPlay`, and `stopPlay`. The player card in the DOM shows an idle "NO
SIGNAL" state when no channel is selected, transitions to an active `<video>`
when a stream is loaded, and shows an error overlay on fatal hls.js errors.

## Acceptance criteria

- [ ] `client/play.js` exists and carries `// ADR: ADR-0004`.
- [ ] `mkPlay(el)` stores the video element reference; must be called once
      from `main.js`.
- [ ] `loadPlay(url)` returns `{ ok: true, val: null }` on successful setup or
      `{ ok: false, err: string }` when HLS is not supported.
- [ ] If `Hls.isSupported()` is true, `loadPlay` creates a new `Hls` instance,
      calls `hls.loadSource(url)` and `hls.attachMedia(el)`.
- [ ] If `Hls.isSupported()` is false but the video element can play
      `'application/vnd.apple.mpegurl'` natively, sets `el.src = url` directly.
- [ ] If neither condition is met, returns `{ ok: false, err: 'HLS not supported' }`.
- [ ] On `Hls.Events.ERROR` with `data.fatal === true`, calls
      `go('ERR')` and `setErr(data.details)`.
- [ ] `stopPlay()` calls `hls.destroy()` if an instance exists, clears `el.src`,
      and nulls the hls reference.
- [ ] Calling `loadPlay` when a previous instance exists calls `stopPlay()`
      first (prevents memory leaks on rapid channel switching).
- [ ] The `#player-card` DOM section has class `player-idle` when `ST.cur` is
      null (controlled by `rndPhase()` in `ui.js`).
- [ ] `#player-idle` overlay (antenna SVG + "NO SIGNAL" text) is visible in
      idle state and hidden in play state.
- [ ] `#player-err` overlay is visible when `ST.phase === 'ERR'` and
      `ST.cur !== null`.

## Test requirements

- **Unit:** `loadPlay` — mock `window.Hls` with `isSupported: true`; verify
  `loadSource` and `attachMedia` called with correct args. Mock
  `isSupported: false` + canPlayType truthy → verify `el.src` set. Mock both
  false → verify `{ ok: false }` returned. `stopPlay` — verify `hls.destroy`
  called.
- **UI:** Playwright — load app in demo mode; before channel selection verify
  `#player-idle` is visible; click a channel card; verify `#player-idle`
  is hidden and video element is present in player card.

## Implementation notes

### Files changed
- `client/play.js` — created; hls.js wrapper exposing `mkPlay`, `loadPlay`, `stopPlay` via `window.IptvPlay`
- `client/ui.js` — added `card`, `idle`, `wrap` to EL registry; added `rndPlayer()` helper called from `rndPhase()`; updated `mkEL()` to init new refs; updated ADR comment
- `client/app.css` — added `#player-card.player-idle { position: relative; inset: auto; }` override to prevent the `.player-idle` overlay CSS from expanding `#player-card` when the class is toggled for state tracking; updated ADR comment
- `index.html` — added `id`s (`player-card`, `player-video`, `player-err`, `player-wrap`); changed `id="player"` → `id="player-video"`, `id="err-bar"` → `id="player-err"`; added hls.js CDN `<script>` tag and `<script src="/play.js">`; updated ADR comment
- `adrs/ADR-0004-video-playback.md` — `governs:` trued up with `client/ui.js`, `client/app.css`, `index.html`
- `tests/unit/play.test.js` — created; 10 unit tests covering all `loadPlay`/`stopPlay` paths
- `tests/ui/player.test.js` — created; 11 Playwright tests covering idle/play/error DOM state transitions

### Non-obvious decisions
- **CSS conflict fix**: `.player-idle { position: absolute; inset: 0 }` is used for the overlay div. Toggling it on `#player-card` for state tracking would make the card `position: absolute; inset: 0`, breaking layout. Added `#player-card.player-idle { position: relative; inset: auto }` to neutralize the conflict.
- **`body.is-err .player-wrap { display: none }` override**: Pre-existing CSS hides `.player-wrap` in ERR phase. `rndPlayer()` sets `EL.wrap.style.display = 'block'` when ERR + cur is set, overriding the CSS rule so `#player-err` overlay has dimensions and is visible.
- **Stub design for unit tests**: HLS stub functions are assigned as own properties in the constructor body (not prototype), so call-tracking is done via a shared `log` object reference captured in the closure — not via prototype mutation after instantiation.
- **Out-of-scope observation**: `client/main.js` (TASK-0009) needs to call `IptvPlay.mkPlay(document.getElementById('player-video'))` once at DOMContentLoaded. This is noted here but not implemented (out of scope).
