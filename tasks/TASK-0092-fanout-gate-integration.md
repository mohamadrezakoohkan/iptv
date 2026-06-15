---
id: TASK-0092
adr: ADR-0041
evolution: 24
status: done
attempts: 1
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

**Files touched**
- `src/tests/int/fanout-gate.test.js` (new) — the live data-driven gate proof.
  Already listed in ADR-0041 `governs:` (no ADR edit needed); carries the
  `ADR: ADR-0041` comment.

**How it works / non-obvious bits**
- Reuses the existing in-process-proxy harness (`express` + `src/server/rtr.js`
  on an ephemeral port) and the `mkApi` IIFE-eval pattern from
  `src/tests/int/epg.test.js`. Because `loadVod` needs `window.IptvVod`, `mkApi`
  here builds BOTH `IptvEpg` (via `mkEpg`) and `IptvVod` (via a new `mkVod`)
  onto the window before evaluating `api.js`.
- **Data-driven, no hard-coded capacity:** the spec reads `res.val.maxConns`
  from the live connect Result and branches on it. `maxConns === 1` → assert the
  gate fired (no fan-out actions issued, both stores empty); `> 1`/`0` → assert
  the bounded fan-out ran (≥ 1 fan-out action observed).
- **Flood-safe instrumentation:** the fetch shim records the decoded upstream
  `action=` of every `/api/xtream?url=…` call into a module-level `calls` array.
  `connect` issues exactly 3 (auth + `get_live_categories` + `get_live_streams`);
  on the single-connection branch the gated `loadEpg`/`loadVod` add ZERO
  fan-out actions (`get_simple_data_table` / `get_vod_*` / `get_series*`). No
  per-channel sampling loops are added.
- **One stream probe only:** exactly one live `.ts` request through the proxy
  (which follows the 302 server-side and pipes back the final status). The body
  is cancelled immediately after the status is read, so the stream is never
  downloaded. The regression signature is a 404 (starved/anti-flood); the test
  asserts `!= 404 && >= 200`. A transient network blip (caught) is tolerated per
  the bounded-sampling posture in `docs/specs/integration-testing.md`, not a
  hard fail. `PROBE_MS = 20000` gives generous headroom.
- The integration command (`npx vitest run --config vitest.int.config.js`) is
  already in `docs/specs/project.md`; no change needed.

**Self-check (single run):** `npx vitest run --config vitest.int.config.js
src/tests/int/fanout-gate.test.js` → 3/3 PASS in ~6.3 s. The sub-7-second
duration confirms the gate fired (the ~130-request fan-out did not run) — the
live account advertises `max_connections: 1`. Unit suite remains green (1052
tests). The full integration suite was deliberately NOT run (other int specs
call the fan-out actions directly and would flood the 1-connection portal).
