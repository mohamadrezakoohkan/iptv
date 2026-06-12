---
id: ADR-0020
title: M3U / playlist sources expose no categories — the sidebar is a flat list
date: 2026-06-13
evolution: 12
status: accepted
governs:
  - client/api.js
  - tests/unit/api.test.js
  - tests/int/m3u.test.js
  - tests/ui/m3u.test.js
---

# ADR-0020 — M3U / playlist sources expose no categories — the sidebar is a flat list

## Context

E12 prompt: when connected to an M3U source (the iptv-org default provider and
the community presets all connect via the M3U path), the left sidebar shows
messy per-group category buttons such as `Classic;Comedy;Public;Series`,
`Classic;Series`, `Classic;Music`. The root cause is `getM3uCats(chs)` in
`client/api.js`, which derives one sidebar category per unique raw `group-title`
value. Public M3U files (notably iptv-org) pack several semicolon-joined genres
into a single `group-title`, so every distinct raw string becomes its own
useless category button.

`getM3uCats` and the category-shaped output of `parsM3u`/`loadM3u` originate
from the M3U-support decision (ADR-0005, since superseded by ADR-0008 for its
detection/footer parts, but its parse strategy — including the
`group-title → categories` step — carried forward). Xtream portals derive real,
clean categories from `get_live_categories` (ADR-0009) and must keep them.
Demo mode ships a curated category set and is unaffected.

The human has decided: **remove M3U group-title categorization entirely.** M3U
sources must show a flat sidebar — only "All Channels" and "Favourites", no
per-group category buttons.

The sidebar renderer `rndSide` in `client/ui.js` already renders only "All
Channels" + (conditionally) "Favourites" when its `cats` argument is empty, so
no UI change is needed — only the data: the M3U path must deliver an empty
categories list.

## Decision

The M3U / playlist path returns an **empty categories array**.

- `parsM3u(text)` returns `{ ok: true, val: { categories: [], channels } }`.
- `loadM3u(url)` returns `categories: []`.
- `getM3uCats` is **deleted** — no caller remains, so the dead derivation is
  removed rather than left orphaned.
- The category-only fields synthesized solely to feed sidebar grouping
  (`cat`, `category_id`, `categoryId` on M3U channel objects) are simplified:
  the canonical `Ch` schema still requires a `cat` field, so `mkM3uCh` keeps
  `cat` as an empty string (no group) and `grp` as the channel's raw
  `group-title` for display/debugging, and drops the redundant Xtream-shaped
  `category_id` / `categoryId` aliases that existed only for category buttons.
  The grid's category filter (`ch.cat === id`) only ever runs for a clicked
  category button; with no M3U category buttons it is never invoked for M3U
  sources, so an empty `cat` is correct.

This narrows ADR-0005's M3U parse strategy (step 5, "derive categories") and
supersedes that single step; the rest of ADR-0005 / ADR-0008 (M3U detection
via explicit mode, CORS proxy reuse, channel parse) is unchanged. ADR-0009
(Xtream categories) and the demo category set are untouched.

This decision **must not** break: the grid filter, search, sort (ADR-0017),
favourites, accounts (ADR-0013/0014), community presets (ADR-0015/0016), or the
theme (ADR-0019). The Xtream path still delivers real categories.

## Consequences

**Easier:**
- M3U sources show a clean, flat sidebar (All Channels + Favourites only),
  eliminating the `Classic;Comedy;…` noise.
- Dead category-derivation code (`getM3uCats`) and redundant channel-object
  aliases are removed, shrinking the M3U surface.

**Harder:**
- M3U users lose any per-group browsing in the sidebar. This is the explicit
  product intent — group-title categorization was the problem, not a feature.

**Ruled out:**
- Cleaning / splitting semicolon-joined `group-title` values into real
  categories (rejected: the human chose full removal for M3U).
- Touching the Xtream or demo category paths.

## Tasks derived

- TASK-0042 — M3U path returns empty categories; remove `getM3uCats`, simplify `mkM3uCh`; update unit + integration tests; verify flat M3U sidebar and intact Xtream/demo categories via UI

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0020` comment near the top
(added to the existing `ADR:` comment lines by implement-agent).
