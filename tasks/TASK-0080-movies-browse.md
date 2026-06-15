---
id: TASK-0080
adr: ADR-0038
evolution: 22
status: pending
attempts: 0
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

_Filled by implement-agent._
