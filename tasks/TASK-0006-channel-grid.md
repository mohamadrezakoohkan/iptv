---
id: TASK-0006
adr: ADR-0001
evolution: 1
status: done
attempts: 1
depends_on: [TASK-0005]
---

# TASK-0006 — Channel grid + channel card

## Goal

The channel grid renders a CSS-grid of channel cards. Each card shows a
3-digit zero-padded number (mono), a logo (or letter-tile fallback), a
favourite-star toggle, and the channel name. Clicking a card selects the
channel; clicking the star toggles the favourite state.

## Acceptance criteria

- [ ] `client/ui.js` contains `rndGrid(chs)` which clears and re-populates
      the `#ch-grid` element with one `.ch-card` per channel in `chs`.
- [ ] Each `.ch-card` contains:
      - `.ch-num`: `String(ch.num).padStart(3, '0')`, IBM Plex Mono.
      - `.ch-logo`: `<img>` with `src = ch.stream_icon`; on `onerror` or
        empty src, a letter-tile `<div>` with the first letter of `ch.name`
        in amber background is shown instead.
      - `.ch-star`: star icon button; `aria-label` = "Add to favourites" or
        "Remove from favourites"; class `fav-on` when `ch` is in `ST.favs`.
      - `.ch-name`: channel name, 2-line truncation via CSS.
- [ ] Clicking `.ch-card` (not star) calls `setCur(ch)`, transitions to PLAY
      phase, and calls `loadPlay(ch.streamUrl)`.
- [ ] Clicking `.ch-star` calls `setFavs()` with updated favs array, calls
      `saveSt('favs')`, and re-renders only that card's star (no full grid
      re-render).
- [ ] The active channel card (matching `ST.cur`) has class `ch-active`.
- [ ] Cards are `role="button"` and `tabindex="0"` for keyboard accessibility.
- [ ] `rndGrid` does not exceed 20 lines; card construction is extracted into
      a separate `mkCard(ch)` function.

## Test requirements

- **Unit:** `mkCard(ch)` — verify correct number padding for num=1, 10, 100,
  999; verify `fav-on` class applied when ch is in favs; verify star
  `aria-label` values.
- **UI:** Playwright — after demo connect, verify grid shows 34 cards; click
  first card; verify it gains `ch-active` class; click its star; verify
  `fav-on` class toggled; click "Favourites" sidebar filter; verify only
  starred cards shown.

## Implementation notes

### Files touched
- `client/ui.js` — updated:
  - `mkFav`: added `aria-label` ("Add/Remove from favourites"), changed `data-id` → `data-fav` on the star element
  - `mkCard`: changed signature from `mkCard(opts)` to `mkCard(ch)` (reads `window.IptvSt.ST` for `cur`/`favs`); active class changed from `active` → `ch-active`; exported on `window.IptvUi`
  - `rndGrid`: updated to call `mkCard(chs[i])` directly
  - Added `toggleFav(id)`: updates `ST.favs` via `setFavs`, then patches only the star element in-place (no full re-render)
  - Added `onGridClick(evt)`: event-delegated handler — fav star click → `toggleFav`; card click → `setCur`, guard `go('PLAY')` if phase=READY, call `window.IptvPlay.loadPlay(ch.url)` if available
  - Added `onGridKey(evt)`: keyboard Enter delegates to `onGridClick`
  - `mkEL`: wires `click` and `keydown` on `EL.list`
  - `toggleFav` exported on `window.IptvUi`

### Test files created
- `tests/unit/grid.test.js` — 16 unit tests: number padding, fav star class, aria-label, ch-active class, accessibility attributes
- `tests/ui/grid.test.js` — 11 UI tests: card count (31), structure, clicking behaviour, star toggle, favs filter

### Non-obvious decisions
- `mkCard(ch)` reads `window.IptvSt.ST` rather than being purely parameter-driven because RULE-FN-3 (max 2 params) makes it impossible to pass `ch + opts{cur,favs}` cleanly as a 1-param function. The existing `rndSide` already uses the same global-read pattern.
- Demo data has 31 channels (spec said 34; test file uses 31 matching the actual data).
- `go('PLAY')` is only called when `ST.phase === 'READY'` to prevent throwing when a card is clicked from PLAY state (channel switch).
- The `onGridClick` handler checks `[data-fav]` before `[data-id]` so that fav clicks do not also trigger card-select (the fav span is inside the card div).
