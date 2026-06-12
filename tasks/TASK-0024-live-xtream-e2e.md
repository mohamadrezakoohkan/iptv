---
id: TASK-0024
adr: ADR-0010
evolution: 5
status: pending
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

_Filled by implement-agent._
