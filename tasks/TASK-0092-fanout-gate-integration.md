---
id: TASK-0092
adr: ADR-0041
evolution: 24
status: pending
attempts: 0
depends_on: [TASK-0090]
---

# TASK-0092 — Integration: the fan-out gate is data-driven from the live portal's advertised `max_connections`

## Goal

Against the live Xtream integration tier (`docs/specs/integration-testing.md`),
prove the gate reads the **real** portal's advertised connection capacity and
makes the fan-out decision from it — closing the loop on the regression with a
real-network assertion (not a mock). This is the regression that broke against a
real single-connection portal, so a live assertion is warranted.

## Acceptance criteria

- [ ] A new integration spec `src/tests/int/fanout-gate.test.js` connects to the
      live Xtream portal via the in-process proxy (same harness as
      `src/tests/int/epg.test.js` / `xtream.test.js`) and asserts the connect
      Result carries a numeric, non-negative `maxConns` read from the live
      `user_info.max_connections`.
- [ ] The gate decision is asserted to be **data-driven**, branching on the live
      `maxConns` value:
      - if the live portal advertises `maxConns === 1`: running `loadEpg` /
        `loadVod` for that source issues **no** `get_simple_data_table` /
        `get_vod_*` / `get_series*` requests (the stores stay empty);
      - if it advertises `maxConns > 1` (or unknown): the fan-out runs and at
        least the bounded EPG/VOD requests are observed.
      The spec must handle whichever capacity the live account actually
      advertises (read it, then assert the matching branch) — it must not
      hard-code an assumed capacity.
- [ ] The live live-stream reachability assertion (a single live `.ts`/stream
      request returns a success/redirect, not 404) holds **after** the gated
      `loadEpg`/`loadVod` for the single-connection case — proving playback is
      not starved. Use the bounded-sampling tolerance posture already documented
      for the live tiers (`docs/specs/integration-testing.md`); a transient live
      anomaly within tolerance is not a hard fail.
- [ ] If the integration command / live network is unavailable, the suite skips
      this tier per the existing harness convention (it is not a hard fail of
      the run — validate-agent notes the omission).

## Test requirements

- **Unit:** n/a — TASK-0089 / TASK-0090 cover the logic with mocks; this is the
  live-network proof.
- **UI:** n/a — TASK-0091 covers the browser flow.
- **Integration:** the live data-driven gate assertion above, runnable via
  `npx vitest run --config vitest.int.config.js`. Follow the existing live-tier
  patterns (in-process `rtr.js` proxy, `mkApi`-style client load, bounded
  sampling, documented tolerances).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
