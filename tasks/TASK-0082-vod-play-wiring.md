---
id: TASK-0082
adr: ADR-0038
evolution: 22
status: done
attempts: 1
depends_on: [TASK-0081]
---

# TASK-0082 — On-demand select+play wiring

## Goal

Wire selecting a movie card or a series episode entry to play it through the
**existing** select+play path a live channel uses — no new engine, phase, route,
or playback localStorage key. After this task a user can pick a movie (or an
episode inside a series) and watch it in the existing player; the engine resolves
from the on-demand URL's preserved extension exactly as for live.

## Acceptance criteria

- [ ] Selecting a movie card (in `movies` mode) or an episode entry (in a series
      drill-down) resolves the `Vod` item and drives the existing transition:
      `setCur(item)`, `saveSt('sel')`, `go('PLAY')` when `READY`, `rndHead()`,
      then `IptvPlay.loadPlay(item.url)` — mirroring `goRemWatch`/`goReplay`, per
      `docs/specs/vod-library.md` §5c.
- [ ] The on-demand URL (`/movie/…` or `/series/…`, extension preserved from
      TASK-0077) feeds the **unchanged** `loadPlay` → `getEng` so the same engine
      resolves (`.m3u8` → hls.js, else mpegts.js / remux), through the same
      `/api/xtream` proxy — verified: no new branch in `loadPlay`, no new route.
- [ ] The active-item marker (`ch-active`) reflects the on-demand item being
      played; `rndHead` shows the item `name`.
- [ ] Selecting a series **card** still opens the drill-down (TASK-0081), not
      play; only movie cards and episode entries play.
- [ ] A no-longer-present item degrades silently (no-op), like `goReplay`.
- [ ] No new state phase, no new localStorage key for playback (`iptv_sel` reuse
      only), no new server route, no new engine.

## Test requirements

- **Unit:** `src/tests/unit/vodui.test.js` (extend) — selecting a movie/episode
      calls the select+play arc with the item's on-demand URL (spies on
      `setCur`/`go`/`loadPlay`); the URL is passed unchanged so `getEng` resolves
      the expected engine; selecting a series card opens the drill-down not play;
      a missing item is a no-op. Honor R-0001.
- **UI:** `src/tests/ui/vod.test.js` (extend) — in demo, switching to Movies and
      selecting the synthesized demo movie starts playback in the existing player
      (player active, `now-info` shows the movie name). (Driven against the demo
      offline movie, no live network.)
- **Integration:** n/a — on-demand stream delivery uses the same proxy/engine path
      already exercised by the live integration tests and TASK-0078's VOD fetch
      test; no new external surface.

## Implementation notes

**Files touched**

- `src/client/ui.js` — wired on-demand select+play into the existing
  `onGridClick` `[data-id]` branch. Previously that branch only resolved from
  `ST.chs` (live channels), so VOD `[data-id]` cards no-oped. It now resolves
  the item per the active content mode: live → `ST.chs.find(...)` (unchanged);
  movies/series → the new pure `getVodItem(id)`. Both feed the new shared
  `goPlay(item)`, which IS the existing arc extracted verbatim from the old
  inline code (`setCur` → `saveSt('sel')` → `go('PLAY')` when `READY` →
  `rndHead()` → `IptvPlay.loadPlay(item.url)`), mirroring `goRemWatch`/`goReplay`.
  Both new functions are exported on `window.IptvUi` for testability.
- `src/tests/unit/vodui.test.js` — extended with TASK-0082 unit coverage
  (8 new tests): movie click runs the full arc; URL passed unchanged for both
  `.mkv` and `.m3u8` so `getEng` resolves the source engine; PLAY guarded when
  not READY; missing movie is a no-op; episode entry in the open drill-down
  plays; series card opens drill-down (never plays); absent episode is a no-op;
  `getVodItem` resolves nothing in the series list view (no drill-down open).
- `src/tests/ui/vod.test.js` — extended with 3 Playwright tests against the
  offline demo: selecting the synthesized "Demo Movie" enters PLAY
  (`body.is-play`, `#now-info` shows the name) and plays the movie URL unchanged;
  the active-item marker (`ch-active`) reflects the played movie after a
  re-render; an episode entry plays its stream while the series card opens the
  drill-down.

**Non-obvious**

- `getVodItem` resolves episodes only from the currently-open series (`serCur`);
  in the series list view (`serCur === null`) it returns null so a stray
  `[data-id]` selects nothing — consistent with the spec's silent-degrade.
- The active marker is driven by `setCur(item)` exactly as live: `mkCard`
  applies `ch-active` when `ST.cur.id === item.id`, so it reflects on the next
  grid render. No new marker logic was added.
- No new branch in `loadPlay`, no new route, no new engine, no new phase, no new
  localStorage key — the on-demand URL (extension preserved by TASK-0077) feeds
  the unchanged `loadPlay` → `getEng`. The connect-Result broadening flagged by
  TASK-0079 was not needed: the account-ext fallback already resolves through
  `getExt`/the existing context (`vodCtx`).

**Traceability** — no new files; `ui.js`, `vodui.test.js`, `vod.test.js` are
already in ADR-0038's `governs:` and already carry the `ADR: ADR-0038` comment.

**Tests** — unit suite 915 passing (incl. 8 new). VOD UI suite 17/17 passing
(incl. 3 new). Pre-existing unrelated UI failures: `live.test.js` (requires a
real live IPTV portal / network) and `log-demo.test.js:182` (engine-environment
"HLS not supported" assertion) — both fail on the baseline without this change.
Test-results binary regenerations left unstaged.
