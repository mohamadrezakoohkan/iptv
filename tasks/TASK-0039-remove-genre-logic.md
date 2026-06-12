---
id: TASK-0039
adr: ADR-0018
evolution: 11
status: done
attempts: 1
depends_on: []
---

# TASK-0039 — Remove the ADR-0018 genre helpers + restore source-order categories

## Goal

The ADR-0018 genre logic layer is gone: `client/srch.js` no longer exports
`getCats` and no longer carries the `catName` / `cmpCat` helpers; the sidebar's
category data is the source's categories in the source's own delivery order
(pre-E9 behaviour). The ADR-0017 sort helpers (`SORTS`, `getChs`, `sortChs`,
`cmpNum`, `cmpName`, `cmpFav`) and their behaviour are untouched. This removes
ADR-0018's logic surface ahead of the UI removal (TASK-0040).

## Acceptance criteria

- [ ] `window.IptvSrch.getCats` no longer exists; `window.IptvSrch` exports
      exactly `{ getChs, SORTS }` (ADR-0017 surface preserved).
- [ ] `catName` and `cmpCat` are removed from `client/srch.js`.
- [ ] `getChs` is unchanged in signature and behaviour — same five params
      (`chs, q, flt, favs, sort`), same filter + ADR-0017 sort, still pure.
- [ ] `client/srch.js`'s `ADR:` comment lists `ADR-0001, ADR-0017` (ADR-0018
      removed); the file is no longer listed in any ADR's `governs:`.
- [ ] `client/cfg.js`: the `catFltMin` constant is removed from `S`; the file's
      `ADR:` comment drops `ADR-0018` (keep `ADR-0001, ADR-0003, ADR-0013,
      ADR-0015, ADR-0017, ADR-0019`). All other `S` keys (sortKey, themeKey,
      psts, etc.) are unchanged.
- [ ] ADR-0018 `governs:` no longer lists `client/srch.js` or `client/cfg.js`
      (traceability true-up; ADR-0018 already marked `status: deleted` in spec).

## Test requirements

- **Unit:** remove the `getCats — filter + ordering` describe block from
  `tests/unit/srch.test.js` (it tests deleted behaviour). The surviving
  `getChs` / SORTS / sort-comparator unit tests in that file (ADR-0017) MUST
  remain and keep passing. Remove the `getCats` stub and `catFltMin` from any
  shared unit harness (`side.test.js`, `foot.test.js`, `persist.test.js`,
  `acctui.test.js`, `themetoggle.test.js`) only where it is no longer read by
  production code — do NOT weaken any surviving assertion; only trim now-dead
  mock surface. The full `npx vitest run` suite must pass.
- **UI:** n/a — pure logic; the user-facing removal is verified in TASK-0040's
  full UI suite. (No UI test is added by this task.)
- **Integration:** n/a — no external connectivity.

## Implementation notes

Attempt 1 — implemented, both suites green (unit 448 pass, UI 134 pass).

Production changes:
- `client/srch.js`: removed `getCats`, `catName`, `cmpCat`; export is now
  `window.IptvSrch = { getChs, SORTS }`. Top `ADR:` comment trimmed to
  `ADR-0001, ADR-0017` (ADR-0018 dropped). ADR-0017 sort layer (`SORTS`,
  `getChs`, `sortChs`, `cmpNum`, `cmpName`, `cmpFav`) untouched.
- `client/cfg.js`: removed `catFltMin` from `S`; top `ADR:` comment trimmed to
  `ADR-0001, ADR-0003, ADR-0013, ADR-0015, ADR-0017, ADR-0019` (ADR-0018
  dropped). All other `S` keys unchanged.
- `client/ui.js` (minimal caller fix to keep runtime/UI green — see Coordination
  below): `mkCats` no longer calls `window.IptvSrch.getCats`; it iterates
  `opts.cats` directly, restoring the source's own delivery order for the
  category buttons. The pinned All/Favourites buttons and the per-category count
  are unchanged. This severs the only production consumer of the removed helper.

Coordination with TASK-0040 / TASK-0041:
- The genre-filter `<input id="cat-filter">` markup, the view-local `flt`
  variable, `onCatFlt`/`rndCats`/`rstFlt`, the `#genre-chip` markup, and the
  `IptvUi` exports of `rndCats`/`rstFlt` REMAIN in `client/ui.js` — they are
  TASK-0040's UI-removal scope. With `catFltMin` gone, the
  `cats.length > window.S.catFltMin` guard in `rndSide` is now always false, so
  the filter input no longer renders (inert until TASK-0040 removes the markup).
  This is the "do not leave the runtime broken" sequencing the task required:
  the helper is removed and its sole caller updated in the same pass.
- The demo cat-id fix in `client/api.js` (`ch.cat === cat.id`) is NOT touched —
  retained under ADR-0009.

Test changes:
- `tests/unit/srch.test.js`: removed the `getCats — filter + ordering` describe
  block and its `CATS` fixture; all ADR-0017 `getChs`/SORTS/sort-comparator/
  purity tests kept and passing. Top `ADR:` trimmed to `ADR-0001, ADR-0017`.
- `tests/unit/genre.test.js`: removed the two ADR-0018 assertions that test
  deleted behaviour (the `S.catFltMin` filter-input-presence block, and the
  `getCats` name-ascending ordering test). The ordering test was retargeted to
  assert source-order rendering. Pinned-buttons and `rndHead` chip tests kept
  (they cover surviving TASK-0040 markup and pass). Full file deletion remains
  TASK-0041's audit.
- `tests/ui/genre.test.js`: removed the three genre-filter-input UI tests
  (threshold presence, typing-narrows, clearing-restores) and the now-unused
  `bigSidebar` helper — they exercised the removed `getCats`/`catFltMin` filter.
  The active-genre chip, category browsing, and sort-integration tests kept and
  pass.
- Trimmed now-dead `getCats` stubs and `catFltMin: 12` mock keys from the shared
  unit harnesses (`side.test.js`, `foot.test.js`, `persist.test.js`,
  `acctui.test.js`, `themetoggle.test.js`) — no surviving assertion weakened;
  only dead mock surface removed.

Traceability: ADR-0018 `governs:` is already `[]` (set by spec-agent) and is
marked `status: deleted`. No file carries an `ADR: ADR-0018` comment after this
task. The other ADRs that legitimately govern `client/srch.js` (ADR-0001,
ADR-0017) and `client/cfg.js` (ADR-0001/0003/0013/0015/0017/0019) keep their
references.
