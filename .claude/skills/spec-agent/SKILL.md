---
name: spec-agent
description: >-
  Invokes Phase 1 (SPEC) of the CORE_FLOW build pipeline for a build prompt.
  Use when a human prompt adds, changes, or removes product behavior or structure
  and a new Evolution run must start. Do NOT use for questions, status requests,
  or harness changes — those route to the orchestrator directly or to /coreflow.
allowed-tools: Agent
---

# spec-agent — Phase 1 invocation interface

Full procedure: `.claude/agents/spec-agent.md`.

## When to invoke

A **build prompt** — the human is requesting a change to product behavior or
structure. One invocation = one Evolution = one run branch + one PR.

Do NOT invoke for:
- Questions or status requests (answer directly from files).
- Harness changes — use `/coreflow` instead.

## Input contract

Pass all three to the Agent call:

| Field | Value |
|---|---|
| `prompt` | User's build prompt, **verbatim** |
| `E` | Next evolution number: last `#N` in `CHANGELOG.md` + 1 |
| `rule_pack` | The `<!-- LEARNED-RULES:START -->…END` block from `CLAUDE.md`, verbatim |

## Output contract

On success the agent returns ONLY this JSON:

```json
{
  "evolution": E,
  "branch": "ai/e<E>-<slug>",
  "pr_url": "https://github.com/...",
  "specs_touched": ["docs/specs/..."],
  "adrs": [{"id": "ADR-NNNN", "title": "...", "path": "docs/adrs/..."}],
  "tasks": [{"id": "TASK-NNNN", "adr": "ADR-NNNN", "title": "...",
             "path": "tasks/...", "order": 1, "depends_on": []}],
  "notes": "anything the orchestrator must know, else empty string"
}
```

## Failure signal

`PHASE-FAILURE: <reason>` — a single line. The run halts; apply the failure
protocol (CORE_FLOW.md §5) and ask the human.

## Post-condition check

Before proceeding to Phase 2, verify every file listed in the manifest
(`specs_touched`, `adrs[].path`, `tasks[].path`) exists on disk.
