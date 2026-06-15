---
id: TASK-0089
adr: ADR-0041
evolution: 24
status: pending
attempts: 0
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

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
