---
id: TASK-0042
adr: ADR-0020
evolution: 12
status: done
attempts: 1
depends_on: []
---

# TASK-0042 — M3U category = first-level segment of group-title (split on ";")

## Goal

After this task, connecting to any M3U / playlist source (the iptv-org default
provider and every community preset) shows clean, real categories in the
sidebar: each category is the **first-level segment** of `group-title` — the
text before the first `;`, trimmed and deduped. `Classic;Comedy;Public;Series`,
`Classic;Series`, and `Classic;Music` all collapse to a single `Classic`
category. First-level categories remain valid and visible; only the semicolon
tail is stripped. Xtream and demo categories are completely unaffected, and the
grid filter, search, sort, favourites, accounts, presets, and theme all still
work.

Note: a prior (wrong) E12 commit on this branch made the M3U path return empty
categories (`getM3uCats` deleted, `parsM3u`/`loadM3u` returning
`categories: []`, `mkM3uCh` setting `cat: ''`). This task is a **forward**
re-implementation that restores first-level category derivation — do not revert
or rewrite history; correct the behavior in a new commit.

## Acceptance criteria

- [ ] M3U category derivation (`getM3uCats` or an equivalent helper) is present
      again in `client/api.js`: for each channel it takes `group-title`, splits
      on `;`, keeps the **first segment trimmed**, and produces the ordered,
      deduplicated list of those first-level values, shaped as
      `{ category_id, category_name }` (both the first-level segment string) to
      match the Xtream/sidebar category object.
- [ ] `parsM3u(text)` returns
      `{ ok: true, val: { categories: <first-level cats>, channels } }` —
      `categories` is non-empty for a multi-group playlist and contains **no**
      value with a `;`.
- [ ] `loadM3u(url)` returns those same first-level `categories`.
- [ ] `mkM3uCh` keeps the canonical `Ch` fields `{ id, name, grp, url, img,
      cat, num }` where `grp` and `cat` are the **first-level segment** (trimmed
      first segment of `group-title`); fallback `"Other"` when `group-title` is
      absent/empty. `cat === grp` so the grid filter `ch.cat === id` matches the
      sidebar button id.
- [ ] Connecting via M3U mode renders a sidebar whose category buttons are the
      deduplicated first-level categories (e.g. one `Classic` button, no
      `Classic;Comedy;…` buttons), in addition to "All Channels" and
      "Favourites" (the latter when favourites exist).
- [ ] The Xtream path still returns its real `get_live_categories` categories,
      and the demo path still returns its curated category set — both unchanged.
- [ ] Grid category filter, search, sort (ADR-0017), favourites, account
      switching, community presets, and theme toggle all still work.
- [ ] `client/api.js` carries an `ADR: ADR-0020` comment near the top.

## Test requirements

- **Unit:** Update `tests/unit/api.test.js`. Replace the current
      `categories: []` assertion with one asserting that `parsM3u`, given a
      multi-group playlist whose `group-title` values contain semicolons (e.g.
      `Classic;Comedy;Public;Series`, `Classic;Series`, `Classic;Music`,
      `News;World`), returns deduplicated first-level categories
      (`["Classic", "News", …]`) — assert no category id/name contains a `;`,
      and that the `Classic;*` variants collapse to a single `Classic` entry.
      Assert channels still parse (count, names, urls) and that each channel's
      `cat`/`grp` equals its first-level segment. Keep the public-API surface
      assertion (`connect, isDemo, loadM3u, parsM3u`) intact. Do NOT weaken the
      Xtream-normalization category assertions — they must still pass.
- **UI:** REQUIRED. Connect via M3U mode (existing M3U/preset UI test harness):
      parse a fixture with noisy `Classic;…` group-titles via real
      `IptvApi.parsM3u` and render via `IptvUi.rndSide`; assert `#grp-nav`
      contains an "All Channels" button plus exactly the deduplicated
      first-level category buttons (one `Classic`, no `;`-bearing labels), and
      "Favourites" only when favourites exist. Assert an Xtream/demo connection
      still renders its own category buttons unchanged. Per R-0001, when
      asserting any DOM attribute mutation, first confirm the attribute's
      baseline presence in the source HTML.
- **Integration:** REQUIRED to UPDATE, not add. `tests/int/m3u.test.js` must
      assert that the live iptv-org playlist yields `res.val.categories` that is
      **non-empty**, **deduplicated**, and contains **only first-level**
      categories — i.e. no category `category_id`/`category_name` contains a
      `;` — while still asserting > 100 channels parse and conform to `CH_DEF`.
      Do not add new integration tests.

## Implementation notes

Files touched:
- `client/api.js` — restore the first-level category derivation (`getM3uCats`
  or equivalent), wired into `parsM3u`/`loadM3u`; `mkM3uCh` sets `grp` and
  `cat` to the trimmed first segment of `group-title` (fallback `"Other"`).
  A small pure helper such as `firstSeg(groupTitle)` —
  `String(g).split(';')[0].trim()` — keeps the rule in one place. Keep the
  `ADR-0020` reference in the file's `ADR:` comment.
- `tests/unit/api.test.js` — see Unit above.
- `tests/ui/m3u.test.js` — see UI above.
- `tests/int/m3u.test.js` — see Integration above.

Non-obvious: `rndSide` renders whatever categories it is given, so no renderer
change is needed — only the parse-step data changes. The grid filter
`ch.cat === id` works because `cat` equals the first-level category, which is
also the sidebar button id. This touches shared-scope plain-`<script>` client
files; validate-agent runs the FULL unit AND UI suites plus the integration
suite.

### Done (attempt 1) — forward re-implementation of first-level categories

`client/api.js`:
- Added pure helper `firstSeg(groupTitle)` — `String(g).split(';')[0].trim()`
  with `'Other'` fallback for empty/absent — the single place the first-level
  rule lives.
- `mkM3uCh` now sets both `grp` and `cat` to `firstSeg(opts.grp)`; the canonical
  `Ch` field set `{ id, name, grp, url, img, cat, num }` is unchanged. `cat ===
  grp`, so the grid filter `ch.cat === id` matches the sidebar button id.
- Re-introduced `getM3uCats(chs)` — deduplicated, first-seen-ordered
  `{ category_id, category_name }` from each channel's `cat` (already the
  first-level segment), matching the Xtream/sidebar category shape.
- `parsM3u` returns `{ categories: getM3uCats(chs), channels }`; `loadM3u`
  passes those through unchanged.
- The earlier wrong-commit comments claiming "M3U exposes no categories / flat
  sidebar / cat is always ''" were corrected to describe first-level
  derivation.

Tests:
- `tests/unit/api.test.js` — replaced the `categories: []` assertions with
  first-level assertions: `Classic;*` variants collapse to one `Classic`, no id
  /name contains `;`, each channel `cat === grp === firstSeg`, the loadM3u-path
  fixture (News/Sports) yields the two derived categories, "Other" fallback
  derives an "Other" category. Xtream-normalization assertions untouched; export
  surface assertion intact.
- `tests/ui/m3u.test.js` — the two flat-sidebar tests now assert the
  deduplicated first-level `Classic` button (All Channels + Classic = 2; with a
  favourite = 3), and that no `Classic;` label leaks. Xtream/demo-shaped sidebar
  test unchanged. No DOM-attribute-mutation assertions added (R-0001 N/A here).
- `tests/int/m3u.test.js` — updated to assert `categories` non-empty,
  deduplicated, and first-level only (no `;` in any id/name), keeping the > 100
  channels + CH_DEF conformance assertions.

No ADR traceability changes: ADR-0020's `governs:` already lists all four
touched files and each already carries the `ADR: ADR-0020` comment.

Verification: `npx vitest run` → 441 passed (19 files); `npx playwright test` →
136 passed. Integration suite not run here (live-network; validate-agent's
gate). Grid filter/search/sort/favourites/accounts/presets/theme all green in
the unit + UI suites.
