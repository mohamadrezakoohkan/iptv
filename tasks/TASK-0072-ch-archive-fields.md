---
id: TASK-0072
adr: ADR-0035
evolution: 21
status: done
attempts: 1
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

**Files touched:**

- `CONVENTIONS.md` §7 — extended the `Ch` typedef and `CH_DEF` with two optional
  fields: `arch` (`boolean`, `req:false`, `def:false`) and `archDur` (`number`,
  `req:false`, `def:0`). Added an `ADR: ADR-0035` reference comment immediately
  above the `Ch` typedef (the schema home is linked from the ADR side; the
  inline comment makes the bidirectional link explicit even though Markdown
  carries no native code-comment for the block).
- `src/client/api.js` — added `ADR-0035` to the file header comment. `mkXtCh`
  now sets `arch: Boolean(d.tv_archive)` (truthy coercion handles `1`, `"1"`,
  truthy → `true`; `0`/absent → `false`) and `archDur: getArchDur(d.tv_archive_duration)`.
  Added the small pure helper `getArchDur` which returns `Number(raw)` when it is
  a finite positive number, else `0` (covers missing/NaN/negative). `mkM3uCh` and
  `mkDemoCh` always set `arch:false`, `archDur:0`.
- `src/tests/unit/api.test.js` — added a dedicated `Ch archive fields` describe
  block (7 cases) covering: Xtream `arch:true`/`archDur:N` from numeric and
  string `tv_archive`/`tv_archive_duration`; `arch:false`/`archDur:0` on `0`,
  absent (no throw), and NaN duration; demo channels always `false`/`0`; M3U
  channels always `false`/`0`. Updated the existing exact-`toEqual` Ch-mapping
  assertion to include the two new defaulted fields.
- `src/tests/int/catchup.test.js` (new) — live Xtream tier (ADR-0035 governs):
  connects to the personal portal through the in-process proxy and asserts every
  normalized channel carries `arch:boolean` and `archDur:number` (`archDur >= 0`,
  finite), tolerating a portal that advertises no archive (asserts types/shape,
  not that some channel is archive-capable).

**Non-obvious points:**

- The unit test seam reaches the channel builders only through the public
  `IptvApi.connect` path (the builders are private to the IIFE), so the Xtream
  cases drive `mkXtCh` via a sequential `fetch` mock and the M3U case via
  `parsM3u` — matching the existing test seam exactly.
- `Boolean(d.tv_archive)` is the conventional truthy coercion (CONVENTIONS §13
  forbids `!!`); `Number.isFinite` guards both NaN and `Infinity`.
- ADR-0035 `governs:` already listed all four touched files; `src/tests/int/catchup.test.js`
  is the only one that did not exist before this task — it now does, so the
  `governs:` list is true with no edit required.

**Integration tier:** the live-network suite is environment-red in this sandbox
(no outbound network) — the new `catchup.test.js` fails connect-resolution
identically to the pre-existing `xtream.test.js` (both can't reach
`mymax.top:8080`). This is the documented live-tier behavior, not a defect.

**Unit:** full suite green — `npx vitest run` → 803 passed (37 files), including
the 54 in `api.test.js`.
