---
id: TASK-0088
adr: ADR-0039
evolution: 23
status: pending
attempts: 0
depends_on: [TASK-0087]
---

# TASK-0088 — Demo recording of the in-player controls layer

## Goal

When this task is done, the UI suite produces a committed screen recording that
demonstrates the in-player controls layer working offline in demo mode, covering
the full required arc (boot → prepare → interact → revert runtime state → stop).
This is the run's demo (the run adds user-interactable behavior, so it is NOT
demo-exempt).

## Acceptance criteria

- [ ] A UI test records the running product to the known run-artifacts directory
      with the arc: **boot** (launch via the canonical run command,
      `node src/server/srv.js`) → **prepare** (connect demo mode and play a demo
      channel so the shared `<video>` is streaming) → **interact** (exercise the
      controls: toggle fullscreen via `#fs-btn` and/or `F`, toggle PiP via
      `#pip-btn` and/or `P` where supported, and use keyboard shortcuts —
      Space/K play-pause, M mute, ArrowUp/ArrowDown volume — entirely offline) →
      **revert runtime state** (return the player to its pre-interaction in-app
      state: unmute / restore volume, exit fullscreen/PiP, stop the demo stream)
      → **stop**.
- [ ] The recording is a committed run-artifact on the run branch, referenced
      from the PR `### Demo` section as a clickable link per the
      repository-visibility rule (CORE_FLOW.md §3 Demo recording).
- [ ] Where the headless test browser lacks real Fullscreen/PiP, the recording
      still demonstrates the keyboard media shortcuts and the controls' presence
      / state; PiP/FS portions degrade silently (consistent with the
      silent-degrade design) and the recording notes it.

## Test requirements

- **Unit:** n/a — this task is a recording artifact, not new product logic.
- **UI:** `src/tests/ui/ctrl-demo.test.js` — the demo-recording test described
  above (boot → prepare → interact → revert → stop), producing the committed
  recording artifact.
- **Integration:** n/a — no external connectivity (demo mode plays offline-safe
  public test streams already loaded by demo mode).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
