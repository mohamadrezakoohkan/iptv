---
id: TASK-0079
adr: ADR-0038
evolution: 22
status: pending
attempts: 0
depends_on: [TASK-0078]
---

# TASK-0079 — Live | Movies | Series content toggle

## Goal

Add a keyboard-accessible **Live | Movies | Series** segmented content toggle to
the content area, plus a transient content-mode flag in the existing UI/state
layer and the per-mode re-render plumbing. Switching mode re-renders the sidebar
(`rndSide`) and grid (`rndGrid`) from the active mode's categories/items and
resets the active category to "All". Movies/Series options appear only when
`window.IptvVod` has them (contextual presence). After this task the toggle
exists and switches the active data source; Movies/Series actually populate in
TASK-0080/TASK-0081.

## Acceptance criteria

- [ ] A segmented content toggle is rendered in the content area (markup in
      `src/index.html` / built in `src/client/ui.js`) with options Live, Movies,
      Series; keyboard-focusable; the active option visually distinct and
      announced via `aria-pressed`/`aria-selected`, per `docs/specs/vod-library.md`
      §5a, §8.
- [ ] A transient content-mode flag (`live` default) lives in the existing
      UI/state layer (not a state-machine phase, no localStorage key); it resets
      to `live` on reload, on connect, on account switch, and on disconnect.
- [ ] Switching mode re-renders `rndSide` + `rndGrid` from the active mode's
      categories/items (live channels for `live`; the VOD store's movie
      categories/items for `movies`; series categories/cards for `series`) and
      resets the active category filter to "All" for that mode. Search + sort
      operate within the active mode's item set.
- [ ] The **Movies** and **Series** options are shown only when `window.IptvVod`
      has movies / series respectively; on M3U/demo (beyond the demo movie) and
      VOD-less Xtream only Live shows (contextual presence, §5a).
- [ ] **R-0001:** `aria-pressed`/`aria-selected` are present in the baseline
      markup the builder emits and only flipped between values; no aria attribute
      is added at runtime that was absent in source.

## Test requirements

- **Unit:** `src/tests/unit/vodui.test.js` — the toggle builder emits the three
      options with baseline aria attributes (R-0001); the content-mode flag
      defaults to `live` and resets on connect/switch/disconnect; switching mode
      selects the correct categories/items source; contextual presence hides
      Movies/Series when the VOD store lacks them.
- **UI:** `src/tests/ui/vod.test.js` (start it here) — the toggle renders, is
      keyboard-operable, switching to a mode re-renders the sidebar/grid, and the
      active option is visually marked. (Driven against demo or a stubbed VOD
      store so it runs without live network.)
- **Integration:** n/a — no external connectivity (render-only; fetch is
      TASK-0078).

## Implementation notes

_Filled by implement-agent._
