---
id: TASK-0071
adr: ADR-0034
evolution: 20
status: pending
attempts: 0
depends_on: [TASK-0068, TASK-0069, TASK-0070]
---

# TASK-0071 — Demo recording of the reminder set → fire → notify → clear arc

## Goal

A screen recording of the running product exercising the program-reminder flow
end-to-end on the demo fixture, committed as a run-artifact on the run branch
and referenced from the PR `### Demo` section (CORE_FLOW.md §3 Demo recording).
This run adds user-interactable behavior, so it is **not** demo-exempt.

## Acceptance criteria

- [ ] The UI suite produces a screen recording following the required arc
      (CORE_FLOW.md §3): **boot** (launch via `node src/server/srv.js`) →
      **prepare** (enter `demo` to load the demo playlist + synthetic guide;
      expand a channel's schedule) → **interact** (set a Remind toggle on an
      upcoming/NEXT program — `aria-pressed` flips; let the timer fire it so the
      in-app toast appears; the best-effort Notification path runs
      mocked-granted; use the toast's Watch/Jump to switch to the channel) →
      **revert runtime state** (clear the reminder via the toggle and dismiss
      the toast, returning the in-app state to its pre-interaction condition) →
      **stop**.
- [ ] The recording runs entirely on the demo fixture — no live network, no
      real credentials, notification prompt mocked/granted in the harness.
- [ ] The recording is written to the run-artifacts directory the UI suite uses
      and committed on the run branch by validate-agent, which writes the PR
      `### Demo` reference as a clickable link per the repo's visibility
      (CORE_FLOW.md §3).

## Test requirements

- **Unit:** n/a — this task produces a demo recording, not new product logic.
- **UI:** `src/tests/ui/reminders.test.js` (or a dedicated
  `reminders-demo` spec) drives the full set → fire → notify (mocked) → watch →
  clear arc on the demo fixture and captures the recording across that arc.
- **Integration:** n/a — demo fixture only, no external connectivity.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
