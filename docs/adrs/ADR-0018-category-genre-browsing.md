---
id: ADR-0018
title: Uniform category/genre browsing — derived genres for all engines, filterable sidebar
date: 2026-06-12
evolution: 9
status: deleted (governed code removed, E11)
governs: []
---

# ADR-0018 — Uniform category/genre browsing — derived genres for all engines, filterable sidebar

> **DELETED at E11.** The E11 prompt removed this feature: the derived/uniform
> categorization did not work reliably across all streaming networks/portals.
> The genre-filter input, the alphabetical `getCats`/`catName`/`cmpCat`
> reordering, and the active-genre chip were removed; the sidebar reverted to
> the pre-E9 plain per-engine category list governed by **ADR-0009 / ADR-0001**
> (which remain `accepted`). The sibling **ADR-0017** (channel sorting) shipped
> in the same PR (#11, E9) and is explicitly **preserved**. The demo channel
> cat-id casing fix from TASK-0036 (`ch.cat === cat.id`) is **retained and
> re-attributed to ADR-0009** — it is an ADR-0009 normalization-consistency
> correctness fix, not an ADR-0018 feature, and the surviving plain category
> browsing in demo depends on it. After E11 no file carries an `ADR: ADR-0018`
> comment and no file lists ADR-0018 in `governs:`. This record is retained as
> history (CORE_FLOW §3 — ADR files are never removed).
> Removal tasks: TASK-0039 (logic + helpers), TASK-0040 (UI markup/styles/chip),
> TASK-0041 (test cleanup + spec sync verification).

## Context

E9 prompt: "channels Categories/genres". Investigation of the current code
shows category/genre browsing is **already uniform at the data layer** and does
not need a new model:

- **Xtream** (`loadXtream`, ADR-0009) returns `categories: [{category_id,
  category_name}]` from `get_live_categories` and `Ch.cat = category_id`,
  `Ch.grp = category_name`.
- **M3U** (`parsM3u`, ADR-0005) already captures `group-title` per entry and
  `getM3uCats` derives the deduplicated ordered category list; `Ch.grp = Ch.cat
  = group-title` (fallback `"Other"`).
- The sidebar (`rndSide` in `client/ui.js`) renders "All Channels",
  "Favourites", and one button per category with a per-category channel count,
  and filters the grid by `Ch.cat` via `getChs`'s `flt` argument.

So genres are already derived and surfaced for **both** engines and for the E8
community presets (which are M3U). The genuine gaps this feature must close are
about **browsing** those genres, not modelling them:

1. Public M3U playlists (iptv-org "All" preset is ~10 000 channels across
   **hundreds** of `group-title` genres) make the flat sidebar category list
   unusably long — there is no way to find a genre quickly.
2. The category list order is the source's emission order, which is arbitrary
   for large playlists.
3. The active channel's genre is not shown in the content-head bar (the spec's
   §5a "category chip" is specified but not rendered), so the user loses track
   of which genre they are browsing while a channel plays.

## Decision

Keep the existing uniform category data model unchanged — no new schema, no new
network calls (genres are derived from already-fetched M3U/Xtream data). Improve
**browsing** only:

### Filterable, sorted sidebar genre list

`rndSide` renders, above the category buttons, a genre filter `<input
id="cat-filter">` ("Filter genres…") whenever the category count exceeds a
threshold (`S.catFltMin`, default 12). Typing filters the rendered category
buttons by case-insensitive substring match on the category name; "All
Channels" and "Favourites" are pinned and never filtered out. The matching is
done by a pure helper `getCats(cats, q)` exported from `client/srch.js`
(alongside `getChs`) — pure, no `ST`/DOM reads, returns the filtered category
array — so it is unit-testable. The category buttons are rendered in
**name-ascending (locale, case-insensitive)** order for stable, scannable
browsing; "All Channels"/"Favourites" remain first.

### Active-genre chip in the content-head bar

The content-head bar (`index.html` `.content-head`, `rndHead` in `ui.js`)
renders a genre chip showing the playing channel's `grp` next to the channel
name when a channel is selected, and is empty/hidden otherwise — fulfilling the
spec §5a "category chip".

## Consequences

**Easier:**
- Browsing hundreds of genres in a large public playlist becomes practical: type
  to filter, alphabetical order to scan.
- The user always sees which genre the current channel belongs to.
- No new connectivity, no schema churn — `getCats` is pure and the chip reads
  existing `Ch.grp`; existing integration tiers (ADR-0006/0007/0009) already
  cover that the data arrives.

**Harder:**
- `rndSide` gains conditional markup (filter input) and a stored filter query.
  The genre-filter query is **view-local** (not persisted, not in `ST` as a
  durable field) — kept in a module-level variable in `ui.js` like the existing
  search debounce, reset when the category set changes on connect/switch.

**Ruled out:**
- A new genre data model or per-engine genre normalization (already uniform).
- New API calls to fetch genres (derived from existing payloads).
- Persisting the genre-filter text (transient browsing aid, like search).

## Tasks derived

- TASK-0034 — `getCats(cats, q)` pure genre filter + alphabetical category order
- TASK-0036 — Filterable sidebar genre list + active-genre chip in content-head

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0018` comment near the top
(added to existing `ADR:` lines by implement-agent). `index.html` is linked from
this side; `app.css` carries it in a CSS comment.
