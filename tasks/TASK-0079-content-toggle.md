---
id: TASK-0079
adr: ADR-0038
evolution: 22
status: done
attempts: 1
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

**Files touched**

- `src/index.html` — added the `#content-toggle` segmented control (role="group")
  inside `.ch-bar`, three real `<button>.ct-opt` options (Live / Movies / Series).
  aria-pressed is PRESENT in the baseline markup of every option (R-0001); Live
  is `active`/`aria-pressed="true"`, Movies/Series start `aria-pressed="false"`
  and `hidden` (revealed at render by contextual presence).
- `src/client/app.css` — `.content-toggle` / `.ct-opt` styles (active option
  visually distinct via `--acc`; `.ct-opt[hidden]` collapses); `.ch-bar` switched
  to `gap` + `margin-left:auto` on `.ch-bar-count` so the toggle sits at the left
  of the toolbar without disturbing the sort control. Added ADR-0038 to header.
- `src/client/ui.js` — the bulk of the task:
  - **Content-mode flag**: a module-level `mode` var (default `'live'`) + `MODES`
    whitelist, held in the UI layer — NOT an ST key (CONVENTIONS §5 forbids adding
    ST props), NOT a phase (§6), no localStorage. Reset to `'live'` by `resetMode`
    on connect (`onOk`), switch (`onSwOk`), disconnect (`tearDown`); reload resets
    it via module re-init.
  - `getCMode`/`setCMode`/`resetMode`, `hasVodMovs`/`hasVodSers` (contextual-
    presence predicates), `getModeItems`/`getModeCats`/`mkModeCats` (per-mode data
    source — live → ST.chs/ST.cats; movies/series → window.IptvVod store, cats
    derived distinctly from the item set), `rndMode2` (reuses `rndSide`/`rndGrid`/
    `getChs` — Vod is Ch-compatible, so search+sort operate within the active set),
    `mkToggle`/`mkToggleOpt`/`rndToggle` (the builder + render; aria only flipped),
    `goMode` (switch + reset filter to "All" + re-render), `onToggle` (delegated
    click → goMode), `rndVod` (re-render toggle as the store fills), `goVod` (kick
    off the best-effort VOD fetch, mirroring `goEpg`).
  - Wired `#content-toggle` into `mkEL` (registry `EL.ctog`, click listener,
    initial `rndToggle`); `onOk`/`onSwOk` now `resetMode` + `rndToggle` + `goVod`;
    `tearDown` now `IptvVod.clear()` + `resetMode` + `rndToggle`. Exported the new
    members on `window.IptvUi`.
- `src/tests/unit/vodui.test.js` — new: builder baseline aria (R-0001), default +
  reset of the content-mode flag, per-mode source selection + filter reset,
  contextual presence (hide Movies/Series when the store lacks them).
- `src/tests/ui/vod.test.js` — new (Playwright): toggle renders with three
  options + baseline aria; only Live before connect; demo connect surfaces Movies
  (synthesized movie, §6) not Series; switching to Movies marks it active and
  re-renders the sidebar/grid; switch back to Live; keyboard operation (focus +
  Enter); stubbed-store contextual presence for Series.

**Non-obvious points**

- `goVod` passes `ext: val.ext`, which the connect Result does not currently carry
  (undefined). `vodExt` (vod.js) already falls back from each item's
  `container_extension` to the account ext to `'ts'`, so undefined is safe — the
  account-ext fallback wiring is deferred to the playback task (TASK-0082) rather
  than widening the connect Result shape here.
- Actual movie/series card browse render is TASK-0080/0081; this task establishes
  the toggle, the mode flag, the per-mode source switch, and the connect-flow
  `loadVod` invocation, so Movies/Series now have data and the surface switches.
- `live.test.js` (pre-existing) connects to a real external Xtream portal
  (`mymax.top:8080`); its two cases fail only when that live network is
  unavailable — unrelated to this task. All other UI tests and the full 888-test
  unit suite pass.
