---
name: research
description: >-
  Invokes Phase 4 (RESEARCH) of the CORE_FLOW build pipeline — non-blocking,
  alongside Phase 4 REVIEW. Use once per build run, launched together with
  review-agent by the post-VALIDATE review+research workflow after every task
  has concluded. research-agent (opus) proposes 3 next PRODUCT features, scores
  them, and returns the winner + report to the orchestrator. Do NOT invoke
  mid-run, for harness changes, or to research the harness itself.
allowed-tools: Agent
---

# research — Phase 4 RESEARCH invocation interface

Full procedure: `.claude/agents/research-agent.md`.

## When to invoke

Once per build run, after every task in the manifest has a terminal status
(`done`, `failed`, or `blocked`) — launched **together with `review-agent`** by
the saved review+research workflow (`.claude/workflows/`, CORE_FLOW.md §4.6).
RESEARCH is **non-blocking**: it runs in parallel/background, never gates REVIEW,
PR finalization, or the Run Report, and may finish after them. The orchestrator
owns it end-to-end and auto-runs it every build run — no human prompt.

Do NOT invoke:
- mid-run while tasks are still pending or in-progress;
- for harness changes (research is product-only) — use `/coreflow`;
- to spawn `backlog-agent` (the orchestrator does that with the returned winner).

## Input contract

| Field | Value |
|---|---|
| `E` | Evolution number for this run |
| `prompt` | The run's build prompt, for context |
| `product_context` | Paths to ground in: `docs/specs/`, `README.md`, `BACKLOG.md`, `CHANGELOG.md` |
| `rule_pack` | The `<!-- LEARNED-RULES:START -->…END` block from `CLAUDE.md`, verbatim |

## Output contract

On success the agent returns ONLY this JSON:

```json
{
  "evolution": E,
  "report_slug": "<kebab-case slug for docs/research/E<N>-<slug>.md>",
  "report_markdown": "the full report body, verbatim, for backlog-agent to commit",
  "candidates": [
    {"title": "...", "demand": N, "fit": N, "differentiation": N, "total": N, "sources": ["url — takeaway"]}
  ],
  "winner": {"title": "...", "total": N, "feature_prompt": "the winner as a build-prompt one-liner"},
  "notes": "anything the orchestrator must know, else empty string"
}
```

`candidates` carries exactly 3 product features, each scored 1–5 on **user
demand / frequency**, **product-fit / alignment**, and **competitive
differentiation** (15 max); `winner` is the highest total (ties broken toward
higher `fit`).

## Backlog handoff (orchestrator-owned)

research-agent does NOT spawn `backlog-agent`. The orchestrator takes
`winner.feature_prompt` (verbatim) and `report_markdown` and spawns
`backlog-agent` in its research-handoff variant (CORE_FLOW.md §4.5, §4.6), which
commits the report at `docs/research/E<N>-<report_slug>.md` alongside its
`BACKLOG.md` entry on a `backlog/<slug>` PR. This preserves "the orchestrator
owns control flow" (CORE_FLOW.md §1).

## Failure signal

`PHASE-FAILURE: <reason>` — research could not complete (web access unavailable,
no usable sources, dedup left fewer than 3 distinct sourced candidates, or the
run was a harness change). Per CORE_FLOW.md §4.6 and §5 this is **not** a
terminal failure: the orchestrator records it for visibility only (a Run Report
line, optionally a `research-miss` line in `failures/NEAR-MISSES.md` that is
**excluded** from the §5 recurrence count), no rule is earned, and the run still
completes green. No retry, no block.
