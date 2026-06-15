---
id: TASK-0072
adr: ADR-0035
evolution: 21
status: pending
attempts: 0
depends_on: []
---

# TASK-0072 — Add optional arch/archDur to the Ch schema, populated from Xtream tv_archive

## Goal

The canonical `Ch` schema carries two optional, safe-defaulted fields — `arch`
(boolean) and `archDur` (number, days) — and the three channel builders set them:
`mkXtCh` reads them from the raw `get_live_streams` entry's `tv_archive` /
`tv_archive_duration`, while `mkM3uCh` and `mkDemoCh` default them to
`false` / `0`. Every existing `Ch` consumer is unaffected because the fields are
optional with safe defaults.

## Acceptance criteria

- [ ] CONVENTIONS.md §7 `Ch` typedef and `CH_DEF` gain `arch` (`boolean`, not
      required, default `false`) and `archDur` (`number`, not required, default
      `0`).
- [ ] `mkXtCh` (`src/client/api.js`) sets `arch` to the truthy coercion of the
      raw entry's `tv_archive` (e.g. `1`, `"1"`, truthy → `true`; `0`/absent →
      `false`) and `archDur` to `Number(tv_archive_duration)` with a `0` fallback
      for missing/NaN.
- [ ] `mkM3uCh` and `mkDemoCh` set `arch:false`, `archDur:0`.
- [ ] An Xtream channel whose raw entry omits `tv_archive` yields `arch:false`,
      `archDur:0` (no throw).
- [ ] No existing `Ch` consumer changes behavior (grid filter, sort, favourites,
      live play path) — the fields are additive.

## Test requirements

- **Unit:** `mkXtCh` builds `arch:true`/`archDur:N` from a raw entry with
  `tv_archive`/`tv_archive_duration`; `arch:false`/`archDur:0` when absent or
  falsy; `mkM3uCh`/`mkDemoCh` always produce `arch:false`/`archDur:0`. (These run
  through whatever `api.js` already exposes for channel-build tests — match the
  existing test seam.)
- **UI:** n/a — schema/data only, no user-facing change in this task (the
  affordance ships in TASK-0074).
- **Integration:** Against the live Xtream portal (specs/integration-testing.md
  Xtream tier), confirm the normalized channel list carries `arch`/`archDur`
  fields of the right types (at least the fields exist and are boolean/number on
  every channel); tolerate a portal that advertises no archive on any channel
  (assert types, not that some channel is archive-capable). Live-network tier is
  environment-red in this sandbox — document, do not fight it.

## Implementation notes

_Filled by implement-agent._
