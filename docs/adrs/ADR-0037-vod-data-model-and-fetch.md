---
id: ADR-0037
title: Normalize Xtream VOD movies and series into a parallel on-demand Vod item shape fetched best-effort through the existing proxy
date: 2026-06-15
evolution: 22
status: accepted
governs:
  - src/client/api.js
  - src/client/vod.js
  - src/tests/unit/api.test.js
  - src/tests/unit/vod.test.js
  - src/tests/unit/vodfetch.test.js
  - src/tests/int/vod.test.js
---

# ADR-0037 — Normalize Xtream VOD movies and series into a parallel on-demand Vod item shape fetched best-effort through the existing proxy

## Context

E22 prompt: add a VOD (Movies & Series) library on the Xtream path. After
connect, fetch VOD movie categories/streams (`get_vod_categories` /
`get_vod_streams`) and TV series (`get_series`, then `get_series_info` for
seasons/episodes) **best-effort** through the existing `/api/xtream` CORS proxy,
**normalize each into a canonical on-demand item schema mirroring `mkXtCh`**, and
build the Xtream on-demand stream URL (`/movie/<user>/<pass>/<id>.<ext>` for
movies, `/series/<user>/<pass>/<id>.<ext>` for episodes, **extension preserved**
so `getEng` resolves the same engine). M3U/demo show no VOD surface and degrade
silently; the demo path may synthesize one offline-playable VOD entry mirroring
the catch-up demo synthesis. Hard constraints: **no new server route, no new
playback engine, no new state-machine phase, no new localStorage key for
playback.**

This ADR decides the **data model + fetch**; ADR-0038 decides the **toggle UX +
playback wiring**. Prior patterns constrain it:

- `mkXtCh` / `getXtChs` / `mkInfUrl` / `mkPxUrl` / `loadJson` (`src/client/api.js`,
  ADR-0009) already fetch + normalize Xtream live data through the proxy with a
  15 s `AbortController` timeout. VOD reuses exactly that fetch machinery and
  normalization style.
- The EPG fetch (`loadEpg` / `runXtEpg`, ADR-0030) proves the **best-effort,
  non-blocking, swallow-on-failure** posture: it runs after connect, writes a
  store global (`window.IptvEpg`), never throws, never changes `ST.phase`, never
  blocks browsing. VOD mirrors this with its own `window.IptvVod` store.
- The live `Ch` schema (CONVENTIONS §7) is `{ id, name, grp, url, img, cat, num,
  arch, archDur }`. ADR-0035 extended it with optional fields. On-demand items
  carry fields a live channel never has, so a **parallel shape** keeps `Ch`
  clean.

## Decision

Add VOD data + fetch in `src/client/api.js` plus a dedicated VOD store module
`src/client/vod.js` exposing `window.IptvVod`. The live `Ch` type is unchanged.
No new server route, no new engine, no new state phase, no new localStorage key.

### Parallel on-demand item shape (`Vod`) and series browse shape (`Series`)

```
/** @typedef {{ id, name, grp, url, img, cat, num, kind:'movie'|'episode' }} Vod */
/** @typedef {{ id, name, grp, img, cat }} Series */
```

`Vod` mirrors the render/play-relevant `Ch` fields (so `mkCard` and the
select+play path consume it unchanged) plus a `kind` discriminator. `Series` is a
browse-only entry (no `url`) that drills into episodes. Full schema:
`docs/specs/vod-library.md` §1–2.

### On-demand stream URL builders (`src/client/api.js`)

Pure helpers build, mirroring `mkXtCh`'s live form:

- movie → `<base>/movie/<user>/<pass>/<stream_id>.<ext>`
- episode → `<base>/series/<user>/<pass>/<episode_id>.<ext>`

`<ext>` is the item's `container_extension` when present, else the account live
extension (`getExt`, ADR-0009) — **preserved** so `getEng` resolves the same
engine with no new branch. Full URL rules: `docs/specs/vod-library.md` §3.

### Best-effort fetch (`src/client/api.js` + `src/client/vod.js`)

After a successful Xtream connect, a best-effort VOD pass (mirroring `loadEpg`)
fetches `get_vod_categories` + `get_vod_streams` (→ `Vod` movies) and
`get_series` + `get_series_categories` (→ `Series` entries) through the existing
proxy/`loadJson`, normalizes them, and writes `window.IptvVod`. Seasons/episodes
are fetched **on demand** per series via `get_series_info&series_id=<id>`
(normalized into `Vod` episodes). It never throws, never changes `ST.phase`,
never blocks browsing; failure/empty/timeout is swallowed (empty VOD store). The
store is empty on M3U/demo connect. Full fetch contract: `docs/specs/vod-library.md`
§4.

### Demo synthesizes one offline-playable movie

The demo connect path synthesizes a single `Vod` movie whose `url` is a public
HLS test stream, surfaced under a demo VOD category, so the toggle + a playable
VOD item are demonstrable offline with no live network (mirroring ADR-0036's demo
synthesis). No demo series. Full rules: `docs/specs/vod-library.md` §6.

## Consequences

**Easier:**
- Reuses `loadJson`, the proxy, `getBase`/`mkPxUrl`, `getExt`, and the
  best-effort/non-blocking EPG-fetch posture verbatim — the prompt's "reuse the
  existing proxy + Xtream fetch pattern" mandate is satisfied literally.
- The parallel `Vod` shape mirrors `Ch` for render/play, so the grid card and
  select+play path (ADR-0038) consume it without change; the live `Ch` type stays
  clean of on-demand-only fields.
- Extension-preserving URLs mean engine resolution is free — no new engine, no
  new `loadPlay` branch.

**Harder:**
- A second fetch fan-out (movies + series, plus on-demand series-info) must stay
  bounded and best-effort so a large portal is not hammered and a slow/absent VOD
  endpoint never blocks live browsing.
- Episodes are nested in `get_series_info`'s `episodes` map; normalization must
  flatten season→episode with stable ids and the `series` URL form.

**Ruled out:**
- New optional fields on `Ch` for on-demand data (the parallel `Vod` shape keeps
  `Ch` clean — unlike ADR-0035's archive fields, on-demand items are a distinct
  domain, not a capability flag on a live channel).
- A new server route, a VOD-specific playback engine, a new state phase, or a new
  localStorage key (all forbidden by the prompt).
- Eager per-series episode fetching (on-demand `get_series_info` only).

## Tasks derived

- TASK-0077 — `Vod`/`Series` normalizers, on-demand URL builders, and the
  `window.IptvVod` store module (`src/client/vod.js`); pure unit-tested.
- TASK-0078 — Best-effort VOD/series fetch wired after Xtream connect (movies +
  series + on-demand series-info), populating `window.IptvVod`; demo synthesizes
  one offline-playable movie. Integration-tested against the live portal.

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0037` comment near the top.
When a change removes the last governed code, this ADR is marked `status:
deleted` — the file itself is never removed; it is history.
