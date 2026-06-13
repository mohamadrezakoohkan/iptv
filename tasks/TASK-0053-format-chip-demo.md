---
id: TASK-0053
adr: ADR-0025
evolution: 15
status: pending
attempts: 0
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

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
