---
id: TASK-0000
adr: ADR-0000
evolution: <N>
status: pending    # pending | in-progress | validating | done | failed | blocked
attempts: 0
depends_on: []     # task IDs that must be done first
---

# TASK-0000 — <title>

## Goal

One paragraph: what exists when this task is done that doesn't exist now.

## Acceptance criteria

- [ ] Concrete, externally checkable statements. Each one must be covered by
      at least one test.

## Test requirements

- **Unit:** what must be unit-tested.
- **UI:** what must be UI-tested (required whenever the task touches
  user-facing behavior; write "n/a — not user-facing" otherwise).
- **Integration:** what must be integration-tested against live external
  services (required whenever the task involves external connectivity, API
  calls, or proxy behavior; write "n/a — no external connectivity" otherwise).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
