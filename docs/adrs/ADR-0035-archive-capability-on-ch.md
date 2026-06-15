---
id: ADR-0035
title: Carry per-channel archive capability (arch/archDur) on the Ch schema, populated from the Xtream tv_archive fields via the existing fetch path
date: 2026-06-15
evolution: 21
status: accepted
governs:
  - CONVENTIONS.md
  - src/client/api.js
  - src/tests/unit/api.test.js
  - src/tests/int/catchup.test.js
---

# ADR-0035 — Carry per-channel archive capability (arch/archDur) on the Ch schema, populated from the Xtream tv_archive fields via the existing fetch path

## Context

E21 prompt (the E20 Phase-4 research winner): add catch-up (archive/timeshift)
playback on top of the EPG. The first requirement is to **detect per-channel
archive support from the Xtream source** — the channel's `tv_archive` /
`tv_archive_duration`, surfaced via the existing EPG / short-EPG fetch path — so
the client knows which channels (and which past programs) are archive-capable.

Constraints already in the codebase:

- The canonical `Ch` type and `CH_DEF` schema live in CONVENTIONS.md §7 and are
  built by `mkXtCh` (Xtream), `mkM3uCh` (M3U), and `mkDemoCh` (demo) in
  `src/client/api.js` (ADR-0009/ADR-0020). `mkXtCh` already reads the raw
  `get_live_streams` entry, which carries `tv_archive` and
  `tv_archive_duration` per channel.
- The EPG fetch path (ADR-0030, `loadEpg`/`runXtEpg` in `src/client/api.js`)
  already fans short-EPG requests out through the existing
  `/api/xtream?url=<encoded>` proxy. Archive capability surfaces alongside that
  path with **no new server route**.
- Archive is an **Xtream-only** concept: M3U/XMLTV carries no archive metadata,
  and the demo path is offline.

## Decision

Extend the canonical `Ch` schema with **two optional, safe-defaulted fields**:

- `arch: boolean` — `true` when the channel advertises archive/catch-up support
  (Xtream `tv_archive` truthy). Default `false`.
- `archDur: number` — archive retention window in **days** (Xtream
  `tv_archive_duration`). Default `0` (unknown/absent).

Both are optional with safe defaults in `CH_DEF` so every existing `Ch` consumer
(grid filter, sort, favourites, the live play path) is unaffected and any channel
lacking the fields behaves exactly as today.

Population:

- **Xtream** — `mkXtCh` reads `tv_archive` / `tv_archive_duration` from the raw
  `get_live_streams` entry it already consumes, setting `arch` (truthy coercion)
  and `archDur` (numeric, default `0`). This is the canonical archive source and
  is fetched during the normal connect; the short-EPG fetch path
  (`get_simple_data_table`) may corroborate but is not required to set the flag.
- **M3U / demo** — `mkM3uCh` and `mkDemoCh` set `arch:false`, `archDur:0`. The
  demo EPG path (ADR-0030 `runDemoEpg`) is permitted to synthesize a few
  `arch:true` demo channels purely for offline demonstrability (ADR-0036,
  `docs/specs/catchup-archive.md` §6) — that synthesis lives in the demo guide
  generation, not in the live-network paths.

This decision is the **data** half of catch-up; ADR-0036 is the **render +
playback** half that consumes `arch`/`archDur`.

## Consequences

**Easier:**
- The render/playback layer (ADR-0036) reads a plain boolean + number off the
  `Ch` it already has in `ST.chs`; no extra fetch, no extra store.
- Optional safe defaults mean zero migration and zero impact on existing
  consumers — channels without archive look and behave exactly as before.
- Reuses the existing connect fetch and proxy — no new server route, no new
  data type.

**Harder:**
- `CH_DEF` and the `Ch` typedef in CONVENTIONS.md must grow two fields, and the
  three channel builders must set them consistently.
- Demo synthesis of archive-capable channels must be careful to remain offline
  and to produce at least one past program so the affordance is demonstrable.

**Ruled out:**
- A separate archive-capability store or server endpoint (the prompt scopes
  detection to the existing fetch path + the channel object).
- Surfacing archive on M3U/demo as a live capability (those paths have no real
  archive; demo synthesis is for demonstrability only).

## Tasks derived

- TASK-0072 — Extend the `Ch` schema (CONVENTIONS §7 `Ch`/`CH_DEF`) with optional
  `arch`/`archDur`, and populate them in `mkXtCh` (from `tv_archive` /
  `tv_archive_duration`); `mkM3uCh`/`mkDemoCh` default them to `false`/`0`.

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0035` comment near the top
(native comment syntax; comment-less / prose formats are linked from this side
only — CONVENTIONS.md is the schema home and is linked here). When a change
removes the last governed code, this ADR is marked `status: deleted` — the file
itself is never removed; it is history.
