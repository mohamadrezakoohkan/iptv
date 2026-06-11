---
id: TASK-0016
adr: ADR-0007
evolution: 3
status: done
attempts: 1
depends_on: [TASK-0014]
---

# TASK-0016 — Sampled stream reachability integration test

## Goal

`tests/int/strm.test.js` exists and proves the stream URLs the engine
extracts from the live iptv-org playlist are real, loadable HLS streams:
it parses the live playlist, samples 5 stream URLs deterministically
(indices at 0 %, 25 %, 50 %, 75 %, 100 % of the channel list), fetches each
with a 15 s timeout, and passes when **at least one** returns an HTTP 2xx
response whose body starts with `#EXTM3U` (a genuine HLS manifest). This is
the ADR-0007 anti-flakiness policy: no single public channel is ever
load-bearing.

## Acceptance criteria

- [ ] `tests/int/strm.test.js` exists, carries `// ADR: ADR-0007` near the
      top, and obtains the channel list from the live playlist (via the
      in-process proxy + `parsM3u`, or the engine `connect` path — either
      is acceptable; the source must be live, not a fixture).
- [ ] The sample is deterministic: 5 indices spread evenly across the
      channel list (first, 25 %, 50 %, 75 %, last) — no randomness.
- [ ] Each sampled URL is fetched with native `fetch` and a 15 s
      per-stream `AbortController` timeout; per-stream failures (network
      errors, timeouts, non-2xx) are caught and recorded, never thrown.
- [ ] The test asserts that the count of sampled streams returning HTTP
      2xx with a body starting with `#EXTM3U` is `>= 1`.
- [ ] On failure and success alike, the per-stream outcomes (URL, status
      or error) are included in the assertion message or logged output so
      a red run is diagnosable.
- [ ] Constants (sample size 5, timeout 15000, success threshold 1) are
      file-level SCREAMING_SNAKE constants (RULE-ID-7), not magic literals.
- [ ] All code follows CONVENTIONS.md: named functions only, max 2 params,
      `===`, no new dependencies.
- [ ] The full unit, UI, and integration suites pass (live network
      required for the integration suite).

## Test requirements

- **Unit:** none new — this task adds an integration test only; existing
  unit suite must stay green.
- **UI:** n/a — not user-facing.
- **Integration:** `tests/int/strm.test.js` as specified in the acceptance
  criteria — live sampled stream reachability with the ≥ 1-of-5 pass
  criterion.

## Implementation notes

- Files touched: `tests/int/strm.test.js` (new, only file changed).
- Channel list is obtained via the engine `connect` path (in-process Express
  server + `client/api.js` IIFE with the same fetch shim / `loadApi` harness
  pattern as `tests/int/m3u.test.js`), so the live source is the full engine
  chain, not a fixture.
- Constants per RULE-ID-7: `SMPL_CNT = 5`, `STRM_MS = 15000`, `MIN_OK = 1`,
  plus `LIVE_URL`. Sample indices: `Math.round((i / (SMPL_CNT - 1)) *
  (chs.length - 1))` for i = 0..4 → exactly first, 25 %, 50 %, 75 %, last.
- `loadStrm(url)` returns a RULE-FN-4 Result and never throws: non-2xx,
  network errors, aborts, and 2xx-but-not-`#EXTM3U` bodies all become
  `{ ok: false, err }`. The `AbortController` timeout also bounds `.text()`
  on endless (non-manifest) 2xx byte streams, so no stream can hang the test
  past 15 s.
- The 5 fetches run in parallel (`Promise.all`) — worst case ~15 s, well
  under the 120 s test timeout; file-level parallelism is already off in
  `vitest.int.config.js` so the public endpoint is not hammered.
- Per-stream outcomes are both `console.log`ged and embedded in the
  assertion message (vitest `expect(value, message)`), so red and green runs
  are diagnosable. Verification run: 3/5 sampled streams live, all suites
  green (unit 206, UI 66, integration 10).
