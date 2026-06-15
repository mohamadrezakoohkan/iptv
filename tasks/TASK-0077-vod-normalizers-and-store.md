---
id: TASK-0077
adr: ADR-0037
evolution: 22
status: pending
attempts: 0
depends_on: []
---

# TASK-0077 — Vod/Series normalizers, on-demand URL builders, and the IptvVod store

## Goal

Pure data layer for VOD: a new `src/client/vod.js` module exposing
`window.IptvVod` (an in-memory store for movies, series, and per-series episodes,
mirroring `window.IptvEpg`'s store shape), plus pure normalizers and on-demand
stream-URL builders. After this task the app can hold and query normalized `Vod`
movie items, `Series` browse entries, and `Vod` episode items, and can build the
correct Xtream `/movie/…` and `/series/…` URLs — with no fetch, no DOM, and no
playback wiring yet.

## Acceptance criteria

- [ ] `src/client/vod.js` defines `window.IptvVod` with a store API: set/get
      movies, set/get series, set/get a series' episodes by `series_id`, a
      `hasMovies()` / `hasSeries()` (or equivalent count) predicate, and a clear
      (so connect/switch/disconnect can reset it). Store shape mirrors
      `window.IptvEpg` (a Map-backed in-memory store).
- [ ] A pure movie normalizer maps a raw `get_vod_streams` entry + a VOD
      category map + account info into a `Vod` movie item
      `{ id, name, grp, url, img, cat, num, kind:'movie' }` per
      `docs/specs/vod-library.md` §1, with `grp` resolved (`"Uncategorized"` for
      unknown category id) and `url` the built movie URL.
- [ ] A pure series normalizer maps a raw `get_series` entry + a series category
      map into a `Series` browse entry `{ id, name, grp, img, cat }` per §2.
- [ ] A pure episode normalizer flattens a `get_series_info` `episodes` map into
      `Vod` episode items `{ …, kind:'episode' }` grouped by season, with `name`
      of the form `<series> · S<season>E<episode> <title>` and `url` the built
      series-episode URL per §1, §3.
- [ ] Pure URL builders produce `<base>/movie/<user>/<pass>/<id>.<ext>` and
      `<base>/series/<user>/<pass>/<id>.<ext>`, with `<ext>` taken from the
      item's `container_extension` when present, else the account live extension
      (fallback `ts`), per §3 — extension preserved so `getEng` resolves the same
      engine.
- [ ] All helpers are pure/side-effect-free except the store mutators; nothing
      reads or writes the DOM, `ST`, or localStorage.
- [ ] `src/client/vod.js` carries an `ADR: ADR-0037` comment near the top and is
      loaded in `src/index.html` (alongside the other client modules) so
      `window.IptvVod` exists at runtime.

## Test requirements

- **Unit:** `src/tests/unit/vod.test.js` — movie/series/episode normalizers
  produce the documented shapes (incl. `kind`, `grp` resolution, `Uncategorized`
  fallback, episode `name`/grouping); URL builders produce the exact `/movie/…`
  and `/series/…` forms with the extension preserved (and the live-ext fallback);
  the store set/get/clear/has API round-trips. Honor R-0001 (no DOM here).
- **UI:** n/a — not user-facing (pure data layer; the toggle/cards come in
  ADR-0038 tasks).
- **Integration:** n/a — no external connectivity (fetch is TASK-0078).

## Implementation notes

_Filled by implement-agent._
