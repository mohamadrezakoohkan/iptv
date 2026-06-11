---
id: TASK-0020
adr: ADR-0008
evolution: 4
status: pending
attempts: 0
depends_on: [TASK-0017, TASK-0018, TASK-0019]
---

# TASK-0020 — Remove the `isM3u` auto-detect heuristic entirely

## Goal

No auto-detection code remains anywhere. With every caller (footer,
reconnect, tests) now stating the mode explicitly, the transitional
heuristic fallback from TASK-0017 is deleted: `isM3u` is removed from
`client/api.js`, from the `window.IptvApi` export object, and from all
tests; `connect()` with `opts.m3u` absent defaults to the Xtream path
(after the demo check).

## Acceptance criteria

- [ ] `client/api.js` contains no `isM3u` function and no URL-shape
      detection logic; `window.IptvApi.isM3u` is `undefined`.
- [ ] `connect(src, { user: '', pass: '' })` (flag absent) takes the Xtream
      path for any non-demo URL, including credential-less plain http(s)
      URLs that the old heuristic would have routed to M3U.
- [ ] `connect('demo', {})` still resolves the demo playlist.
- [ ] No reference to `isM3u` remains anywhere in `client/`, `tests/`, or
      `index.html` (grep-clean), except historical mentions in
      `adrs/`/`tasks/` records.
- [ ] Full unit, UI, and integration suites pass — proving no caller still
      depended on the heuristic.
- [ ] ADR-0008 `governs:` trued up; ADR-0005 remains `superseded` (its
      surviving parse/proxy code is governed by ADR-0008 — do not mark it
      `deleted`).

## Test requirements

- **Unit:** `IptvApi` export surface has no `isM3u`; absent-flag routing
  defaults to Xtream (mocked fetch shows `player_api.php` is called for a
  credential-less plain URL); demo unaffected; remaining heuristic unit
  cases in `tests/unit/api.test.js` removed or rewritten as explicit-flag
  cases.
- **UI:** regression only — full Playwright suite passes, including the
  TASK-0018 no-auto-detect scenarios (no new user-facing behavior in this
  task).
- **Integration:** regression only — full integration suite passes with the
  explicit `m3u: true` calls from TASK-0017; no new integration tests.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
