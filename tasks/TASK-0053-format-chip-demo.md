---
id: TASK-0053
adr: ADR-0025
evolution: 15
status: done
attempts: 1
depends_on: [TASK-0052]
---

# TASK-0053 — Demo recording of the contextual format chip

## Goal

Produce the run's demo recording proving the new contextual format chip works
end-to-end on the actually-running product: it is absent when idle, appears "on
top" of the content-head once a channel plays and an engine resolves, and
responds to a click. The recording is a committed run-artifact written by the UI
tier, following the boot → prepare → interact → revert → stop arc, so the run's
user-interactable change carries a demo per CORE_FLOW.md §3.

## Acceptance criteria

- [ ] A Playwright demo test `tests/ui/fmtchip-demo.test.js` exists, following
      the inherited demo pattern (`tests/ui/*-demo.test.js` from E13/E14): a
      per-spec `recordVideo` context whose video is written under `test-results/`
      to `test-results/e15-format-chip-contextual-demo.webm` (outputDir already
      lives off `test-results/` so the artifact survives the run).
- [ ] The recording captures, in order: **boot** (launch via the canonical run
      command `node server/srv.js`) → **prepare** (enter demo mode and play a
      channel so an engine resolves) → **interact** (show the contextual format
      chip appearing on top of the content-head with its resolved engine label,
      then click it to reveal the inline format detail and click again to hide
      it) → **revert runtime state** (stop playback / return to idle in-app so
      the chip disappears, restoring the pre-interaction state) → **stop**.
- [ ] The demo run is part of the UI suite (`npx playwright test`) and passes;
      it produces the `.webm` artifact at the path above.
- [ ] The chip file carries the `ADR: ADR-0025` reference where applicable (the
      demo test file is part of this ADR's `governs:` list).

## Test requirements

- **Unit:** n/a — this task adds only a UI demo recording, no new logic.
- **UI:** the demo test itself (`tests/ui/fmtchip-demo.test.js`) is the
  deliverable; it records the arc above and asserts the chip's contextual
  presence and functional click along the way so the recording demonstrably
  shows working behavior, not a blank pass.
- **Integration:** n/a — no external connectivity (demo mode uses the built-in
  synthetic playlist).

## Implementation notes

**Files touched**

- `tests/ui/fmtchip-demo.test.js` (new) — the run's demo recording. A per-spec
  chromium context with `recordVideo` (size 1280x800) writing under
  `.playwright-out` (the gitignored `outputDir`), renamed in `afterAll` to the
  stable committed-artifact path `test-results/e15-format-chip-contextual-demo.webm`
  (`test-results/` is not gitignored, so the artifact survives). Same pattern as
  `tests/ui/empty-demo.test.js` (E13) and `tests/ui/grid-align-demo.test.js`
  (E14). Carries the `ADR: ADR-0025` comment.
- `adrs/ADR-0025-contextual-format-chip.md` — `governs:` trued up to add
  `tests/ui/fmtchip-demo.test.js` (traceability field only; no decision content).

**Arc exercised (boot → prepare → interact → revert → stop)**

- boot: fresh load via the canonical webServer (`node server/srv.js`); asserts
  `#player-idle` visible and the chip + detail hidden (contextual, not always-present).
- prepare: connect demo mode through the real footer login (`#f-url=demo` →
  `#btn-conn`), wait for the 31 demo `.ch-card`s, then click a channel so
  `play.js` resolves the engine and surfaces the chip via the production
  `rndChip('hls')` path; asserts `#fmt-chip` becomes visible.
- interact 1: chip visible, labelled `HLS`, located inside `.content-head` (added
  on top), detail collapsed, `aria-expanded=false`.
- interact 2: functional click reveals `#fmt-detail` ("Playing via hls.js") and
  sets `aria-expanded=true`; second click hides it and resets `aria-expanded=false`.
- interact 3: stopping playback (PLAY→READY) hides the chip — proves contextual
  presence.
- revert: in-app teardown (stopPlay, clear current, back to idle, clear search,
  All Channels); asserts idle visible and chip/detail gone. No git revert.
- stop: asserts the recorder is active; `afterAll` flushes + renames the `.webm`.

**Non-obvious for reviewers**

- Headless chromium cannot actually play the demo HLS stream, so `play.js`
  `onEngErr` can fire a fatal media error at an unpredictable moment, calling
  `rndPhase()` (PLAY→ERR) which tears the contextual chip down mid-recording. To
  keep the demo deterministic without faking behavior, a `pinPlaying([open])`
  helper re-walks the state machine to PLAY and re-pushes the resolved engine
  through the **production** `rndChip('hls')` path right before each interaction;
  the click toggle itself is still driven by the real `onFmtChip` handler. The
  genuine engine-resolution + chip-surfacing happens for real during PREPARE (a
  real channel click); pinning only holds that resolved state up against the
  headless media-error race. Verified stable across repeated `--workers=4` full
  UI runs (191 UI tests green twice).
- Video capture is scoped to this spec only (per-spec recordVideo context), so
  the rest of the UI suite stays fast and records nothing.
