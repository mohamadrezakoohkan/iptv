---
id: TASK-0078
adr: ADR-0037
evolution: 22
status: done
attempts: 1
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

**Files touched**

- `src/client/api.js` — added the best-effort VOD fetch wiring inside the
  existing `runApi` IIFE, mirroring the `loadEpg` block:
  - `loadVod(opts)` — the connect-flow entry point. Guards `hasVod()`
    (`window.IptvVod` present), `clear()`s the store, then dispatches by path:
    demo → `runDemoVod` (one synthesized movie, no network, no series); M3U →
    no-op (store empty); Xtream → `runXtVod`. Fires `opts.onDone` (re-render
    hook). Never throws (try/catch returns a Result), never touches `ST.phase`.
  - `runXtVod` → `runXtMovs` (`get_vod_categories` + `get_vod_streams` →
    `window.IptvVod.setMovs(getMovs(...))`) and `runXtSers`
    (`get_series_categories` + `get_series` → `setSers(getSers(...))`). All
    through the **existing** `mkPxUrl` proxy + `loadJson` (15 s timeout) via the
    `loadVodAct` helper, which returns `[]` on any per-call failure so an empty
    portal degrades to an empty store.
  - `loadSerInfo(opts)` — on-demand per-series episode loader:
    `get_series_info&series_id=<id>` (new `mkSerInfUrl` builder, same proxy),
    normalized via `getEpis`, stored via `setEpis`. **Idempotent** — returns
    early when episodes for that id are already stored, so re-opening neither
    refetches nor duplicates. Best-effort: a non-ok / rejected fetch is
    swallowed (empty episodes for that id). Series display name comes from
    `opts.name`, else `getSerName(id)` resolving the stored `Series` browse list.
  - Demo VOD constants (`DEMO_VOD_CAT/_ID/_NAME`) + `mkDemoVod` build the single
    offline-playable demo movie whose `url` is `DEMO_SRC1` (a public HLS test
    stream the demo channels use).
  - Extended the file's `ADR:` comment with `ADR-0037`; added `loadVod` +
    `loadSerInfo` to the `window.IptvApi` export.
- `src/tests/unit/vodfetch.test.js` — **new** unit suite (mirrors
  `epgfetch.test.js`): loads `api.js` on a window carrying a real `IptvVod`
  store (so normalizers run end-to-end) with mocked fetch. Covers the Xtream
  movie+series populate, movie/series normalization (built URL, resolved grp,
  no series `url`), store-clear, `onDone`, swallowed failure/empty/non-ok
  (store stays empty, Result ok, no throw), missing-store no-op, demo single
  movie, M3U empty store, and `loadSerInfo` fetch+normalize+store + idempotency
  + name resolution + swallowed failure + missing-store no-op.
- `src/tests/unit/api.test.js` — updated the export-surface assertion to include
  `loadSerInfo` + `loadVod`; added `ADR-0037` to its comment.
- `src/tests/int/vod.test.js` — **new** integration suite against the live
  Xtream testing portal through the in-process proxy: asserts the connect Result
  keeps its unchanged live shape (no `vod`/`movies`/`series` on it), the VOD
  pass completes leaving only well-shaped `Vod`/`Series` items (≥ 0,
  best-effort), built `/movie/` and `/series/` on-demand URL forms, and
  on-demand `get_series_info` shape. Shape/connectivity assertions, not exact
  content.
- `docs/adrs/ADR-0037-...md` — `governs:` trued up with the new
  `src/tests/unit/vodfetch.test.js` (traceability only, no decision content).

**Non-obvious**

- This task is `src/client/api.js` only (the data + fetch layer + export). The
  `goVod`/`onOk` wiring in `ui.js` and the toggle/cards are ADR-0038, so the
  connect flow does not yet call `loadVod` — it is exposed as the entry point
  for ADR-0038, exactly as `loadEpg` was exposed before its `goEpg` wiring.
- Integration tier is **environment-red** in this sandbox: no live outbound
  network, so `connect` to `mymax.top` fails in `beforeAll`. The pre-existing
  `src/tests/int/xtream.test.js` fails identically against the same portal —
  this is the documented live-network red-environment tolerance, not a defect.
  The unit suite (`npx vitest run`, 873 → 889 tests) is fully green and
  network-free.
- `getEpis` flattens season→episode with the `series` URL form and the
  `"<series> · S<season>E<episode> <title>"` name (TASK-0077 helper, unchanged).
