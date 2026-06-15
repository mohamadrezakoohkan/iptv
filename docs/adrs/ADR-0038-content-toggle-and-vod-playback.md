---
id: ADR-0038
title: Present VOD movies and series behind a Live | Movies | Series content toggle reusing the sidebar/grid and the existing select+play path
date: 2026-06-15
evolution: 22
status: accepted
governs:
  - src/client/ui.js
  - src/client/app.css
  - src/index.html
  - src/tests/unit/vodui.test.js
  - src/tests/ui/vod.test.js
  - src/tests/ui/vod-demo.test.js
  - src/tests/ui/vod-recording.test.js
---

# ADR-0038 — Present VOD movies and series behind a Live | Movies | Series content toggle reusing the sidebar/grid and the existing select+play path

## Context

E22 prompt: present VOD movies and series in the **existing sidebar/category +
channel-grid browse UX** behind a **Live | Movies | Series content toggle** (with
posters/title from the VOD payload). Selecting a movie or a series episode plays
it through the **existing dual-engine player and select+play path** a live
channel uses. Hard constraints: no new playback engine, no new state-machine
phase, no new server route, no new localStorage key required for playback.

ADR-0037 supplies the data (`Vod` items, `Series` browse entries,
`window.IptvVod`, built on-demand URLs). This ADR decides the **render surface +
the select+play wiring**. Prior patterns constrain it:

- `rndSide` / `rndGrid` / `mkCard` (`src/client/ui.js`) already render the
  sidebar category list and the channel grid from a categories array + an items
  array. A `Vod` item is render-compatible with `Ch` for the card (`id`, `name`,
  `img`, `num`, `cat`), so the grid reuses `mkCard`/`rndGrid` unchanged.
- `onGridClick` already routes `[data-id]` card clicks to the select+play arc
  (`setCur` → `saveSt('sel')` → `go('PLAY')` when `READY` → `rndHead` →
  `IptvPlay.loadPlay(url)`), and routes `[data-exp]`/`[data-rem]`/`[data-replay]`
  with `stopPropagation`. `goRemWatch` (ADR-0034) and `goReplay` (ADR-0036) prove
  the same arc is reachable from non-card sites.
- `ST.flt` is a render-mode filter held in the existing state layer, not a phase
  (CONVENTIONS §6). The content mode is the same kind of render-mode flag.
- The toggle/series drill-down are presentational navigation, like the
  account-panel `is-open` class — no state phase, no localStorage key.

## Decision

Add the content toggle, the per-mode sidebar/grid render, the series
seasons/episodes drill-down, and the on-demand select+play wiring entirely within
`src/client/ui.js`, `src/client/app.css`, and `src/index.html`, reading
`window.IptvVod` at render/activate time. No new state phase, no new boolean
playback control flag, no new localStorage key, no new server route, no new
engine.

### Live | Movies | Series content toggle

A keyboard-accessible segmented control (rendered in the content area, e.g.
content-head / above the grid) switches the browse surface between `live`,
`movies`, `series`. Default `live`. Switching re-renders the **sidebar**
(`rndSide`, reused) and the **grid** (`rndGrid`, reused) for that mode's
categories/items and resets the active category to "All" for that mode. The
content mode is a **transient render-mode flag** in the existing UI/state layer
(not a phase, no localStorage key); it resets to `live` on reload. The
**Movies**/**Series** options are shown **only when** `window.IptvVod` actually
has movies/series (contextual presence — hidden on M3U/demo and VOD-less Xtream,
except the demo's synthesized movie surfaces Movies). Full behavior:
`docs/specs/vod-library.md` §5a.

### Series seasons/episodes drill-down

Selecting a `Series` card (in `series` mode) opens its drill-down: an on-demand
`get_series_info` fetch (ADR-0037, best-effort) normalizes episodes into `Vod`
items grouped by season; the drill-down lists seasons + selectable episode
entries (reusing the grid/card surface where practical) plus a season grouping
header and a **back** affordance to the series list. Selecting an episode plays
it (below). Presentational navigation only — no phase, no localStorage key. Full
behavior: `docs/specs/vod-library.md` §5b.

### On-demand select+play reuses the existing path

Selecting a movie card or a series episode drives the **existing** transition
exactly like a live card click / `goRemWatch` / `goReplay`: resolve the `Vod`
item (no-op if gone), `setCur(item)`, `saveSt('sel')`, `go('PLAY')` when `READY`,
`rndHead()`, then `IptvPlay.loadPlay(item.url)`. Because the on-demand URL
preserves the source extension, `loadPlay` → `getEng` selects the same engine
through the same proxy — **no new engine, no new phase, no new route**. Live-only
affordances (NOW/NEXT, Remind, Replay) are naturally absent on VOD cards because
`window.IptvEpg` has no entries for VOD ids. **R-0001 compliance:** toggle aria
attributes (`aria-pressed`/`aria-selected`) are present in the baseline HTML the
builder emits and only flipped between values; one-shot controls (cards, episode
entries, back) carry no toggled attribute. Full behavior:
`docs/specs/vod-library.md` §5c, §8.

## Consequences

**Easier:**
- Reuses `rndSide`, `rndGrid`, `mkCard`, `onGridClick`, and the select+play arc —
  the prompt's "present in the existing sidebar/category + channel-grid browse
  UX" and "reuse the existing select+play path" mandates are satisfied literally:
  no new engine, phase, or route.
- A `Vod` item being `Ch`-compatible for render/play means a movie or episode
  card "just works" through the existing grid and player.

**Harder:**
- `rndSide`/`rndGrid` must now render from whichever mode's categories/items set
  is active; the content-mode flag + per-mode data source must be threaded
  cleanly through the existing render calls without a phase.
- The series drill-down adds a sub-navigation surface (seasons/episodes + back)
  inside `series` mode that the grid does not have today; the UI test must prove
  open → episodes → back and episode play.
- The toggle's contextual presence (hide Movies/Series when absent) must track
  the VOD store state across connect/switch/disconnect.

**Ruled out:**
- A new state-machine phase for VOD browsing or playback, a VOD-specific player,
  a server VOD route, or a new localStorage key (all forbidden by the prompt).
- A separate VOD grid/sidebar implementation (the existing render is reused).
- Showing empty Movies/Series tabs on sources without VOD (contextual presence,
  consistent with the EPG/catch-up posture).

## Tasks derived

- TASK-0079 — Live | Movies | Series content toggle (segmented control, content
  mode flag, contextual presence) re-rendering the sidebar/grid per mode.
- TASK-0080 — Movies browse: VOD movie categories in the sidebar + movie cards in
  the grid for `movies` mode (reusing `rndSide`/`rndGrid`/`mkCard`).
- TASK-0081 — Series browse + seasons/episodes drill-down: series cards in
  `series` mode, on-demand `get_series_info`, episode entries grouped by season,
  back affordance.
- TASK-0082 — On-demand select+play wiring: selecting a movie/episode plays it via
  the existing select+play path; engine resolves from the preserved extension.
- TASK-0083 — Demo recording of browsing Movies/Series via the toggle and playing
  a VOD item on the synthesized offline demo movie (boot → demo → toggle to
  Movies → play the demo movie → revert → stop).

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0038` comment near the top.
When a change removes the last governed code, this ADR is marked `status:
deleted` — the file itself is never removed; it is history.
