---
id: TASK-0078
adr: ADR-0037
evolution: 22
status: pending
attempts: 0
depends_on: [TASK-0077]
---

# TASK-0078 — Best-effort VOD/series fetch wired after Xtream connect

## Goal

Wire a best-effort, non-blocking VOD fetch into `src/client/api.js` (mirroring
the EPG `loadEpg` pass). After a successful Xtream connect it fetches movie
VOD (`get_vod_categories` + `get_vod_streams`) and series (`get_series` +
`get_series_categories`), normalizes them via the TASK-0077 helpers, and
populates `window.IptvVod`; it exposes an on-demand per-series episode loader
(`get_series_info&series_id=<id>`). The demo connect path synthesizes one
offline-playable `Vod` movie. M3U/demo (beyond the demo movie) leave the VOD
store empty. After this task the data is available to the UI; no UI yet.

## Acceptance criteria

- [ ] A best-effort VOD pass (e.g. `loadVod`, mirroring `loadEpg`) runs after a
      successful Xtream connect: it fetches `get_vod_categories` + `get_vod_streams`
      and `get_series` (+ `get_series_categories`) through the **existing**
      `/api/xtream` proxy via the existing `loadJson` (15 s timeout reused),
      normalizes results, and writes `window.IptvVod`. It **never throws, never
      changes `ST.phase`, never blocks browsing**; failure/empty/timeout is
      swallowed (empty VOD store), per `docs/specs/vod-library.md` §4.
- [ ] An on-demand per-series episode loader fetches
      `get_series_info&series_id=<id>` (best-effort, swallowed on failure),
      normalizes its `episodes` map into `Vod` episode items, and stores them on
      `window.IptvVod` keyed by `series_id` (idempotent — re-opening a series does
      not duplicate or refetch unnecessarily).
- [ ] The Xtream connect Result shape is **unchanged** (VOD is exposed only via
      `window.IptvVod`, like EPG via `window.IptvEpg`).
- [ ] The **demo** connect path synthesizes exactly one `Vod` movie under a demo
      VOD category whose `url` is a public HLS test stream (the kind demo channels
      use), per §6 — so a Movies tab + a playable VOD item are demonstrable
      offline. No demo series.
- [ ] The **M3U** connect path leaves `window.IptvVod` empty (no VOD concept).
- [ ] No new server route, no new localStorage key, no new state phase.
- [ ] `src/client/api.js` keeps/extends its `ADR:` comment line to include
      `ADR-0037`.

## Test requirements

- **Unit:** `src/tests/unit/api.test.js` (extend) — with mocked fetch: a
      successful Xtream connect populates `window.IptvVod` movies + series from
      mocked `get_vod_*` / `get_series` payloads; a VOD fetch failure/empty/timeout
      is swallowed and leaves browsing unaffected (store empty, no throw, `ST.phase`
      unchanged); the on-demand series-info loader normalizes + stores episodes;
      the demo path synthesizes one movie; the M3U path leaves the store empty.
      Honor R-0001.
- **UI:** n/a — not user-facing (no toggle/cards yet; those are ADR-0038 tasks).
- **Integration:** `src/tests/int/vod.test.js` — against the live Xtream testing
      portal (`docs/specs/integration-testing.md` Xtream tier): the VOD pass reaches
      `get_vod_streams` / `get_series` through the real proxy and either returns
      normalized items or degrades silently (document live-network/red-environment
      tolerance; the assertion is on shape/connectivity, not exact content).

## Implementation notes

_Filled by implement-agent._
