---
id: TASK-0040
adr: ADR-0018
evolution: 11
status: done
attempts: 1
depends_on: [TASK-0039]
---

# TASK-0040 — Remove the filterable sidebar + active-genre chip; restore the plain sidebar

## Goal

The sidebar renders the pre-E9 plain category list (no "Filter genres…" input,
no `#cat-list` wrapper, source-order categories) and the content-head bar has no
active-genre chip. All ADR-0018 UI code, markup, and styles are gone; every
surviving feature that shares these files — the ADR-0017 sort control, the
ADR-0019 theme toggle, the ADR-0013/0014 account panel, the ADR-0016 presets,
search, favourites, and the original category-click grid filter — still works.
Builds on TASK-0039 (the genre logic is already removed).

## Acceptance criteria

- [ ] `client/ui.js`: `rndSide(cats, chs, favs)` reverts to the pre-E9 form —
      renders "All Channels", an optional "Favourites" button, then one
      `mkCatBtn` per category in the source's delivery order, directly into
      `EL.nav.innerHTML` (no `#cat-list` wrapper, no filter input). The
      `getCatId` / `getCatName` / `mkCatBtn` helpers stay (they pre-date
      ADR-0018).
- [ ] These ADR-0018-only members are removed from `client/ui.js`: `mkPin`,
      `mkCats`, `rndCats`, `rstFlt`, `onFlt`, the module-level `flt` variable,
      `rndHead`'s genre-chip logic, the `EL.gchp` registry slot and its
      `getElementById('genre-chip')` init, and the `EL.nav` `input` listener
      (`addEventListener('input', onFlt)`). All `rstFlt()` call sites (in
      `onOk`, `onSwOk`, `tearDown`) are removed.
- [ ] `rndHead()` reverts to the pre-E9 body: sets `EL.info.textContent` to the
      current channel name (or `''`), with no chip. It is acceptable for
      `rndHead` to keep being invoked from `onGridClick` / `onOk` / `onSwOk` /
      `tearDown` / `main.js` — the pre-E9 `now-info` update is harmless and
      correct — OR to be reverted to its pre-E9 uninvoked state; pick one and
      keep callers consistent so no caller references a removed symbol.
- [ ] `window.IptvUi` no longer exports `rndCats` or `rstFlt`; all remaining
      exports (rndSide, rndSort, onSort, rndHead, rndAcct, rndTheme, onTheme,
      the account/preset members, etc.) are intact.
- [ ] `index.html`: the `<span class="genre-chip" id="genre-chip" hidden>` and
      its comment are removed from `.content-head`; the rest of `.content-head`
      (on-air badge, `#now-info`, `#fmt-chips`, theme toggle, account button)
      and the `#grp-nav` sidebar container are unchanged. The file's `ADR:`
      comment drops `ADR-0018`.
- [ ] `client/app.css`: the `.cat-filter`, `#cat-filter`, `.cat-list`, and
      `.genre-chip` rules are removed; `.now-title` reverts to `flex: 1` and
      `.fmt-chips` drops the ADR-0018 `margin-left: auto` (back to pre-E9
      `flex: none`); the mobile rule reverts to `.sidebar-head, .sidebar-search
      { display: none; }` (drop `.cat-filter`). The file's `ADR:` comment drops
      `ADR-0018`.
- [ ] `client/main.js`: still functions; if `rndHead` is kept invoked it stays
      called in `onConnRes`, otherwise that call is removed. The file's `ADR:`
      comment drops `ADR-0018`.
- [ ] After this task, NO file carries an `ADR: ADR-0018` comment and ADR-0018's
      `governs:` is `[]` (already set in spec; implement-agent confirms it is
      true). Shared `ADR:`/`governs:` lines keep every other ADR id intact.
- [ ] The demo cat-id fix in `client/api.js` (`ch.cat === cat.id`) is retained
      and re-attributed conceptually to ADR-0009 (api.js already carries
      `ADR: ADR-0009`; no comment change needed). Selecting a demo category
      still filters the grid to that category's non-empty channel set.

## Test requirements

- **Unit:** update the sidebar unit harness/tests (`tests/unit/side.test.js`)
  to assert the plain `rndSide` output: "All Channels" + per-category buttons in
  source order, "Favourites" present only when favs exist, correct counts, no
  filter input, no `#cat-list` wrapper. Follow R-0001 — verify against the
  baseline `#now-info`/`.content-head` HTML which attributes actually exist
  before asserting any mutation. The full `npx vitest run` suite must pass.
- **UI:** the **full** `npx playwright test` suite MUST pass (this is the
  regression gate for shared-window-scope client files). In demo mode, assert:
  the sidebar shows the plain category list with no "Filter genres…" input and
  no genre chip in the content-head; selecting a category filters the grid to a
  non-empty set; the ADR-0017 sort control still re-orders the grid; the
  ADR-0019 theme toggle still flips light/dark; the account panel + community
  presets still open and switch; search still filters; favourites still toggle.
  Capture a screenshot of the restored plain sidebar + content-head (no chip)
  for the PR Test Results block.
- **Integration:** n/a — client-only UI/logic removal; no new external
  connectivity (existing M3U/Xtream/demo tiers unchanged).

## Implementation notes

Restored the pre-E9 sidebar/header surgically against git `785cb61`, removing
only the ADR-0018 layer and preserving ADR-0017 sort, ADR-0019 theme toggle,
ADR-0013/0014 account panel, ADR-0016 presets, search, and favourites.

Files touched:

- `client/ui.js`: dropped `ADR-0018` from the header `ADR:` line; removed the
  `EL.gchp` slot + its `getElementById('genre-chip')` init and the
  `EL.nav` `input` listener (`onFlt`); removed the module-level `flt` var and
  the `onFlt`, `mkPin`, `mkCats`, `rndCats`, `rstFlt` members; reverted
  `rndSide` to the plain form (All Channels + optional Favourites + per-source
  category buttons in delivery order, written straight into `EL.nav` — no
  `#cat-list` wrapper, no filter input); reverted `rndHead` to the
  name-only body (no chip); removed the three `rstFlt()` call sites (`onOk`,
  `onSwOk`, `tearDown`); dropped `rndCats`/`rstFlt` from `window.IptvUi`.
  `getCatId`/`getCatName`/`mkCatBtn` (pre-ADR-0018) kept. `rndHead` stays
  invoked from its callers (the pre-E9 now-info update is harmless/correct).
- `client/main.js`: dropped `ADR-0018` from the header `ADR:` line; `rndHead`
  call in `onConnRes` retained (kept-invoked path).
- `index.html`: removed the `#genre-chip` span + its comment from
  `.content-head`; dropped `ADR-0018` from the file's `ADR:` comment. On-air
  badge, `#now-info`, `#fmt-chips`, theme toggle, account button, and
  `#grp-nav` unchanged.
- `client/app.css`: removed `.cat-filter`/`#cat-filter`/`.cat-list`/
  `.genre-chip` rules; `.now-title` back to `flex: 1`; `.fmt-chips` back to
  `display: flex; gap: 4px; flex: none;` (dropped `margin-left: auto`); mobile
  rule back to `.sidebar-head, .sidebar-search { display: none; }`; dropped
  `ADR-0018` from the file's `ADR:` comment.

Tests:

- `tests/unit/genre.test.js`: the three ADR-0018 describe blocks marked
  `describe.skip` with a deferral note (full-file deletion is TASK-0041) — they
  assert behaviour that no longer exists by design, not a regression gate.
- `tests/ui/genre.test.js`: skipped the active-genre-chip test (`test.skip`);
  the two surviving tests (plain category-click grid filter + sort
  integration) remain live and now also assert the absence of `#cat-filter`,
  `#cat-list`, `#genre-chip` and capture `test-results/task-0040-plain-sidebar.png`.
- `tests/unit/side.test.js` unchanged — already asserts the plain `rndSide`
  output and passes.

Traceability: no file carries `ADR: ADR-0018`; ADR-0018 `governs: []` and
`status: deleted` confirmed (set by spec-agent; no decision-content edit made).
The demo cat-id fix in `client/api.js` (`ch.cat === catSlug(grp)`) is retained
under `ADR: ADR-0009` (no comment change needed).

Suites: `npx vitest run` → 441 passed, 7 skipped. `npx playwright test` →
133 passed, 1 skipped. Verified in demo mode that the plain category list,
category-click grid filter, sort control, theme toggle, account panel +
presets, search, and favourites all still work.

Note (out of scope): running the Playwright suite clears the committed
`test-results/genre-chip.png` (its generating test is now skipped, so it is
not regenerated). That screenshot belongs to the deleted chip feature and its
full removal is part of TASK-0041's cleanup.
