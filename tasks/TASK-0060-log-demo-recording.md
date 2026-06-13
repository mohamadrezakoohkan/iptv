---
id: TASK-0060
adr: ADR-0028
evolution: 17
status: pending
attempts: 0
depends_on: [TASK-0058, TASK-0059]
---

# TASK-0060 — Demo recording of the playback-failure-log button + panel

## Goal

A Playwright video-capture spec exists that boots the running product, prepares
it (demo mode), induces a channel-playback failure so a log entry is captured,
opens the log panel from the button beside the account button to show the
recorded failure and the count badge, clears the log, reverts the in-app runtime
state to its starting condition, and stops — writing the video to the
run-artifacts dir so `validate-agent` can commit it and reference it from the
PR's `### Demo` section. This run changes user-interactable behavior (E17), so
it must carry a demo recording (`CORE_FLOW.md` §3 Demo recording).

## Acceptance criteria

- [ ] A dedicated Playwright spec (e.g. `src/tests/ui/log-demo.test.js`) records
      a video to the run-artifacts dir with a deterministic, discoverable path
      (e.g. `test-results/e17-failure-log-demo.webm`), scoped to this spec only
      (its own browser context with `recordVideo`), leaving
      `playwright.config.js` untouched.
- [ ] The recording follows the required arc in order: **boot** (app loaded from
      a clean start via the canonical run command in `docs/specs/project.md`) →
      **prepare** (enter demo mode / load the demo source) → **interact** (induce
      a playback failure through the real `onEngErr` capture path — e.g. drive
      `setErr`/`go('ERR')`/`onEngErr` or select a channel that cannot play in the
      harness — so a real `IptvErrLog` entry and badge appear; open the log panel
      from the button beside the account button; show the entry row and the count
      badge; click Clear and show the empty state) → **revert runtime state**
      (close the log panel, the log already cleared, stop any playback, return to
      the pre-interaction condition — an in-app teardown, never a git revert) →
      **stop**.
- [ ] The spec asserts the log button sits **beside** the account button, the
      panel shows the captured failure with its detail, the badge reflects the
      count, and Clear empties it — so the recording is a real demonstration, not
      a blind drive — reusing the copy/structure from
      `docs/specs/playback-failure-log.md` §2–§3.
- [ ] The produced video lands in the run-artifacts dir on the run branch so the
      terminal actor can commit it and write the PR `### Demo` reference
      (visibility-correct link per `CORE_FLOW.md` §3).

## Test requirements

- **Unit:** n/a — this task adds a UI recording spec only; no new product logic.
- **UI:** the demo spec itself is the UI test. It must run under
  `npx playwright test`, produce the video artifact, and assert the
  failure-log button/panel behavior during the arc. **DEMO RECORDING is a
  named, required output of this task** — validate-agent runs this spec, commits
  the produced video with the task, and references it from the PR `### Demo`
  section.
- **Integration:** n/a — runs against the local demo source and an
  induced (not live) playback failure, no external connectivity.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
