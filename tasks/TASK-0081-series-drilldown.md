---
id: TASK-0081
adr: ADR-0038
evolution: 22
status: done
attempts: 1
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

Implemented entirely within the existing VOD UI layer (no new state phase, no
localStorage key, no new server route — ADR-0038, specs/vod-library.md §5b).

**Files touched**

- `src/client/ui.js`
  - New module-level drill-down state: `serCur` (open series id or null) and
    `vodCtx` (the connected Xtream account context captured by `goVod`, needed so
    the on-demand `loadSerInfo` call has src/user/pass/ext). Both reset on
    connect/switch/disconnect (`resetMode` now also clears `serCur`; `goVod` sets
    `vodCtx`). `goMode` clears `serCur` so entering/leaving a mode starts at the
    list, never a stale drill-down.
  - `rndGrid` is now series-aware: in `series` mode it renders the series browse
    list (series cards) via `rndSerList`, or — when a series is open — the
    drill-down via `rndDrill`; live/movies behavior is unchanged.
  - New pure builders: `mkSerCard` (series card carrying `data-ser`, NOT
    `data-id`, so it opens rather than plays), `mkEpiRow` (episode entry carrying
    `data-id`, routed through the existing select+play branch — TASK-0082 adds the
    actual play), `mkSerBack` (a real `<button[data-back]>` with a baseline
    `aria-label`, R-0001), `mkSeason`, `mkDrill`, `groupBySeason`, `getSerName`.
  - New render/nav functions: `rndSerList`, `rndDrill`, `runSerInfo` (best-effort
    on-demand `IptvApi.loadSerInfo` then re-render), `goSerOpen` (records the open
    series, renders the shell immediately, kicks off the fetch — returns the
    promise so it is awaitable; failures degrade silently to the empty state),
    `goSerBack` (returns to the series list).
  - `onGridClick` routes `[data-back]` → `goSerBack` and `[data-ser]` →
    `goSerOpen` BEFORE the `[data-id]` select+play branch, so a series card never
    falls into the play path. `onGridKey` excludes `[data-back]` (a real button
    self-activates on Enter) while series cards / episode entries (role=button
    divs) still route through it.
  - Exported `onGridClick` plus the new series functions on `window.IptvUi`.
- `src/client/app.css` — drill-down styles: `.ch-grid.is-drill` (block flow),
  `.ser-drill-head` / `.ser-drill-title` / `.ser-back*`, `.ser-seasons` /
  `.ser-season-head` / `.ser-eps`, `.epi-row`, `.ser-empty`.
- `src/tests/unit/vodui.test.js` — extended `mkVodStub` (episodes/setEpis),
  `loadUi` (optional IptvApi arg), and added 12 series tests: series
  categories/cards render; opening a series invokes `loadSerInfo` with the
  account context and renders seasons/episodes grouped by season; `groupBySeason`
  ordering; the back control (baseline aria-label, R-0001) and `goSerBack`
  return to the list; `onGridClick` routes series cards to open; empty/failed/
  no-loader series-info shows the empty state without throwing.
- `src/tests/ui/vod.test.js` — added 4 Playwright tests driven against the
  offline demo connect with a stubbed series store + stubbed `loadSerInfo`:
  Series mode shows series cards + categories; opening a series shows
  seasons/episodes; the back control (mouse + keyboard) returns to the list.

**Non-obvious points**

- A `Series` browse entry uses `data-ser`; a `Vod` episode/movie uses `data-id`.
  This is the distinct-routing contract the AC requires and what TASK-0082 hooks
  the play call onto (episode `data-id` already flows through the existing
  select+play branch, which no-ops today because VOD ids are not in `ST.chs`).
- The on-demand fetch reuses TASK-0078's `IptvApi.loadSerInfo`; `vodCtx` is the
  bridge for the credentials it needs after connect time.
- Traceability: no new files created; all four touched files were already in
  ADR-0038's `governs:` and carry the `ADR: ADR-0038` comment — no `governs:`
  change and no ADR deletion.

**Test results (local):** full unit suite `npx vitest run` — 907 passed (40
files; 34 in vodui.test.js). `npx playwright test src/tests/ui/vod.test.js` —
14 passed (incl. the 4 new series tests).
