---
id: TASK-0080
adr: ADR-0038
evolution: 22
status: done
attempts: 1
depends_on: [TASK-0079]
---

# TASK-0080 — Movies browse (categories + poster cards)

## Goal

Make the `movies` content mode fully browseable: the sidebar shows the VOD movie
categories (with counts) and the grid shows the movie `Vod` items as poster
cards, reusing `rndSide` / `rndGrid` / `mkCard`. Category filter, search, and
sort work within the movie item set exactly as for live channels. After this task
a user can switch to Movies and browse the portal's (or the demo's) movie library;
playback wiring is TASK-0082.

## Acceptance criteria

- [ ] In `movies` mode, `rndSide` renders the VOD movie categories from
      `window.IptvVod` (All + one button per category with a count), and clicking
      a category filters the grid by `item.cat === id`, per
      `docs/specs/vod-library.md` §5a.
- [ ] In `movies` mode, `rndGrid` renders the movie `Vod` items as cards via the
      existing `mkCard` (poster from `img`, title from `name`); a missing poster
      falls back to the existing letter-tile, exactly as live channels.
- [ ] Search (`#search`) filters the movie set by name and sort orders the movie
      set, both within `movies` mode, reusing the existing search/sort path.
- [ ] Movie cards do not show live-only affordances (NOW/NEXT, Remind, Replay) —
      verified absent because `window.IptvEpg` has no entries for VOD ids.
- [ ] On a source with no movies the `movies` option is absent (TASK-0079
      contextual presence) so this mode is only reachable when populated.

## Test requirements

- **Unit:** `src/tests/unit/vodui.test.js` (extend) — `rndSide` in `movies` mode
      lists the VOD movie categories with correct counts; `rndGrid` in `movies`
      mode renders one card per movie item; movie cards carry no EPG/Remind/Replay
      markup. Honor R-0001.
- **UI:** `src/tests/ui/vod.test.js` (extend) — switching to Movies shows movie
      categories in the sidebar and movie poster cards in the grid; a category
      click filters the movie grid; search filters movies. (Driven against demo /
      stubbed VOD store.)
- **Integration:** n/a — no external connectivity (render-only; fetch is
      TASK-0078).

## Implementation notes

TASK-0079 already established the per-mode infrastructure in `src/client/ui.js`
(`getModeItems`/`getModeCats`/`rndMode2`/`goMode`/`rndToggle`), so this task only
had to make the existing **browse handlers** mode-aware so category filter,
search, and sort operate within whichever content mode's set is active. The
sidebar/grid render (`rndSide`/`rndGrid`/`mkCard`) and the poster/title fields
were already `Vod`-compatible, so no card markup change was needed.

Files touched (`src/client/ui.js`):

- `onCatClick` — now filters the **active mode's** set: it reads `getModeCats()`
  + `getModeItems()` instead of hardcoded `ST.cats`/`ST.chs`, so a category click
  in Movies mode filters the movie grid by `item.cat === id`. In live mode
  `getModeItems()` → `ST.chs` and `getModeCats()` → `ST.cats`, so live behavior
  is unchanged.
- `fireSrch` — searches `getModeItems()` (the active mode's set) instead of
  `ST.chs`, so `#search` filters movies within Movies mode.
- `onSort` — sorts `getModeItems()` instead of `ST.chs`.
- `goViewAll` (empty-state "Browse all") — now mode-aware via
  `getModeCats()`/`getModeItems()`.
- Public API: exported `onCatClick`, `onSrch`, `fireSrch` (alongside the already
  exported `onSort`) so the unit tests can drive the browse handlers directly.

No CSS / HTML change: movie cards reuse the existing `.ch-card` (poster via
`mkLogo` → `.ch-logo` `<img>` from `img`, letter-tile `.ch-logo-fb` fallback,
title from `name`). Live-only affordances (NOW/NEXT, Remind, Replay) are
naturally absent on VOD cards because `mkCard` gates them on
`window.IptvEpg.has(id)`, and the EPG store has no entries for VOD ids.

Traceability: `ui.js`, `vodui.test.js`, `vod.test.js` already carry the
`ADR: ADR-0038` comment and are already in ADR-0038's `governs:` list — no
traceability changes required (no files created/renamed/removed).

Tests:

- Unit (`src/tests/unit/vodui.test.js`, +7 tests): `rndSide` in movies mode lists
  the VOD movie categories with correct per-category counts + an All button with
  the movie total; `rndGrid` in movies mode renders one card per movie via
  `mkCard` (title from `name`, poster `<img>` from `img` with letter-tile
  fallback); movie cards carry no `ch-nn`/`data-rem`/`data-replay`/`data-exp`
  markup; category click + search operate on the movie set. R-0001: all
  assertions check `innerHTML` content, no DOM-attribute mutation assertions.
- UI (`src/tests/ui/vod.test.js`, +3 tests): Movies mode shows movie categories
  in the sidebar and poster cards in the grid (img vs letter-tile, no live-only
  affordances); a category click filters the movie grid; search filters the movie
  set. Driven against the demo connect plus a directly-stubbed multi-category VOD
  store. Note: the stubbed movie ids are VOD-style (`vod-N`, mirroring the real
  `demo-vod-N` convention) so they never collide with the demo's live-channel
  EPG entries (which would otherwise spuriously attach NOW/NEXT to a card).
- Integration: n/a (render-only; no external connectivity — the VOD fetch is
  TASK-0078).
