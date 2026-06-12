---
id: ADR-0020
title: M3U / playlist category is the first-level segment of group-title (text before the first ";")
date: 2026-06-13
evolution: 12
status: accepted
governs:
  - client/api.js
  - tests/unit/api.test.js
  - tests/int/m3u.test.js
  - tests/ui/m3u.test.js
---

# ADR-0020 — M3U / playlist category is the first-level segment of group-title (text before the first ";")

## Context

E12 prompt: when connected to an M3U source (the iptv-org default provider and
the community presets all connect via the M3U path), the left sidebar shows
messy per-group category buttons such as `Classic;Comedy;Public;Series`,
`Classic;Series`, `Classic;Music`. The root cause is **parsing**, not the
existence of categories: a public M3U `group-title` is a hierarchical,
semicolon-joined path — `category;subcategory;…`. `getM3uCats(chs)` in
`client/api.js` derived one sidebar category per unique **raw** `group-title`
string, so each distinct full path became its own button, fragmenting one real
category (`Classic`) across many near-duplicate buttons.

`getM3uCats` and the category-shaped output of `parsM3u`/`loadM3u` originate
from the M3U-support decision (ADR-0005, superseded by ADR-0008 for its
detection/footer parts, but its parse strategy — including the
`group-title → categories` step — carried forward). Xtream portals derive real,
clean categories from `get_live_categories` (ADR-0009) and must keep them.
Demo mode ships a curated category set and is unaffected.

The human has decided: **M3U categories are valid and must remain — only the
semicolon tail is the problem.** The first-level segment of `group-title` (the
text before the first `;`) is the real category; the rest is subcategory noise.
"Classic;Comedy;Public;Series", "Classic;Series", and "Classic;Music" must all
collapse to a single `Classic` category.

## Decision

The M3U / playlist path derives categories from the **first-level segment** of
each channel's `group-title`: the substring before the first `;`, trimmed,
deduped, in first-seen order.

- The category derivation (`getM3uCats` or equivalent) is **retained**, not
  removed. For each channel it takes `group-title`, splits on `;`, keeps the
  first segment, trims surrounding whitespace, and collects the ordered,
  deduplicated set of those first-level values as the M3U categories — shaped
  as `{ category_id, category_name }` to match the Xtream category object the
  sidebar consumes (where the id and name are the first-level segment string).
- `parsM3u(text)` returns
  `{ ok: true, val: { categories: <first-level cats>, channels } }`.
- `loadM3u(url)` returns those same `categories`.
- `mkM3uCh` populates the channel's `grp` and `cat` with the **first-level
  category** (trimmed first segment of `group-title`), so the grid filter
  `ch.cat === id` matches the sidebar button's id. A channel whose
  `group-title` is absent or empty falls back to `"Other"` (the existing
  fallback in ADR-0005). The full raw `group-title` is no longer surfaced as a
  category; only its first-level segment is.

This **refines** ADR-0005's M3U parse strategy step 5 ("derive categories from
`group-title`"): the step is kept but the value used is the first-level
segment, not the raw string. It does not nullify M3U categorization. The rest
of ADR-0005 / ADR-0008 (M3U detection via explicit mode, CORS proxy reuse,
channel parse) is unchanged. ADR-0009 (Xtream categories) and the demo category
set are **untouched**.

This decision **must not** break: the grid filter, search, sort (ADR-0017),
favourites, accounts (ADR-0013/0014), community presets (ADR-0015/0016), or the
theme (ADR-0019). The Xtream path still delivers its `get_live_categories`
categories; the demo path still delivers its curated set.

## Consequences

**Easier:**
- M3U sources show clean, real categories: one `Classic` button instead of a
  dozen `Classic;…` near-duplicates. The sidebar stays useful and per-group
  browsing is preserved.
- The fix is localized to the parse step — no UI/renderer change (`rndSide`
  already renders whatever categories it is given).

**Harder:**
- Subcategory granularity is lost in the sidebar: `Classic;Comedy` and
  `Classic;Series` both filter to the single `Classic` category. This is the
  explicit product intent — only the first level is a real category.
- A `group-title` that legitimately contained a `;` inside a single category
  name would be truncated at the first `;`. Accepted: the iptv-org convention
  uses `;` strictly as the hierarchy separator.

**Ruled out:**
- Removing M3U categories entirely / a flat sidebar (the earlier, wrong E12
  reading — explicitly reversed by the human; first-level categories are valid
  and must remain).
- Keeping the raw multi-segment `group-title` as the category (the original
  bug).
- Touching the Xtream or demo category paths.

## Tasks derived

- TASK-0042 — M3U category = first-level segment of `group-title` (split on
  `;`, first segment, trimmed, deduped); `getM3uCats` (or equivalent) and
  `mkM3uCh` updated; Xtream/demo untouched; update unit + integration tests;
  verify clean first-level M3U categories and intact Xtream/demo categories

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0020` comment near the top
(added to the existing `ADR:` comment lines by implement-agent).
