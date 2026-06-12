---
id: TASK-0042
adr: ADR-0020
evolution: 12
status: done
attempts: 1
depends_on: []
---

# TASK-0042 — M3U path returns empty categories (flat sidebar)

## Goal

After this task, connecting to any M3U / playlist source (the iptv-org default
provider and every community preset) shows a FLAT sidebar — only "All Channels"
and "Favourites", with no per-group category buttons. The `getM3uCats`
derivation is gone, `parsM3u` and `loadM3u` return `categories: []`, and
`mkM3uCh` no longer synthesizes the category-only aliases. Xtream and demo
categories are completely unaffected, and the grid filter, search, sort,
favourites, accounts, presets, and theme all still work.

## Acceptance criteria

- [ ] `parsM3u(text)` returns `{ ok: true, val: { categories: [], channels } }`
      — `categories` is always an empty array for any M3U input.
- [ ] `loadM3u(url)` returns `categories: []`.
- [ ] `getM3uCats` is removed from `client/api.js` (no orphaned function).
- [ ] `mkM3uCh` keeps the canonical `Ch` fields `{ id, name, grp, url, img,
      cat, num }` with `cat` set to an empty string; the redundant
      `category_id` / `categoryId` aliases that only fed category buttons are
      removed (keep `stream_id` if other code relies on it — verify before
      removing).
- [ ] Connecting via M3U mode renders a sidebar containing only "All Channels"
      and "Favourites" (no `Classic;…` or other group-title buttons).
- [ ] The Xtream path still returns its real `get_live_categories` categories,
      and the demo path still returns its curated category set — both render
      their category buttons unchanged.
- [ ] Grid category filter (Xtream/demo), search, sort (ADR-0017), favourites,
      account switching, community presets, and theme toggle all still work.
- [ ] `client/api.js` carries an `ADR: ADR-0020` comment near the top.

## Test requirements

- **Unit:** Update `tests/unit/api.test.js` — the existing `parsM3u`
      "derives deduplicated ordered categories from channels" assertion (around
      line 555) must be replaced with one asserting `parsM3u` returns
      `categories: []` for a multi-group playlist, and that channels still parse
      correctly (count, names, urls, `cat === ''`). Keep the public-API surface
      assertion (`connect, isDemo, loadM3u, parsM3u`) intact. Do NOT weaken the
      Xtream-normalization category assertions — they must still pass.
- **UI:** REQUIRED. Connect via M3U mode (use the existing M3U/preset UI test
      harness) and assert the sidebar `#grp-nav` contains only the "All
      Channels" button (plus "Favourites" when favourites exist) and zero
      source-category buttons. Assert that an Xtream or demo connection still
      renders its category buttons. Per R-0001, when asserting any DOM attribute
      mutation, first confirm the attribute's baseline presence in the source
      HTML.
- **Integration:** REQUIRED to UPDATE, not add. `tests/int/m3u.test.js`
      currently asserts `res.val.categories.length).toBeGreaterThan(1)` and that
      every category has string `category_id`/`category_name` (around lines
      79–104). Change these to assert the live iptv-org playlist now yields
      `res.val.categories` as an empty array, while still asserting > 100
      channels parse and conform to `CH_DEF`. Do not add new integration tests.

## Implementation notes

Files touched:
- `client/api.js` — `parsM3u` now returns `categories: []`; `getM3uCats` removed
  (was its only caller, no orphan); `mkM3uCh` simplified to the canonical `Ch`
  fields with `cat: ''` and dropped the unused `stream_id` / `category_id` /
  `categoryId` aliases (verified no client reader: only `ui.js` `getCatId`
  reads `category_id` off *category* objects, never M3U channel objects).
  Added `ADR-0020` to the file's `ADR:` comment.
- `tests/unit/api.test.js` — replaced the "derives deduplicated ordered
  categories" assertion with one asserting `categories === []` plus channel
  count/name/url/`cat===''`; updated the "defaults grp to Other" and the
  `loadM3u` integration shape test to expect empty categories. Xtream and demo
  category assertions left untouched (still pass). Public surface
  `connect, isDemo, loadM3u, parsM3u` intact.
- `tests/ui/m3u.test.js` — added three Playwright tests: M3U fixture (with
  noisy `Classic;…` group-titles) parsed via real `IptvApi.parsM3u` + rendered
  via `IptvUi.rndSide` yields exactly one button (All Channels), no group
  buttons; favourites adds only the Favourites button; Xtream/demo-shaped
  categories still render their buttons.
- `tests/int/m3u.test.js` — live iptv-org assertions updated to expect
  `categories` empty while still asserting > 100 channels conform to CH_DEF.

Non-obvious: `rndSide` already renders flat on empty cats — unchanged per ADR.
R-0001: the only DOM-attribute baseline relevant here is the `active` class on
`[data-cat="all"]`, which `rndSide` adds itself; no source-HTML attribute
presence is asserted. `cat` is now empty on M3U channels; the grid filter
`ch.cat === id` only fires for a clicked category button, which M3U no longer
has, so empty `cat` is safe. ADR-0020 / ADR-0005 `governs:` already list all
touched files; no traceability edits needed.

This touches shared-scope plain-`<script>` client files; validate-agent runs
the FULL unit AND UI suites (and the integration suite). `rndSide` in
`client/ui.js` already renders the flat list when `cats` is empty — verify, do
not change it. The grid filter `ch.cat === id` only runs on a clicked category
button, which M3U sources no longer have, so an empty `cat` is safe.
