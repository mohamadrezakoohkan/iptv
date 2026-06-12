---
id: TASK-0024
adr: ADR-0010
evolution: 5
status: done
attempts: 0
depends_on: [TASK-0021, TASK-0022, TASK-0023]
---

# TASK-0024 — Live Xtream end-to-end: connect, list, and play mymax.top

## Goal

Prove the run's acceptance end-to-end against the user's personal portal:
the app connects to `http://mymax.top:8080` with user `1ymax5763dy` /
pass `66537535`, lists categories and channels, and a selected channel's
stream actually delivers playable MPEG-TS bytes through the full stack
(engine → proxy → redirect → upstream).

## Acceptance criteria

- [ ] Integration test: `IptvApi.connect` (Xtream mode) against the live
      portal through the in-process server resolves ok; categories > 1,
      channels > 1, schema-valid `Ch` objects.
- [ ] Integration test: for a sample of live channels, the normalized `url`
      fetched via the proxy returns 200 and TS sync byte `0x47` (≥1 of the
      sample must pass, per the flake policy in
      `specs/integration-testing.md`); reads bounded then aborted.
- [ ] UI test: with the portal connection driven through the real local
      server (network-permitting) or a recorded TS fixture, selecting a
      channel attaches the mpegts.js engine, the TS chip activates, and the
      video element receives data (readyState > 0) or, at minimum, the
      engine reaches its loading state without the error overlay.
- [ ] No regression: full unit, UI, and integration suites pass.

## Test requirements

- **Unit:** n/a beyond existing suites — this task is the acceptance gate;
  any glue code it adds gets unit coverage.
- **UI:** the live-playback Playwright scenario above.
- **Integration:** the live-portal connect + stream-bytes tests above
  (`specs/integration-testing.md` Xtream tier).

## Implementation notes

- `tests/int/e2e.test.js` (new): full-stack acceptance gate — boots the
  Express router in-process, drives `IptvApi.connect` (Xtream mode,
  `client/api.js` IIFE evaluated with a fetch shim) against the live
  portal; asserts ok Result, categories > 1, channels > 1, CH_DEF-valid
  sampled channels, then fetches the engine's own **normalized** `ch.url`
  values through `/api/xtream` — 200 + TS sync byte `0x47`, 64 KB bounded
  read then abort, ≥1 of 5 per the flake policy. Differs from
  `tests/int/redir.test.js` (TASK-0022), which builds stream URLs by hand
  from `get_live_streams`; this one proves the normalized output plays.
- `tests/ui/live.test.js` (new): Playwright against the real local server
  and live portal. Test 1: footer connect in Xtream mode → connected
  banner, > 2 sidebar buttons with non-empty / non-"undefined" labels,
  > 1 channel card. Test 2: samples up to 5 channels — TS chip active
  after click, pass on `video.readyState > 0` or engine still loading
  with no error overlay; reconnects (page reload, storage cleared via
  `addInitScript`) between attempts because `ERR` only transitions to
  `INIT`. Both passed against the live portal (~3 s / ~5 s).
- `client/ui.js`: fixed the pre-existing `rndSide` category-shape bug —
  it read `cat.id` / `cat.name`, but Xtream/M3U paths return normalized
  `{ category_id, category_name }` (ADR-0009), so sidebar labels rendered
  "undefined" for real portals. New pure helpers `getCatId` / `getCatName`
  prefer the normalized shape and fall back to the demo `{ id, name }`
  shape. In scope: the task goal is "lists categories" end-to-end and
  ADR-0010 governs `client/ui.js`.
- `tests/unit/side.test.js` (new): unit coverage for the glue — labels,
  `data-cat` ids, and per-category counts for normalized cats, plus the
  demo-shape fallback.
- ADR-0010 `governs:` trued up with the three new test files.
- Full suites at hand-off: unit 269/269, UI 83/83, integration 20/20 —
  all passing against the live network.
