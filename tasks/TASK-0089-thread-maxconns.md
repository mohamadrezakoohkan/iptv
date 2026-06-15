---
id: TASK-0089
adr: ADR-0041
evolution: 24
status: done
attempts: 1
depends_on: []
---

# TASK-0089 — Thread `maxConns` from the no-action auth payload through the Xtream connect Result

## Goal

`loadXtream` (`src/client/api.js`) reads the portal's advertised connection
capacity from the no-action `player_api.php` payload it already fetches and adds
it to the Xtream connect Result as `maxConns`, so the post-connect fan-out
(TASK-0090) can make a data-driven gating decision. No behavior changes yet —
this task only surfaces the field. The M3U and demo Results are unchanged (no
`maxConns`).

## Acceptance criteria

- [ ] A pure helper coerces `user_info.max_connections` to a non-negative
      integer: a numeric/string `"1"` → `1`, `"2"` → `2`; missing, `null`, `0`,
      `""`, or unparseable → `0` (the "unknown" sentinel).
- [ ] `loadXtream`'s success Result value carries `maxConns` set from that
      helper, read from the same no-action payload already used for `hasAuth` /
      `getExt`. The rest of the connect value shape (`server`, `host`, `user`,
      `categories`, `channels`) is unchanged.
- [ ] The demo Result (`loadDemo`) and the M3U Result (`loadM3u`) do **not**
      carry `maxConns` (absent = unknown).
- [ ] `src/client/api.js` carries an `ADR: ADR-0041` comment in its top ADR
      reference line.

## Test requirements

- **Unit:** in `src/tests/unit/api.test.js`, with a mocked `fetch`: (a) the
  coercion helper / `loadXtream` returns `maxConns: 1` for a payload with
  `user_info.max_connections: 1` (and `: "1"`), `maxConns: 2` for `2`,
  `maxConns: 0` for missing / `0` / `"x"`; (b) the connect value still carries
  the expected `channels`/`categories`; (c) a demo connect and an M3U connect
  Result have no `maxConns` field. Follow the existing `api.test.js` fetch-mock
  pattern.
- **UI:** n/a — not user-facing (no visible behavior change in this task).
- **Integration:** n/a — covered by TASK-0092 against the live tier; this task
  asserts only payload-shape coercion, fully unit-testable with a mock.

## Implementation notes

Files touched:

- `src/client/api.js` — added a pure `getMaxConns(inf)` helper that coerces
  `inf.user_info.max_connections` via `Math.trunc(Number(...))`, returning the
  value only when finite and `> 0`, else `0` (the "unknown" sentinel). This
  collapses missing / null / `0` / `""` / unparseable all to `0`, and trims
  fractional values. `loadXtream` now reads it from the same no-action payload
  already used for `hasAuth` / `getExt` and adds `maxConns` to the success
  Result `val` (after the existing `server`, `host`, `user`, `categories`,
  `channels` — shape otherwise unchanged). Top ADR comment line gained
  `ADR-0041`.
- `src/tests/unit/api.test.js` — new `describe('Xtream connect maxConns
  (ADR-0041)')` block: boundary coercion (1, "1", 2, "2", missing, null, 0, "",
  "x"), a "channels/categories still present alongside maxConns" assertion, and
  two absence assertions (`'maxConns' in val` is `false` on the demo and M3U
  Results). Top ADR comment line gained `ADR-0041`.

Non-obvious for future tasks:

- This task only THREADS the field. The gate semantics (`1` → single-conn;
  `>1` → multi; `0`/absent → unknown → run the fan-out) are documented in
  `getMaxConns`'s JSDoc but enforced by TASK-0090, not here.
- The demo and M3U Result values deliberately omit the key entirely (absent =
  unknown), so consumers must treat `val.maxConns === undefined` the same as the
  `0` sentinel. Tests assert absence via the `in` operator rather than `=== 0`.
- `loadXtream` does not return `ext` (it is consumed internally via `vodAcct`),
  so do not assume `val.ext` exists on the Xtream path — unchanged by this task.

ADR-0041 `governs:` already listed both touched files; no traceability edit
needed. Full unit suite green (1038 passed, 12 new for this task). No commits
made.
