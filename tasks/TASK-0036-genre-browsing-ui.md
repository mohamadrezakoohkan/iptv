---
id: TASK-0036
adr: ADR-0018
evolution: 9
status: done
attempts: 1
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

**Files touched**

- `client/cfg.js` — added `S.catFltMin: 12` (the sidebar genre-filter
  threshold). cfg.js added to ADR-0018 `governs:`.
- `client/ui.js` — `rndSide` now renders a `#cat-filter` input (placeholder
  "Filter genres…") only when `cats.length > S.catFltMin`, above a
  `#cat-list` wrapper. The genre buttons render via `IptvSrch.getCats(cats, flt)`
  (filtered + name-ascending); "All Channels"/"Favourites" are pinned by
  `mkPin` and never filtered/reordered. New helpers: `mkPin`, `mkCats`,
  `rndCats` (re-renders only `#cat-list` so the input keeps caret focus across
  keystrokes), `rstFlt`. New delegated `input` handler `onFlt` on `#grp-nav`
  drives the view-local query. `rndHead` extended to render the active-genre
  chip (`#genre-chip`, text = current channel `grp`, hidden when none).
  `EL.gchp` added. `rndHead` is now actually called (it was exported but never
  invoked) — on channel select (`onGridClick`), on connect (`onOk`), on switch
  (`onSwOk`), on teardown (`tearDown`), and on auto-reconnect (`main.js`).
- `client/main.js` — `onConnRes` now calls `rndHead()` so a restored
  last-selected channel shows its genre chip on reload. Added to ADR-0018
  `governs:`.
- `index.html` — added `<span class="genre-chip" id="genre-chip" hidden>` in
  `.content-head` after `#now-info`.
- `client/app.css` — `.genre-chip`, `.cat-filter`/`#cat-filter`, `.cat-list`
  (`display: contents`) styles; `.now-title` changed to `flex: 0 1 auto` and
  `.fmt-chips` given `margin-left: auto` so the right cluster still pins right
  with the chip next to the name; `.cat-filter` hidden on mobile.

**View-local filter query.** The genre-filter text is a module-level `flt`
variable in `ui.js` (alongside the existing search `srch`/`tmp`), never an `ST`
field and never persisted. `rstFlt()` resets it on connect / account switch /
disconnect so it never carries across sources (ADR-0018 acceptance criteria).

**Demo cat-id casing fix (flagged concern).** Demo channels set
`ch.cat` to the category NAME ('News') while the demo category id was the slug
('news'), so the id-based grid filter (`getChs` flt, ADR-0009) returned ZERO
channels for every demo category. Fixed in `client/api.js` (`mkDemoCh` now sets
`cat: catSlug(grp)` so `ch.cat === cat.id`; `grp` stays the display name for
the chip). This makes demo category browsing work end-to-end and is consistent
with the ADR-0009 normalization decision (Xtream/M3U already key `cat` on the
category id) — no ADR change needed; api.js already carries `ADR: ADR-0009`.
The UI test "selecting a sidebar genre filters the channel grid" proves the
demo path now yields the right non-empty channel set (Kids → 3 channels).

**Test-harness scaffolding.** Several existing unit harnesses (foot, side,
persist, acctui) load `ui.js` with synthetic windows that predate ADR-0018;
`rndSide` now reads `window.S.catFltMin` and `IptvSrch.getCats`, so those
harness `win` objects gained an `S` (where not already loading real cfg.js) and
a faithful `getCats` stub, plus `setCur` where `tearDown` now uses it. No
assertions were weakened — only the mock surface was completed to match the new
production contract.

**Tests added**

- Unit `tests/unit/genre.test.js` (9): filter-input presence/absence around
  `S.catFltMin`; pinned All/Favs; name-ascending genre buttons; chip text/hidden
  from `cur.grp` (incl. empty-grp and no-selection cases). Loads real cfg + srch
  + ui so `S.catFltMin` and `getCats` are production code. R-0001: the baseline
  `#genre-chip` ships with the `hidden` attribute; the stub starts hidden and
  the test asserts the toggle from that baseline.
- UI `tests/ui/genre.test.js` (6): large-catalog filter input visible / small
  demo catalog has none; typing narrows buttons with All/Favs pinned; clearing
  restores + input keeps focus; demo channel select reveals the chip with its
  grp; genre selection filters the grid to a non-empty set; genre + sort
  integration. Screenshots: `test-results/genre-filter.png`,
  `test-results/genre-chip.png`.
- Integration: n/a (genres derived from already-fetched data; no new
  connectivity — per the task spec).

**Suite status:** `npx vitest run` 431 passed; `npx playwright test` 122 passed.
