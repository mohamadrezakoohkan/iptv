---
name: research
description: >-
  Invokes research-agent at the end of a build run, in parallel with Phase 4
  (review). It surveys competitors and public app reviews for the PRODUCT,
  proposes 3 next-feature candidates, scores them, picks a winner, writes a
  RESEARCH-NNNN report on the run branch, and returns the winner for the
  orchestrator to route to backlog-agent. Use once per build run, alongside
  /review-agent. Do NOT use mid-run, for harness changes (use /coreflow), for
  parking an idea (use /backlog-agent), or for questions (answer from files).
allowed-tools: Agent
---

# research — next-feature research invocation interface

Full procedure: `.claude/agents/research-agent.md`.

## When to invoke

Once at the end of **every build run**, after every task in the manifest has a
terminal status (`done`, `failed`, or `blocked`) — spawned **together with**
`/review-agent` in one batch so the two run in parallel (a dynamic workflow:
https://code.claude.com/docs/en/workflows). The call is **non-blocking**: a
research failure never fails or blocks the run.

Do NOT invoke:
- Mid-run while tasks are still pending or in-progress.
- For harness changes — use `/coreflow`.
- For parking an idea the human asked to save — use `/backlog-agent`.
- For questions or status requests — answer directly from files.

Research attaches only to build runs; harness runs and backlog runs never reach
this stage.

## Input contract

| Field | Value |
|---|---|
| `E` | Evolution number for this run |
| `run_branch` | The run branch name `ai/e<E>-<slug>` the report is committed on |
| `rule_pack` | The `<!-- LEARNED-RULES:START -->…END` block from `CLAUDE.md`, verbatim |

## Output contract

On success the agent returns ONLY this JSON:

```json
{
  "evolution": E,
  "report_path": "research/RESEARCH-NNNN-<slug>.md",
  "commit": "sha of the report commit pushed to the run branch, else null",
  "candidates": [
    {"feature": "...", "user_demand": 1, "product_fit": 1, "differentiation": 1, "total": 3}
  ],
  "winner": {"feature": "one-line description of the winning feature", "total": 12, "rationale": "one line"},
  "sources": ["competitor or app-review source surveyed", "..."],
  "notes": "anything the orchestrator must know, else empty string"
}
```

`candidates` always carries exactly three objects, each scored 1–5 on
**user demand / frequency**, **product-fit / alignment**, and **competitive
differentiation** (no build-effort dimension). `winner.feature` is the verbatim
feature description to hand to `backlog-agent`.

## Failure signal

`PHASE-FAILURE: <reason>` — research could not complete (web-research tools
unavailable, run branch not checked out, `git` broken). The orchestrator records
it in the Run Report and routes nothing to backlog; the run still concludes.

## Post-condition

The `research/RESEARCH-NNNN-<slug>.md` report is committed and pushed on the run
branch (never to `main`). The agent does **not** write `BACKLOG.md`: the
orchestrator routes the returned `winner.feature` to `backlog-agent` (the sole
`BACKLOG.md` writer), which self-publishes its own `backlog/<slug>` PR. After
this phase is established the orchestrator may own research end-to-end and run it
every build run without asking the human again.
