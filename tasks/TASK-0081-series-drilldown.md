---
id: TASK-0081
adr: ADR-0038
evolution: 22
status: pending
attempts: 0
depends_on: [TASK-0080]
---

# TASK-0081 — Series browse + seasons/episodes drill-down

## Goal

Make the `series` content mode browseable and drillable: the sidebar shows series
categories and the grid shows series poster cards; selecting a series card opens
its seasons/episodes drill-down (on-demand `get_series_info` via TASK-0078's
loader), listing seasons and selectable episode entries with a back affordance to
the series list. After this task a user can switch to Series, open a series, and
see its episodes; episode playback is TASK-0082.

## Acceptance criteria

- [ ] In `series` mode, `rndSide` renders series categories and `rndGrid` renders
      `Series` cards (poster from `img`, title from `name`), reusing the existing
      sidebar/grid surface, per `docs/specs/vod-library.md` §5a.
- [ ] Selecting a `Series` card opens its drill-down (does **not** play): it
      triggers the on-demand `get_series_info` loader (TASK-0078), groups episodes
      by season, and renders the seasons + selectable episode entries (`Vod`
      episode items) reusing the grid/card surface, per §5b.
- [ ] The drill-down has a keyboard-focusable **back** affordance returning to the
      series list; opening/closing the drill-down is presentational navigation
      within `series` mode (no state phase, no localStorage key).
- [ ] A series-info fetch failure degrades silently (the drill-down shows an empty
      / "no episodes" state, never an error or crash).
- [ ] Episode entries are routed distinctly from series cards in `onGridClick`
      (a series card opens the drill-down; an episode entry plays in TASK-0082) —
      wired so TASK-0082 only adds the play call.
- [ ] **R-0001:** any aria attribute on the back control / episode entries is
      present in the baseline markup; one-shot controls carry no toggled attribute.

## Test requirements

- **Unit:** `src/tests/unit/vodui.test.js` (extend) — `rndSide`/`rndGrid` in
      `series` mode render series categories + series cards; opening a series
      renders its seasons/episodes from a stubbed `window.IptvVod`; the back
      control returns to the series list; an empty/failed series-info shows the
      empty state without throwing. Honor R-0001.
- **UI:** `src/tests/ui/vod.test.js` (extend) — switching to Series shows series
      cards; opening a series shows seasons/episodes; the back control returns to
      the series list. (Driven against a stubbed VOD store / demo, no live
      network.)
- **Integration:** n/a — the live series-info fetch path is covered by TASK-0078's
      integration test; this task is render/navigation only.

## Implementation notes

_Filled by implement-agent._
