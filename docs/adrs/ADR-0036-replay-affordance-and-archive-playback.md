---
id: ADR-0036
title: Render a Replay affordance on past archive-capable schedule rows that builds the Xtream timeshift URL and reuses the existing select+play path
date: 2026-06-15
evolution: 21
status: accepted
governs:
  - src/client/play.js
  - src/client/ui.js
  - src/client/api.js
  - src/client/app.css
  - src/tests/unit/play.test.js
  - src/tests/unit/epgui.test.js
  - src/tests/unit/api.test.js
  - src/tests/unit/epgfetch.test.js
  - src/tests/ui/catchup.test.js
  - src/tests/ui/catchup-demo.test.js
  - src/tests/ui/catchup-recording.test.js
---

# ADR-0036 — Render a Replay affordance on past archive-capable schedule rows that builds the Xtream timeshift URL and reuses the existing select+play path

## Context

E21 prompt: for archive-capable channels, render a keyboard-focusable **Replay**
affordance on each **past** schedule row of the expandable per-channel guide;
activating it builds the Xtream **timeshift archive URL** for that program (start
+ duration) and plays it through the **existing CORS proxy and dual-engine
player** (HLS via hls.js / TS via mpegts.js, same engine resolution as live) by
**reusing the existing select+play path**. Past rows on non-archive channels —
and the whole feature on M3U/demo — show no affordance and degrade silently. The
prompt's hard constraints: **no new playback engine, no new state-machine phase,
no new server route.**

ADR-0035 supplies the data (`Ch.arch` / `Ch.archDur`). This ADR decides the
**render surface + the playback wiring**. Prior patterns constrain it:

- The schedule row is built by `mkSchedRow` (`src/client/ui.js`, ADR-0031); a
  future row already carries a Remind toggle (`mkRem` / `mkRemBtn`, ADR-0033)
  gated on `prg.start > now`. The Replay control is its **past** mirror, gated on
  `prg.stop <= now` + archive capability.
- `onGridClick` already routes `[data-exp]` and `[data-rem]` with
  `stopPropagation` so they never trigger the card's select/play. Replay routes
  the same way through a new `[data-replay]` branch.
- `goRemWatch` (ADR-0034) already proves the **existing select+play path** can be
  invoked from a non-card-click site: `setCur` → `saveSt('sel')` → `go('PLAY')`
  when `READY` → `rndHead()` → `IptvPlay.loadPlay(url)`. Replay reuses exactly
  that arc, passing the archive URL instead of the live URL.
- `loadPlay` → `getEng` resolves the engine from the URL extension (`.m3u8` →
  hls.js, else mpegts.js) and wraps it through the existing `/api/xtream?url=`
  proxy (`getPrx`/`getRmx`). Because the timeshift URL ends in the account's
  live extension, the **same** engine resolution applies — no new engine, no new
  route, no new branch in `loadPlay`.

## Decision

Add the catch-up render + playback entirely within `src/client/ui.js`,
`src/client/play.js`, and `src/client/app.css`, reading `Ch.arch`/`Ch.archDur`
and `window.IptvEpg` at render/activate time. No new state phase, no new boolean
control flag, no new localStorage key, no new server route, no new engine.

### Archive URL builder (`src/client/play.js`)

A **pure** helper (e.g. `getArchUrl`) builds the Xtream timeshift archive URL
from a program + channel, mirroring the live-URL form `mkXtCh` builds:

```
<base>/timeshift/<user>/<pass>/<durationMinutes>/<YYYY-MM-DD:HH-MM>/<stream_id>.<ext>
```

- `start` → the Xtream local-time stamp `YYYY-MM-DD:HH-MM`.
- duration → whole minutes from `(stop - start)`, minimum 1.
- ext → the same extension the live URL uses for that channel (derived from the
  channel's live `url`, so HLS/TS resolution stays identical).
- Side-effect-free; returns the absolute archive URL string. The caller hands it
  to the **unchanged** `loadPlay`, which proxies + engine-selects it as for live.

Full URL rules: `docs/specs/catchup-archive.md` §2.

### Replay control on past rows (`mkSchedRow`)

`mkSchedRow` renders a keyboard-focusable `<button type="button">` Replay
control when the program is **past** (`prg.stop <= now`), the channel is
**archive-capable** (`arch === true`), and the program start is within the
archive window (`archDur` days; skipped when `archDur` is 0). The control carries
`data-replay="<chId>|<start>"` and an `aria-label` (`Replay <title>`), present in
the baseline HTML (Rule R-0001 — it is a one-shot action, no attribute toggling).
Future rows still get Remind (ADR-0033); the airing program gets neither; a
non-archive or M3U/demo row gets nothing. Full gating:
`docs/specs/catchup-archive.md` §3.

### Activation reuses the existing select+play path (`onGridClick` → `goReplay`)

`onGridClick` routes a `[data-replay]` click (before the card-select branch, with
`stopPropagation`) to a `goReplay(chId, start)` action in `src/client/ui.js`
that: resolves the `Ch` (no-op if gone / not `arch`); resolves the `Prg` from
`IptvEpg.get(chId)` by `start` (no-op if absent) for its `stop`; builds the
archive URL via `IptvPlay.getArchUrl`; then runs the **existing** transition —
`setCur(ch)`, `saveSt('sel')`, `go('PLAY')` when `READY`, `rndHead()`,
`IptvPlay.loadPlay(archUrl)` — exactly like `goRemWatch` / a card click. Full
behavior: `docs/specs/catchup-archive.md` §4.

### Demo demonstrability

The demo EPG path synthesizes a few `arch:true` demo channels with at least one
past program so a past archive-capable Replay row renders offline and the demo
recording can exercise it (`docs/specs/catchup-archive.md` §6). The demo channel
`url`s are public HLS test streams, so demo Replay plays a real test stream
through the normal engine path with no live Xtream portal.

## Consequences

**Easier:**
- Reuses `mkSchedRow`, `onGridClick`, the select+play arc (`goRemWatch` pattern),
  and the unchanged `loadPlay`/`getEng`/`getPrx` — the prompt's "reuse" mandate
  is satisfied literally: no new engine, phase, or route.
- The past/future split is clean: future → Remind (ADR-0033), past+archive →
  Replay (this ADR), airing → neither.
- The archive URL ending in the live extension means engine resolution is free.

**Harder:**
- `mkSchedRow` now branches on past-vs-future and archive capability; the UI
  test must prove Replay appears only where allowed and never plays the *live*
  stream (stopPropagation) and never toggles expansion.
- The timeshift stamp must be formatted correctly (local `YYYY-MM-DD:HH-MM`) and
  the duration rounded sanely; unit tests pin the builder.

**Ruled out:**
- A dedicated archive player, a new "ARCHIVE" phase, or a server archive route
  (the prompt forbids all three; the existing player/phase/proxy are reused).
- Replay on future rows, airing rows, non-archive channels, or M3U/demo channels
  (catch-up is Xtream-archive-only; demo synthesis is for demonstrability).

## Tasks derived

- TASK-0073 — Pure archive-URL builder (`getArchUrl`) + timeshift stamp/duration
  helpers in `src/client/play.js`, exported on `window.IptvPlay`.
- TASK-0074 — Replay control on past archive-capable rows in `mkSchedRow`
  (gating, `data-replay`, accessible label, styling).
- TASK-0075 — `goReplay` activation wired through `onGridClick`, reusing the
  existing select+play path; demo EPG synthesizes an archive-capable past
  program for offline demonstrability.
- TASK-0076 — Demo recording of Replay on a past archive-capable program
  (boot → demo → expand guide → Replay a past program → revert → stop).

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0036` comment near the top.
When a change removes the last governed code, this ADR is marked `status:
deleted` — the file itself is never removed; it is history.
