---
id: TASK-0082
adr: ADR-0038
evolution: 22
status: pending
attempts: 0
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

_Filled by implement-agent._
