---
id: TASK-0076
adr: ADR-0036
evolution: 21
status: done
attempts: 1
depends_on: [TASK-0075]
---

# TASK-0076 — Demo recording of Replay on a past archive-capable program

## Goal

A screen recording of the running product exercising catch-up Replay end-to-end,
captured by the UI suite during validation and committed as a run-artifact on the
run branch, referenced from the PR's `### Demo` section (CORE_FLOW.md §3 Demo
recording).

## Acceptance criteria

- [ ] A UI test produces a screen recording following the required arc: **boot**
      (launch via `node src/server/srv.js`) → **prepare** (connect in demo mode,
      open an archive-capable channel's expandable guide) → **interact** (activate
      the Replay control on a PAST program and show the archive stream playing
      through the normal player) → **revert runtime state** (stop/return to the
      idle player and collapse the guide, in-app — no git revert) → **stop**.
- [ ] The recording is written to the known run-artifacts directory the UI suite
      uses (same place the EPG/reminders demos were committed) so validate-agent
      can commit and reference it.
- [ ] The flow runs offline against the synthesized archive-capable demo guide
      (TASK-0075) — no live Xtream portal required.

## Test requirements

- **Unit:** n/a — recording task.
- **UI:** the recording-producing UI test above; it doubles as the end-to-end
  demonstration that Replay plays the archive stream in demo mode.
- **Integration:** n/a — offline demo.

## Implementation notes

- **New demo-recording spec:** `src/tests/ui/catchup-recording.test.js` (ADR-0036).
  The path `src/tests/ui/catchup-demo.test.js` was already taken by the TASK-0075
  activation UI test (committed earlier in this run), so the recording spec uses the
  distinct `catchup-recording.test.js` name to avoid clobbering committed work; both
  files are now listed in ADR-0036 `governs:`.
- **Recording mechanics** mirror `epg-demo.test.js` / `reminders-demo.test.js`: a
  per-spec `chromium` context with `recordVideo`, serial mode, the `.webm` flushed
  in `afterAll` and renamed to the stable artifact path
  `test-results/e21-catchup-demo.webm` (the known run-artifacts directory
  validate-agent commits + references). Capture is scoped to this spec only, so the
  rest of the UI suite stays fast and records nothing.
- **Arc (CORE_FLOW §3):** boot (fresh `http://localhost:3000` load via the
  Playwright webServer `node src/server/srv.js`, idle, no cards/guides/Replay) →
  prepare (real footer demo connect; the demo connect flow flags every 4th channel
  `arch:true` and synthesizes a guide whose earliest slot is already PAST, so the
  spec scans cards, opens each guide, and stops on the first card whose expanded
  schedule carries a `.ch-replay`) → interact (assert the past archive row's Replay
  `<button>` with baseline `aria-label="Replay …"` + `data-replay="<chId>|<start>"`
  per R-0001, focus it, then click it and assert the archived program plays through
  the normal player — `body.is-play`, `#now-info` = channel name, `#player-video`
  visible, `#player-idle` hidden — driving the real `onGridClick → goReplay →
  getArchUrl → loadPlay` select+play path) → revert (in-app teardown: `stopPlay`,
  clear cur/search/filter, legal phase walk `PLAY→READY` / `ERR→INIT`, re-render
  grid so the open guide collapses, back to idle) → stop.
- **Offline:** runs entirely against the synthesized archive-capable demo guide
  (TASK-0075); a demo channel's non-`/live/` url makes `getArchUrl` return the
  public HLS test-stream url as-is, so demo Replay plays a real test stream through
  the normal engine path — no live Xtream portal.
- **Non-obvious:** an archive channel surfaces more than one PAST in-window row
  (the synthetic guide bases an hour back), so the spec asserts `>= 1` Replay
  controls and operates on `.first()`. The `ch-active` grid marker is not asserted —
  `goReplay` (like `goRemWatch` and a live card click) does not re-render the grid
  synchronously, so the marker is not applied without a grid re-render; playback is
  proven via the player surface instead.
- Verified green locally: `npx playwright test catchup-recording.test.js` → 6/6
  pass; `test-results/e21-catchup-demo.webm` produced. Left uncommitted for
  validate-agent.
