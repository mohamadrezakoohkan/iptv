---
id: TASK-0046
adr: ADR-0022
evolution: 13
status: pending
attempts: 0
depends_on: [TASK-0044, TASK-0045]
---

# TASK-0046 — Demo recording of the improved empty / no-signal states

## Goal

A Playwright video-capture spec exists that boots the running product, prepares
it (demo mode), drives every improved empty/no-signal state end-to-end, reverts
the in-app runtime state to its initial condition, and stops — writing the video
to the run-artifacts dir so `validate-agent` can commit it and reference it from
the PR's `### Demo` section. This is the run's required demo recording: the run
changes user-interactable behavior (E13), so it must carry one
(`CORE_FLOW.md` §3 Demo recording).

## Acceptance criteria

- [ ] A dedicated Playwright spec (e.g. `tests/ui/empty-demo.test.js`) records a
      video to the run-artifacts dir (e.g. `test-results/`) via Playwright video
      capture configured for this spec (browser context with `video` recording
      enabled; the saved `.webm`/video path is deterministic and discoverable for
      committing).
- [ ] The recording follows the required arc in order: **boot** (app loaded from
      a clean start via the canonical run command in `specs/project.md`) →
      **prepare** (enter demo mode / load the demo source) → **interact** (trigger
      and view each improved state: the no-match grid placeholder with its Clear
      search action, the favourites-empty placeholder with Browse all, the player
      idle "NO SIGNAL" guidance, and the stream-error placeholder with Retry) →
      **revert runtime state** (clear search, return to All Channels, stop any
      playback so the app is back at its pre-interaction starting condition — an
      in-app teardown, never a git revert) → **stop**.
- [ ] The spec asserts each improved state is visible during the arc (so the
      recording is a real demonstration, not a blind drive), reusing the contextual
      copy from `specs/empty-states.md` §2–§3.
- [ ] The produced video file lands in the run-artifacts dir on the run branch so
      the terminal actor can commit it and write the PR `### Demo` clickable blob
      link (private repo → `blob/<run-branch>/<path>`, not an inline tag).

## Test requirements

- **Unit:** n/a — this task adds a UI recording spec only; no new product logic.
- **UI:** the demo spec itself is the UI test. It must run under
  `npx playwright test`, produce the video artifact, and assert the improved
  empty/no-signal states appear during the arc. **DEMO RECORDING is a named,
  required output of this task**: validate-agent runs this spec, commits the
  produced video with the task, and references it from the PR `### Demo` section.
- **Integration:** n/a — runs against the local demo source, no external
  connectivity.

## Implementation notes

_Filled by implement-agent. Configure Playwright video capture for this spec
(e.g. a project/use override with `video: 'on'` and a known output dir) without
forcing video on the whole UI suite if that would slow it; ensure the saved video
path is stable for committing._
</content>
