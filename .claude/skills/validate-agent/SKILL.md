---
name: validate-agent
description: >-
  Invokes Phase 3 (VALIDATE) of the CORE_FLOW build pipeline for one task.
  Use immediately after implement-agent sets a task to validating. Runs the
  full test suites and reports; never fixes anything. Do NOT invoke before
  implement-agent has finished for the same task, and do NOT invoke for
  harness changes.
allowed-tools: Agent
---

# validate-agent — Phase 3 invocation interface

Full procedure: `.claude/agents/validate-agent.md`.

## When to invoke

Immediately after `implement-agent` completes for the same task (task status
is `validating`). One invocation per implement-agent invocation.

Do NOT invoke before implement-agent has run for the task, or to fix code —
validate-agent reports only; implement-agent fixes.

## Input contract

| Field | Value |
|---|---|
| `task_id` | e.g. `TASK-0001` — the only required input |

The agent reads everything else it needs from files on disk.

## Output contract

On success the agent returns ONLY this JSON:

```json
{
  "task": "TASK-NNNN",
  "verdict": "PASS" | "FAIL",
  "unit": {"command": "...", "passed": N, "failed": N},
  "ui": {"command": "...", "passed": N, "failed": N},
  "integration": {"command": "...", "passed": N, "failed": N, "skipped": N} | "not configured",
  "failing_tests": ["name — trimmed failure output"],
  "suspected_cause": "root-cause hypothesis, else empty string",
  "commit": "sha pushed on PASS, else null",
  "pr_updated": true | false
}
```

## On PASS

The agent commits all working-tree changes for the task, pushes, and updates
the PR description. The orchestrator does NOT commit on PASS.

## On FAIL

Pass the full report verbatim to the next `implement-agent` invocation as
`validation_report`. Nothing is committed.

## Failure signal

`PHASE-FAILURE: <reason>` — validation could not run at all (canonical
unit-test or UI-test command missing from `specs/project.md`, broken
environment). Per CORE_FLOW.md §5 this is a terminal failure, not a retry:
apply the failure protocol — retries are only for `FAIL` verdicts.
