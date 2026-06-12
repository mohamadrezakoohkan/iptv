---
name: review-agent
description: >-
  Invokes Phase 4 (REVIEW) of the CORE_FLOW build pipeline. Use once at the
  end of every build run after all tasks are concluded (done, failed, or
  blocked). Always runs — even when tasks failed. Do NOT invoke mid-run or
  for harness changes.
allowed-tools: Agent
---

# review-agent — Phase 4 invocation interface

Full procedure: `.claude/agents/review-agent.md`.

## When to invoke

Once, after every task in the manifest has a terminal status (`done`,
`failed`, or `blocked`). Always runs — partial truth still gets recorded.

Do NOT invoke mid-run while tasks are still pending or in-progress.

## Input contract

| Field | Value |
|---|---|
| `E` | Evolution number for this run |
| `manifest` | The full JSON manifest returned by `spec-agent` (ADRs + tasks + the run's `worktree_path`) — the agent `cd`s into that worktree and works there |
| `outcomes` | Per-task result: `{"TASK-NNNN": "done" | "failed (FAIL-NNNN)" | "blocked"}` |
| `rule_pack` | The `<!-- LEARNED-RULES:START -->…END` block from `CLAUDE.md`, verbatim |

## Output contract

On success the agent returns ONLY this JSON:

```json
{
  "evolution": E,
  "verdict": "OK" | "DISCREPANCIES",
  "discrepancies": [{"task": "TASK-NNNN or null", "issue": "...", "needs": "code-fix | status-fix | doc-fix"}],
  "changelog_updated": true,
  "readme_updated": true | false,
  "commit": "sha of the final commit pushed, else null",
  "pr_finalized": true | false,
  "test_results_blocks_present": true | false,
  "proposed_rules": ["imperative rule text, if any"]
}
```

## On DISCREPANCIES

The orchestrator dispatches one remediation round (implement → validate,
budget 1 initial + 1 retry), then invokes review-agent once more to
re-check. If still discrepant after that round, apply the failure protocol
(CORE_FLOW.md §5) — record, do not hide. A concluded task missing its PR Test
Results block is a discrepancy (`needs: status-fix`): review-agent audits that
the blocks the terminal actor wrote are present, it never fabricates them.

## Failure signal

`PHASE-FAILURE: <reason>` — review cannot run at all. Record the failure;
note it in the Run Report. The run still concludes.
