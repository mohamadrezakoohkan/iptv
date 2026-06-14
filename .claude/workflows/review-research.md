---
name: review-research
description: >-
  Post-VALIDATE Phase 4 fan-out for the CORE_FLOW build pipeline. Invoked by the
  orchestrator once VALIDATE has concluded for ALL tasks in a run. Spawns
  review-agent (blocking — finalizes the run PR) and research-agent (non-blocking
  — proposes the next product feature) at the same level, injecting the Rule Pack
  into both. See CORE_FLOW.md §4.6.
---

# Workflow: review-research (Phase 4 fan-out)

The orchestrator runs this saved workflow after VALIDATE concludes for every
task. It launches the two Phase 4 sibling agents together. The Rule Pack (the
`<!-- LEARNED-RULES:START -->…END` block of `CLAUDE.md`, verbatim) MUST be
injected into BOTH agent prompts — no agent runs without it (CORE_FLOW.md §1,
§4.2).

## Inputs (from the orchestrator)

| Field | Value |
|---|---|
| `E` | Evolution number for this run |
| `prompt` | The run's build prompt |
| `manifest` | spec-agent's JSON manifest (ADRs + tasks) |
| `outcomes` | Per-task result `{ "TASK-NNNN": "done | failed (FAIL-NNNN) | blocked" }` |
| `rule_pack` | The Learned Rules block from `CLAUDE.md`, verbatim |

## Steps

1. **Spawn `review-agent` (blocking).** Inputs: `E`, `manifest`, `outcomes`,
   `rule_pack`. It runs the Phase 4 REVIEW coherence check, appends CHANGELOG
   `#E`, syncs README, makes the run's final commit, and finalizes the run PR
   (CORE_FLOW.md §4.2 Phase 4 REVIEW, `/review-agent`). The run cannot conclude
   until review-agent returns; its DISCREPANCIES path (one remediation round)
   and PHASE-FAILURE path are handled by the orchestrator as defined in
   CORE_FLOW.md §4.2 / §5.

2. **Spawn `research-agent` (non-blocking, same level, in parallel).** Inputs:
   `E`, `prompt`, `product_context` (`docs/specs/`, `README.md`, `BACKLOG.md`,
   `CHANGELOG.md`), `rule_pack`. It runs Phase 4 RESEARCH (`/research`,
   CORE_FLOW.md §4.6): 3 scored next **product** features, returning the winner
   + full report content. It may run in the background and finish after
   review-agent or after the Run Report. **It never gates step 1, the run PR, or
   the Run Report.**

3. **On research-agent success — orchestrator backlog handoff.** The
   orchestrator (not the workflow, not research-agent) spawns `backlog-agent` in
   its research-handoff variant (`/backlog-agent`, CORE_FLOW.md §4.5, §4.6) with
   the verbatim `winner.feature_prompt` + `E` + `report_markdown` + the winner
   score. backlog-agent commits the report at `docs/research/E<N>-<slug>.md`
   alongside its `BACKLOG.md` entry on a `backlog/<slug>` PR.

4. **On research-agent PHASE-FAILURE — record for visibility only.** The
   orchestrator notes the miss in the Run Report and, if warranted, appends a
   `research-miss` line to the **Research misses** section of
   `failures/NEAR-MISSES.md` — **excluded** from the §5 recurrence count (no
   `root-cause-tag`, never auto-earns a rule). The run still completes green.

## Concurrency contract

- review-agent is **blocking**; research-agent is **non-blocking** and runs at
  the same level, launched together with review-agent.
- RESEARCH never blocks REVIEW, PR finalization, or the Run Report.
- Neither agent spawns the other or spawns backlog-agent; the orchestrator owns
  every handoff (CORE_FLOW.md §1 separation of powers).
- The Rule Pack is injected into both agent prompts.
