---
id: TASK-0039
adr: ADR-0018
evolution: 11
status: pending
attempts: 0
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

_Filled by implement-agent. Note the demo cat-id fix in `client/api.js`
(`ch.cat === cat.id`) is NOT touched here — it is retained under ADR-0009
(TASK-0040 verifies category browsing still works in demo)._
