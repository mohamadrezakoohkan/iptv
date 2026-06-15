---
status: draft
---

# Catch-up (archive / timeshift) playback on the EPG

## Purpose

Let the user **replay a past program** from the expandable per-channel guide on
channels whose Xtream source advertises archive (catch-up / timeshift) support.
This is an **added render affordance + URL-building helper on top of the existing
EPG** (`docs/specs/epg.md`, ADR-0030/ADR-0031) — it adds **no new playback
engine, no new state-machine phase, and no new server route**. Activating Replay
builds the Xtream timeshift archive URL for that program and plays it through the
**existing CORS proxy and dual-engine player** (`src/client/play.js`), reusing
the **same select+play path** a live channel click uses.

Catch-up is an **Xtream-only** capability:

- **Xtream path** — per-channel archive support is detected from the channel's
  `tv_archive` / `tv_archive_duration`, surfaced via the existing short-EPG /
  `get_live_streams` fetch path. Archive-capable channels expose Replay on their
  **past** schedule rows.
- **M3U path** and **Demo path** — show **no** Replay affordance and degrade
  silently (M3U/XMLTV has no archive concept; the demo path is offline). The
  demo guide **may synthesize** archive-capable channels purely so the feature is
  demonstrable offline (see §6) — no live network.

---

## 1. Archive capability on the `Ch` schema

The canonical `Ch` type (CONVENTIONS.md §7, `docs/specs/iptv-player.md` §5) is
extended with **two optional fields** so a channel carries its own archive
capability and degrades safely when absent:

```
/** @typedef {{ id:string, name:string, grp:string, url:string, img:string, cat:string, num:number, arch:boolean, archDur:number }} Ch */
```

| Field     | Meaning                                                                 |
|-----------|-------------------------------------------------------------------------|
| `arch`    | `true` when the channel advertises archive/catch-up support (`tv_archive` truthy). Optional, default `false`. |
| `archDur` | archive retention window in **days** (Xtream `tv_archive_duration`); `0` when unknown/absent. Optional, default `0`. |

- Both fields are **optional with safe defaults** (`arch:false`, `archDur:0`) so
  every existing `Ch` consumer (grid filter, sort, favourites, play path) is
  unaffected and any channel without the fields behaves exactly as today.
- **Xtream channels** populate `arch`/`archDur` from `get_live_streams`
  (`tv_archive`, `tv_archive_duration`), the same payload `mkXtCh` already reads.
  When the short-EPG / `get_simple_data_table` payload carries an `info`-level
  `tv_archive` it may corroborate, but `get_live_streams` is the canonical source
  already fetched during connect.
- **M3U and demo channels** set `arch:false`, `archDur:0` — the M3U/XMLTV format
  has no archive concept; the feature is silently absent on those paths.

## 2. Archive URL building (`src/client/play.js`)

A pure helper builds the Xtream **timeshift archive URL** for a program, mirroring
the live-URL form `mkXtCh` builds (`<base>/live/<user>/<pass>/<id>.<ext>`):

```
<base>/timeshift/<user>/<pass>/<durationMinutes>/<YYYY-MM-DD:HH-MM>/<stream_id>.<ext>
```

- **start** — the program's `start` (unix ms) formatted as the Xtream
  timeshift local-time stamp `YYYY-MM-DD:HH-MM`.
- **duration** — the program length in **whole minutes**, derived from
  `(stop - start)` rounded to the nearest minute (minimum 1).
- **ext** — the **same** stream extension live uses for that account (the
  Xtream `getExt` result, e.g. `ts` or `m3u8`), so the **existing engine
  resolution** (`getEng`, `.m3u8` → hls.js, else mpegts.js) picks the right
  engine with **no new engine and no new branch**.
- The builder is **pure** and side-effect-free; it returns the absolute archive
  URL string. The caller wraps it through the existing proxy/engine path exactly
  as a live URL is wrapped — `loadPlay` already calls `getPrx` / `getRmx`.

The archive URL is **never** built for a channel without `arch`, and the helper
is only reachable from a past archive-capable row.

## 3. Replay affordance on past schedule rows (`mkSchedRow`)

`mkSchedRow` (`src/client/ui.js`, ADR-0031, `docs/specs/epg.md` §5) gains a
**Replay control** on a row when **all** of:

1. the program is **PAST** (`prg.stop <= now`), and
2. the owning channel is **archive-capable** (`arch === true`), and
3. the program's `start` is **within** the channel's archive window
   (`now - archDur*days <= prg.start`, when `archDur > 0`; when `archDur` is
   `0`/unknown the window check is skipped — Replay still offered).

Otherwise the row renders **no** Replay control — exactly as today. In
particular:

- A **future** row never shows Replay (it may show the Remind toggle, ADR-0033 —
  the two are mutually exclusive by row time: future → Remind, past → Replay).
- The **currently-airing** program (`start <= now < stop`) shows neither.
- A past row on a **non-archive** channel shows nothing.
- Every row on an **M3U / demo** channel (`arch:false`) shows nothing — the
  whole feature is silently absent there.

### The Replay control

- A real, keyboard-focusable `<button type="button">` carrying
  `data-replay="<chId>|<start>"` (the program identity, mirroring the Remind
  toggle's `data-rem` form).
- An accessible label (`aria-label`) of the form `Replay <title>`, with the
  title HTML-escaped (guide data).
- It is rendered **inside** the schedule row alongside (or in place of) the
  Remind slot. It must **stop propagation** so activating it never triggers the
  card's select/play of the *live* stream and never toggles the schedule
  expansion (mirroring the `[data-rem]` / `[data-exp]` handling in
  `onGridClick`).
- **R-0001 compliance:** any aria attribute the control carries (e.g.
  `aria-label`) is present in the baseline HTML the builder emits; no attribute
  is "added back" at runtime that was not in source. The control's state is not
  toggled — it is a one-shot action button — so there is no attribute-mutation
  assertion risk beyond rendering it present.

## 4. Activating Replay — reuse the existing select+play path

A delegated handler on the channel grid (the existing `onGridClick` in
`src/client/ui.js`) routes a `[data-replay]` click, **before** the card
select branch, to a `goReplay(chId, start)` action that:

1. resolves the `Ch` from `ST.chs` by `chId` (degrades silently — no-op — when
   the channel is gone or not archive-capable);
2. resolves the program from the channel's stored guide (`IptvEpg.get(chId)`) by
   `start` to read its `stop` (for the duration); no program ⇒ no-op;
3. builds the archive URL (§2) for that program;
4. drives the **existing select+play transition** exactly like a live card click
   / the reminder Watch action (`goRemWatch`): `setCur(ch)`, `saveSt('sel')`,
   `go('PLAY')` when `READY`, `rndHead()`, then
   `IptvPlay.loadPlay(<archiveUrl>)`.

Because the archive URL ends in the account's live extension, `loadPlay` →
`getEng` selects the **same** engine (hls.js for `.m3u8`, mpegts.js for TS),
through the **same** `/api/xtream?url=` proxy — **no new engine, no new phase,
no new route** (the prompt's hard constraints).

The active channel marker (`ch-active`) reflects the channel whose archive is
playing, exactly as live selection does — the user is watching that channel's
past program through the normal player surface.

## 5. State, persistence, conventions

- **State machine.** No new phase, no new boolean control flag (CONVENTIONS §6).
  Replay reuses the live PLAY transition; archive capability is read from the
  `Ch` object at render time.
- **Persistence.** No new localStorage key. `arch`/`archDur` ride on the `Ch`
  objects in the in-memory channel list (and on persisted accounts only insofar
  as the channel list is rebuilt on connect — accounts persist credentials, not
  channels; `docs/specs/iptv-player.md` §9 unchanged).
- **Proxy.** The archive URL is fetched through the **existing**
  `/api/xtream?url=<encoded>` proxy via the engines' XHR, exactly like live —
  no new server route (`src/server/rtr.js` unchanged).
- **Schema.** `Ch` gains two optional fields with safe defaults; `Prg` is reused
  verbatim. No new data type.
- **Tokens.** `arch`, `archDur`, `replay`, `cur`, `prg`/`prgs` are existing or
  conventionally-formed CONVENTIONS §1 tokens; no new abbreviation is coined
  beyond `arch`/`archDur` for the archive fields.

## 6. Demo / offline demonstrability

So the feature is demonstrable without live network (and so the demo recording
can exercise it), the **demo EPG path** synthesizes:

- a subset of demo channels flagged `arch:true` (with a non-zero `archDur`), and
- a synthetic guide for those channels that includes at least one **past**
  program (a program whose `stop` is already behind `Date.now()`), so a past
  archive-capable row with a Replay control renders offline.

The demo archive URL still builds against the demo channel's `url`/identity; the
demo channel `url`s are public HLS test streams, so activating Replay in demo
mode plays a real (test) stream through the normal engine path. No live Xtream
portal is required for the demo.

## 7. Accessibility & UX

- The Replay control is a real focusable `<button>` with an accessible label;
  it never steals the card's primary click target and never bubbles to
  select/play of the live stream.
- Replay is offered only where it can work (past + archive-capable + within
  window); everywhere else it is silently absent — no disabled stubs, no empty
  rows, consistent with the EPG's contextual-presence posture (ADR-0025/0031).
- Times in the archive URL stamp use the program's start; on-screen the row's
  time range is unchanged (local-time, `fmtPrgTime`).
- M3U/demo and non-archive channels degrade silently — no errors, no affordance.
