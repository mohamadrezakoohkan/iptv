---
id: TASK-0090
adr: ADR-0041
evolution: 24
status: done
attempts: 1
depends_on: [TASK-0089]
---

# TASK-0090 — Gate the bulk Xtream EPG/VOD fan-out on `maxConns`

## Goal

The connect-time bulk EPG/VOD fan-out respects the portal's advertised
connection capacity: on a single-connection Xtream portal (`maxConns === 1`) the
bulk `get_simple_data_table` burst (EPG) and the bulk movies+series calls (VOD)
are **skipped entirely**, so the single allowed connection stays free for live
playback. On a multi-connection or unknown portal the existing bounded fan-out
runs unchanged. The decision is threaded from the connect Result (TASK-0089)
through `goEpg` / `goVod` into `loadEpg` / `loadVod`. This is the fix for the E24
regression.

## Acceptance criteria

- [ ] `loadEpg(opts)` and `loadVod(opts)` accept a `maxConns` field in `opts`.
- [ ] When `maxConns === 1`: the **Xtream** EPG path (`runXtEpg`) and the
      **Xtream** VOD path (`runXtVod`) do **not** run — no `get_simple_data_table`,
      `get_vod_categories`, `get_vod_streams`, `get_series_categories`, or
      `get_series` request is issued (assert via fetch-mock call count / URLs).
      `loadVod` still clears the store; the EPG/VOD stores stay empty for that
      source.
- [ ] When `maxConns > 1` or `maxConns` is absent/`0`/`undefined` (unknown): the
      Xtream EPG and VOD fan-out runs exactly as before this task (same requests,
      same `EPG_BATCH`/`EPG_CAP` bounds) — no regression.
- [ ] The **demo** path (`runDemoEpg` / `runDemoVod`) and the **M3U** path
      (`runM3uEpg`; M3U VOD empty) run regardless of `maxConns` (they are never
      gated) — demo synthetic EPG/VOD and M3U XMLTV still populate.
- [ ] `loadSerInfo` (on-demand per-series info) is **not** gated — it remains
      callable (it is an explicit user action, not the connect-time burst).
- [ ] `onOk` and `onSwOk` (`src/client/ui.js`) and `onConnRes`
      (`src/client/main.js`) read `val.maxConns` from the connect Result and
      forward it into `goEpg` / `goVod`, which pass it into `loadEpg` /
      `loadVod`.
- [ ] `src/client/ui.js` and `src/client/main.js` carry an `ADR: ADR-0041`
      reference in their top ADR comment line.

## Acceptance criteria — regression guard

- [ ] On `maxConns === 1`, after connect the channel list still renders and a
      live channel can be selected and played (the connection is not consumed by
      the fan-out). Verified end-to-end in TASK-0091; this task asserts the
      no-fan-out request behavior at the unit tier.

## Test requirements

- **Unit:**
  - `src/tests/unit/epgfetch.test.js`: with a mocked `fetch`, `loadEpg({ src,
    user, pass, m3u:false, chs, maxConns:1 })` issues **zero**
    `get_simple_data_table` requests; with `maxConns:2` and with `maxConns`
    absent it issues them as today; demo (`maxConns:1`) still populates the
    synthetic guide; M3U (`maxConns:1`) still fetches the XMLTV guide.
  - `src/tests/unit/vodfetch.test.js`: with a mocked `fetch`, `loadVod({ …,
    m3u:false, maxConns:1 })` issues **zero** VOD/series requests and leaves the
    store empty (after `clear`); with `maxConns:2` / absent it fans out as today;
    demo (`maxConns:1`) still synthesizes its one movie; `loadSerInfo` still
    fetches regardless of `maxConns`.
- **UI:** covered by TASK-0091 (the connect→play flow on a single-connection
  portal); the wiring in `onOk`/`onSwOk`/`onConnRes` is exercised there.
- **Integration:** n/a here — TASK-0092 asserts the data-driven gate against the
  live tier.

## Implementation notes

**Files touched**

- `src/client/api.js` — added the pure gate predicate `isSingleConn(maxConns)`
  (`maxConns === 1`) next to `getMaxConns` (TASK-0089). Applied the gate at the
  two bulk-Xtream fan-out entry points only:
  - `runEpg`: after the demo and M3U branches, `if (isSingleConn(opts.maxConns))
    return;` skips `runXtEpg` entirely (zero `get_simple_data_table` requests).
  - `loadVod`: the Xtream branch condition became
    `o.m3u !== true && !isSingleConn(o.maxConns)`, so `runXtVod` is skipped. The
    store is still `clear()`ed first (acceptance criteria), so it stays empty for
    a single-connection source.
  The demo branch (`runDemoEpg`/`runDemoVod`), the M3U branch (`runM3uEpg`), and
  the on-demand `loadSerInfo` are deliberately left outside the gate.
- `src/client/ui.js` — `goEpg`/`goVod` now forward a `maxConns` field into
  `loadEpg`/`loadVod`; `onOk` and `onSwOk` read `val.maxConns` from the connect
  Result and pass it into `goEpg`/`goVod`. Added `ADR-0041` to the top comment.
- `src/client/main.js` — `onConnRes` forwards `res.val.maxConns` into `goEpg`.
  Added `ADR-0041` to the top comment.
- `src/tests/unit/epgfetch.test.js` — new `describe('loadEpg — single-connection
  gate (maxConns)')` block: `maxConns:1` ⇒ zero `get_simple_data_table` calls +
  empty store; `maxConns:2`/`5`/`0`/absent ⇒ fan-out runs unchanged; demo and
  M3U paths still run under `maxConns:1`.
- `src/tests/unit/vodfetch.test.js` — new `describe('loadVod — single-connection
  gate (maxConns)')` block: `maxConns:1` ⇒ zero `get_vod_*`/`get_series*` calls +
  empty store (after clear); `maxConns:2`/`5`/`0`/absent ⇒ fan-out runs; demo
  path still synthesizes its movie under `maxConns:1`; `loadSerInfo` fetches
  regardless of `maxConns`.

**Non-obvious**

- The gate is data-driven via the `maxConns` field added to the Xtream connect
  Result by TASK-0089. M3U/demo Results carry no `maxConns`, so those paths see
  `undefined` and `isSingleConn(undefined)` is `false` — but they have no Xtream
  burst to gate anyway, so behavior is identical to before.
- `loadVod` still calls `window.IptvVod.clear()` before the gated branch, so a
  single-connection source presents empty Movies/Series rather than stale data.
- ADR-0041 `governs:` already listed all five touched files (seeded by
  spec-agent); no `governs:` update was required.

**Out of scope / deferred**: UI wiring is exercised by TASK-0091, the live-tier
data-driven gate by TASK-0092 (not run here — the real portal is in cooldown).
