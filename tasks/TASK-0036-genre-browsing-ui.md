---
id: TASK-0036
adr: ADR-0018
evolution: 9
status: pending
attempts: 0
depends_on: [TASK-0034]
---

# TASK-0036 — Filterable sidebar genre list + active-genre chip

## Goal

Browsing genres is practical even for large playlists: the sidebar category
list is shown alphabetically and gains a "Filter genres…" input when there are
many categories, and the content-head bar shows the playing channel's genre.
Builds on `getCats(cats, q)` from TASK-0034.

## Acceptance criteria

- [ ] `rndSide` renders category buttons in name-ascending order via
      `getCats(cats, '')`; "All Channels" and "Favourites" remain first and are
      never reordered or filtered out.
- [ ] When the category count exceeds `S.catFltMin` (declared in `client/cfg.js`,
      default 12), `rndSide` renders a genre filter `<input id="cat-filter"
      placeholder="Filter genres…">` above the category buttons; below the
      threshold the input is absent.
- [ ] Typing in the genre filter narrows the rendered category buttons via
      `getCats(cats, query)` (case-insensitive substring), keeping "All
      Channels"/"Favourites" pinned; clearing it restores the full list.
- [ ] The genre-filter query is view-local (a module-level variable in
      `client/ui.js`, not persisted, not a durable `ST` field) and resets when
      the category set changes on connect / account switch / disconnect.
- [ ] The content-head bar (`index.html` `.content-head`, `rndHead`) shows a
      genre chip with the current channel's `grp` when a channel is selected,
      and is empty/hidden when none is selected.

## Test requirements

- **Unit:** the sidebar markup builder for the genre-filter-input
  presence/absence around the `S.catFltMin` threshold and the pinned
  "All Channels"/"Favourites" entries; the content-head genre-chip text from a
  channel's `grp` (and empty when none). Follow R-0001 — verify against the
  baseline `.content-head`/sidebar HTML which attributes actually exist before
  asserting any attribute mutation.
- **UI:** in demo mode, type in the genre filter and assert only matching
  category buttons remain (with "All Channels"/"Favourites" still shown); select
  a channel and assert the genre chip shows its `grp`. Capture a screenshot of
  the filtered sidebar and the genre chip for the PR Test Results block.
- **Integration:** n/a — genres are derived from already-fetched data; no new
  external connectivity (existing M3U/Xtream live tiers already cover delivery).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
