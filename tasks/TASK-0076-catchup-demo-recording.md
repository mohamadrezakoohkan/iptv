---
id: TASK-0076
adr: ADR-0036
evolution: 21
status: pending
attempts: 0
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

_Filled by implement-agent._
