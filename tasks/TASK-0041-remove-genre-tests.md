---
id: TASK-0041
adr: ADR-0018
evolution: 11
status: pending
attempts: 0
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

_Filled by implement-agent. Run a repo-wide grep for the ADR-0018 tokens listed
above as the final audit; report it in the task notes._
