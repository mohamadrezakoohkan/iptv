---
name: autonomous-loop
description: >-
  Runs the CORE_FLOW autonomous build loop — the orchestrator chains full build
  runs (one Evolution / one PR each) back-to-back, draining BACKLOG.md and then
  shipping each Phase 4 RESEARCH winner, until the human stops it or a stated
  stop condition is met. Invoke when the human asks to build features
  autonomously in a continuous loop ("keep building until I stop you", "ship the
  next feature until you finish e23"). Do NOT invoke for a single build prompt
  (use /spec-agent), a harness change (/coreflow), a backlog note (/backlog-agent),
  or a question (answer from files).
allowed-tools: Read, Glob, Grep, Bash, Agent
---

# autonomous-loop — continuous build-loop runbook

Full procedure: `.claude/agents/autonomous-loop.md`.

This is an **orchestrator runbook**, not a spawnable subagent: the main session
runs the loop itself and spawns the pipeline agents each iteration. Per
CORE_FLOW.md §2 agents never spawn agents — so this is invoked by the
orchestrator, never registered as a `subagent_type`.

## When to invoke

The human asks the orchestrator to build features **autonomously in a
continuous loop**, without a prompt between Evolutions — e.g. "keep building
features forever until I stop you", "keep shipping the next feature until you
finish e23". Each iteration is one full CORE_FLOW build run (SPEC →
IMPLEMENT+VALIDATE → REVIEW + RESEARCH), one Evolution, one PR (CORE_FLOW.md
§4.2). The orchestrator owns the loop end-to-end.

Do NOT invoke for:
- A single build prompt — that is one run; use `/spec-agent` (Phase 1).
- A harness change — use `/coreflow`.
- Parking an idea — use `/backlog-agent`.
- A question or status request — answer directly from the files.

## Input contract

| Field | Value |
|---|---|
| `stop_condition` | Optional — when to stop: an evolution number ("finish e23"), a count, "until the backlog is empty", or "until I say stop". Absent → run until the human interrupts. |
| `starting_item` | Optional — the first feature to build. Absent → take the top of `BACKLOG.md`, else the human's seed prompt, else (cold start) run one normal build run whose RESEARCH seeds the next iteration. |
| `rule_pack` | The `<!-- LEARNED-RULES:START -->…END` block of `CLAUDE.md`, verbatim — injected into EVERY agent the loop spawns each iteration. |

## What it does each iteration (CORE_FLOW.md §4.2, §4.6)

1. **Pick the next feature** — top unbuilt `BACKLOG.md` item, else the prior
   iteration's carried-forward RESEARCH winner (`winner.feature_prompt`).
2. **Stack the run branch** — iteration 1 branches fresh from `main` (default
   posture, `worktree.baseRef: "fresh"`); iteration N≥2 branches
   `ai/e<E>-<slug>` from the prior run-branch HEAD (NOT fresh from `main`), so
   unmerged backlog/feature state and contiguous numbering carry forward. The
   PR notes its stacking lineage.
3. **Run the pipeline** — SPEC → IMPLEMENT+VALIDATE per task (budget 1+3) →
   the saved review+research workflow (review-agent blocking, research-agent
   non-blocking opus). Rule Pack injected into every spawned agent.
4. **Hand the RESEARCH winner to backlog-agent** (research-handoff variant) →
   a `backlog/<slug>` PR.
5. **Record failures / near-misses and promote rules** exactly per §5.

## Output cadence

**One Run Report per iteration** (CORE_FLOW.md §6): evolution number + outcome,
run branch + PR URL (with stacking lineage), ADRs, tasks done/failed/blocked,
rules earned, the research outcome (winner + score + backlog PR URL, or a
recorded miss), and human decisions pending (merging each run PR and backlog PR
is always the human's). RESEARCH is non-blocking, so the Run Report is never
delayed for it. After each Run Report the next iteration begins automatically.

## Failure / stop signal

The loop is orchestrator control flow, so it emits no subagent `PHASE-FAILURE`
JSON. It **stops** on: the human's interruption (ends the loop after the current
iteration's Run Report), a met `stop_condition` (e.g. the named evolution
shipped, or the backlog drained with no carried winner), or an unsatisfiable
build precondition (e.g. `git`/`gh` unavailable — a spec-phase `PHASE-FAILURE`,
CORE_FLOW.md §3). A terminal failure inside an iteration follows the §5 failure
protocol and does not by itself stop the loop; the iteration's Run Report states
it and the loop continues. When the loop stops, the final Run Report states why.
