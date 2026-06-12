---
id: ADR-0017
title: User-selectable channel sort, applied in srch.getChs and persisted
date: 2026-06-12
evolution: 9
status: accepted
governs:
  - client/srch.js
  - client/st.js
  - client/cfg.js
  - client/ui.js
  - index.html
  - client/app.css
---

# ADR-0017 — User-selectable channel sort, applied in srch.getChs and persisted

## Context

E9 prompt: "channel sorting". Today the channel grid order is **fixed**:
`client/srch.js`'s `getChs(chs, q, flt, favs)` ends with a hardcoded
`res.slice().sort((a, b) => a.num - b.num)` — channel number ascending, with no
way for the user to change it. `getChs` is the single chokepoint every render
path runs through (search input, category click, connect success, account
switch, page-load restore — see `client/ui.js` `fireSrch`, `onCatClick`, `onOk`,
and `client/main.js`). Channels carry `name`, `num`, and `id`; favourites live
in `ST.favs` (array of `id` strings). The state machine (ADR-0001) holds view
state as flat fields in `ST` and persists a small set of localStorage keys
(ADR-0003: `iptv_sel`, `iptv_favs`); a sort preference fits that exact model.

The decision the prompt forces: which sort keys exist, where the sort is
applied, how the order is controlled in the UI, and whether the choice persists.

## Decision

### Sort keys

A single active sort key, one of four stable string tokens, default `num-asc`:

| Token      | Order                                                              |
|------------|-------------------------------------------------------------------|
| `num-asc`  | channel number ascending (current behaviour — the default)        |
| `name-asc` | channel name A→Z (case-insensitive, locale compare)               |
| `name-desc`| channel name Z→A (case-insensitive, locale compare)               |
| `fav-first`| favourites first (members of `ST.favs`), then channel number asc  |

Name compares are case-insensitive and use `localeCompare`; ties fall back to
`num` ascending so order is deterministic. `fav-first` partitions on
membership in the passed `favs` array, each partition ordered by `num` asc.

### Where the sort is applied

`getChs` gains a fifth parameter `sort` (the active token) and applies it as the
**final** step, after filtering and search, replacing the hardcoded
`a.num - b.num`. `getChs` stays a pure function with no `ST` reads. An exported
`window.IptvSrch.SORTS` array of `{ id, label }` is the single source of truth
for the available options (id = token, label = human text), so the UI control
and the comparator never drift. An unknown/absent token falls back to `num-asc`.

### State + persistence

`ST` gains one flat field `sort` (default `'num-asc'`), with setter
`setSort(token)` in `st.js` (the only writer). A new config constant
`S.sortKey = 'iptv_sort'` (ADR-0003 pattern) and a `'sort'` branch in
`saveSt`/`loadSt` persist and restore the token: `saveSt('sort')` writes
`ST.sort`; `loadSt` reads `iptv_sort` and, when it is one of the four known
tokens, sets `ST.sort` (unknown/absent → left at default). The preference is
global (not per-account), surviving disconnects and reconnects like `iptv_favs`.

### UI control

A sort control lives in the channel-grid toolbar (`.ch-bar` in `index.html`,
next to the existing `#ch-count`). It is a labelled native `<select id="ch-sort">`
whose `<option>`s are rendered from `IptvSrch.SORTS`, with the current `ST.sort`
selected. Changing it calls `setSort`, persists via `saveSt('sort')`, and
re-renders the grid through `getChs` with the new token. The control is
keyboard-accessible (native select) and present whenever the grid is shown.

## Consequences

**Easier:**
- Sorting works identically for Xtream, M3U, presets, and demo — all flow
  through `getChs`, all use the canonical `Ch` schema.
- One pure comparator + one exported options list keeps UI and logic in sync
  and fully unit-testable without DOM or network.
- Preference survives reloads with the same tiny localStorage footprint as
  favourites.

**Harder:**
- Every existing `getChs` call site (`ui.js` x4, `main.js` x1) must pass the new
  `sort` argument. To avoid a half-migrated runtime (E7 staged-migration
  lesson), the comparator change and every call site update land in the same
  task and are verified by the full UI suite, which loads the real modules.

**Ruled out:**
- Per-account sort preferences (global preference is simpler and matches the
  favourites model; revisit only if asked).
- Multi-key sort UI / drag-reorder (out of scope for this prompt).

## Tasks derived

- TASK-0033 — Sort tokens + comparator + persistence (srch.js, st.js, cfg.js)
- TASK-0035 — Sort control in the channel-grid toolbar (ui.js, index.html, css)

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0017` comment near the top
(added to existing `ADR:` lines by implement-agent). `index.html`/JSON-like
formats are linked from this side; `app.css` carries it in a CSS comment.
