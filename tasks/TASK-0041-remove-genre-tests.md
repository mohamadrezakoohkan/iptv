---
id: TASK-0041
adr: ADR-0018
evolution: 11
status: done
attempts: 1
depends_on: [TASK-0040]
---

# TASK-0041 — Remove the dedicated ADR-0018 test files + final cleanup audit

## Goal

The dedicated ADR-0018 test files are gone and the test suites no longer
exercise any removed behaviour, while every surviving feature stays covered.
This is the final cleanup pass: the genre-specific unit and UI test files are
deleted, any remaining stale ADR-0018 references in tests are removed, and the
full unit + UI suites pass green with no orphaned references.

## Acceptance criteria

- [ ] `tests/unit/genre.test.js` is deleted (it tested the removed
      filter-input / chip behaviour).
- [ ] `tests/ui/genre.test.js` is deleted (it tested the removed genre filter,
      chip, and genre-grid filtering UI). Any screenshot artifacts it produced
      (`test-results/genre-filter.png`, `test-results/genre-chip.png`) are no
      longer referenced.
- [ ] No test file references `getCats`, `catFltMin`, `rndCats`, `rstFlt`,
      `#cat-filter`, `cat-filter`, `cat-list`, or `genre-chip` any more (grep
      across `tests/` returns nothing for these tokens). Surviving ADR-0017
      sort tests, ADR-0009/0005 category-filter tests, account, preset, theme,
      search, and favourites tests are untouched and still pass.
- [ ] `client/app.css`'s test (`tests/ui/css.test.js`) and any other test that
      asserted ADR-0018 styles/markup is updated to match the restored markup
      (no assertions on removed selectors).
- [ ] No source or test file carries an `ADR: ADR-0018` comment anywhere in the
      repo (final repo-wide grep is empty).

## Test requirements

- **Unit:** the full `npx vitest run` suite passes with the ADR-0018 unit test
  file removed and no dangling references; the count drops by the removed tests
  only. No surviving assertion is weakened.
- **UI:** the full `npx playwright test` suite passes with the ADR-0018 UI test
  file removed; all surviving UI specs (sort, theme, account, preset, sidebar,
  grid, search, fallback, chips, smoke) still pass.
- **Integration:** n/a — no external connectivity touched.

## Implementation notes

Final ADR-0018 test cleanup (no behaviour change — cleanup only).

Files removed:
- `tests/unit/genre.test.js` — deleted wholesale. All 7 tests were
  `describe.skip` blocks asserting removed ADR-0018 behaviour (pinned
  All/Favourites ordering, source-order genre buttons, the active-genre chip).
  No surviving coverage lost: source-order/pinned `rndSide` rendering is already
  covered by `tests/unit/side.test.js` (labels, counts, both cat shapes) and
  `tests/ui/sidebar.test.js` (All Channels pinned, active class, badge, click).
- `tests/ui/genre.test.js` — deleted; its surviving content moved to a renamed
  file (below); only the `test.skip` active-genre-chip test was dropped.

Files added:
- `tests/ui/sidebar-filter.test.js` — the two surviving UI tests from the old
  `tests/ui/genre.test.js`, verbatim ("genre" was a misnomer post-removal): the
  plain category-click grid filter (regenerates
  `test-results/task-0040-plain-sidebar.png`) and the category-filter + ADR-0017
  sort integration test. The skipped chip test was not carried over. Header
  ADR comment re-attributed to ADR-0009 / ADR-0017. The `#cat-filter`,
  `#cat-list`, `#genre-chip` mentions in this file are intentional NEGATIVE
  assertions (`toHaveCount(0)`) that prove the removed ADR-0018 affordances stay
  gone — they are the regression gate, not live references.

Files edited:
- `tests/unit/themetoggle.test.js` — removed the orphaned `'genre-chip'` id from
  the `mkEl` stub list (TASK-0040 removed that element from the markup; the stub
  was a dead reference).

Audit:
- `test-results/genre-chip.png` was already absent from disk and never tracked
  in git (its generating test had been skipped, so it was not regenerated). No
  `git rm` needed; criterion satisfied.
- ADR-0018 already carried `governs: []` and `status: deleted` (set by
  TASK-0039/0040) — no traceability edits made by this task.
- Repo-wide grep `ADR: ADR-0018` traceability tags: ZERO matches across
  `*.js` / `*.css` / `*.html`.
- Token grep across `client/ server/ tests/` for
  `getCats|catFltMin|cat-filter|cat-list|genre-chip|rndCats|rstFlt|ADR-0018`:
  the only remaining matches are (a) a descriptive comment in `client/ui.js`
  noting the restored sidebar has NO filter input / `#cat-list` wrapper, and
  (b) the negative-assertion comments + `toHaveCount(0)` locators in
  `tests/ui/sidebar-filter.test.js`. No live ADR-0018 code or traceability tag
  remains anywhere (the retained `adrs/ADR-0018-*.md` history file, CHANGELOG,
  specs, and task records excluded by design).

Suites run locally: `npx vitest run` → 19 files, 441 tests, all pass, 0 skipped.
`npx playwright test` → 133 tests, all pass, 0 skipped.
