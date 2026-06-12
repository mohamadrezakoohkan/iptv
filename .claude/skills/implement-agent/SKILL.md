---
name: implement-agent
description: >-
  Invokes Phase 2 (IMPLEMENT) of the CORE_FLOW build pipeline for one task.
  Use after spec-agent has returned a manifest, once per task in manifest order.
  Never invoke in parallel — agents share one working tree. Do NOT use outside
  an active build run or for harness changes.
allowed-tools: Agent
---

# implement-agent — Phase 2 invocation interface

Full procedure: `.claude/agents/implement-agent.md`.

## When to invoke

After `spec-agent` has returned a manifest, for each task in the manifest's
declared order, sequentially. Also invoked for review-remediation rounds
dispatched by the orchestrator after `review-agent` finds discrepancies.

Do NOT invoke in parallel — one working tree, one agent at a time.

## Input contract

| Field | Value |
|---|---|
| `task_id` | e.g. `TASK-0001` |
| `rule_pack` | The `<!-- LEARNED-RULES:START -->…END` block from `CLAUDE.md`, verbatim |
| `validation_report` | Previous `validate-agent` JSON report — **required on retries, omit on first attempt** |

## Output contract

On success the agent returns ONLY this JSON:

```json
{
  "task": "TASK-NNNN",
  "attempt": N,
  "files_changed": ["..."],
  "tests_added": {"unit": ["..."], "ui": ["..."], "integration": ["..."]},
  "adr_updates": ["ADR-NNNN: governs trued up | marked deleted — else empty list"],
  "summary": "what was built, one short paragraph",
  "concerns": "risks, out-of-scope observations, else empty string"
}
```

## Failure signal

`PHASE-FAILURE: <reason>` — a single line meaning the task is unimplementable
as specified. Apply the failure protocol (CORE_FLOW.md §5), mark the task
`failed`, mark dependents `blocked`, continue with independent tasks.

## Retry budget

| Attempt | Action |
|---|---|
| 1 (initial) | Invoke without `validation_report` |
| 2–4 (retries) | Invoke with the previous `validate-agent` report verbatim |
| After attempt 4 | Failure protocol — do not retry further |
