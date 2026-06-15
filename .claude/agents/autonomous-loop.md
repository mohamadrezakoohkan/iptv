# Autonomous Build Loop — Orchestrator Runbook

> **This is an orchestrator runbook, NOT a spawnable subagent.** It has no
> agent frontmatter on purpose: the autonomous build loop is the
> ORCHESTRATOR's own control flow (the main session runs it), and per
> CORE_FLOW.md §2 agents are stateless workers that never spawn agents or steer
> the pipeline. Do not register this file as a `subagent_type` and never spawn
> it with the Agent tool. The orchestrator reads this document and follows it
> itself; the eight-actor count in CORE_FLOW.md §2 is unchanged by this file.

The loop runs the standard CORE_FLOW build pipeline (§4) repeatedly,
once per Evolution, draining the product backlog and shipping each
research-proposed next feature, until the human stops it or a stated stop
condition is met. It invents no new phase and no new agent — it is a wrapper
around §4.2 that the orchestrator drives. Cross-reference, never duplicate, the
per-phase procedures in `.claude/agents/<name>.md` and CORE_FLOW.md §4.

## Trigger

The human asks to build features autonomously in a continuous loop — e.g.
"keep building features forever until I stop you", "keep shipping the next
feature until you finish e23". The human may attach a **stop condition**
(an evolution number, a feature count, "until the backlog is empty", or
"until I say stop") and/or a **starting item**. Absent a stop condition, the
loop runs until the human interrupts.

This is the only path that chains build runs without a human prompt between
them. It does not change routing (CORE_FLOW.md §4.1): each iteration is still a
build run, and a non-build prompt inside the loop is still split out and routed
(harness → coreflow-agent, backlog → backlog-agent, question → answered from
files) per §4.1.

## What one iteration is

**One iteration = one full CORE_FLOW build run = one Evolution = one PR**
(CORE_FLOW.md §4.2). The orchestrator does NOT invent a shortcut: every
iteration runs SPEC → IMPLEMENT+VALIDATE (per task) → REVIEW + RESEARCH exactly
as §4.2 defines, with the Rule Pack injected into every spawned agent.

## Procedure (per iteration N)

1. **Pick the next feature to build.** In priority order:
   a. If `BACKLOG.md` has an unbuilt top item, use it as the build prompt.
   b. Otherwise use the **research winner carried forward** from iteration
      N-1's Phase 4 RESEARCH (its `winner.feature_prompt`, CORE_FLOW.md §4.6).
      Within one session, build and backlog PRs are human-merge-gated, so
      `main`'s `BACKLOG.md` does not grow between iterations — the carry-forward
      winner is the source of the next prompt when the backlog is empty.
   c. On the **first** iteration with neither a backlog item nor a carried
      winner (e.g. a cold start), use the human's seed feature if they gave one;
      if they gave none, run one normal build run from their prompt and let its
      RESEARCH seed iteration 2.

2. **Compute `E` and stack the run branch (KEY — CORE_FLOW.md §3, §4.2).**
   `E` = last `#N` in `CHANGELOG.md` + 1, counting the run branches already
   created this session (they have not merged to `main`, so `main`'s CHANGELOG
   does not advance between iterations). Because build PRs and backlog PRs are
   NOT auto-merged, `main` does not move during the loop, so each successive run
   **stacks** on the prior run's branch:
   - Iteration 1 branches per the default posture — fresh from `main` via the
     Claude Code worktree (`worktree.baseRef: "fresh"`, CORE_FLOW.md §3).
   - Iteration N (N≥2) creates `ai/e<E>-<slug>` from the **current run-branch
     HEAD** (`ai/e<E-1>-<slug>`), NOT fresh from `main`, so consumed-backlog
     state, prior features, and the contiguous Evolution/ADR/TASK numbering
     carry forward. This is the documented "draining several unmerged
     evolutions in one session" override of the default fresh-from-main posture
     (CORE_FLOW.md §3); the default single-run posture is unchanged and
     `.claude/settings.json` still pins `worktree.baseRef: "fresh"`.
   Pass each phase agent the **absolute run-tree path** and have it confirm the
   expected branch with `git rev-parse --abbrev-ref HEAD` before any work —
   subagents do not reliably inherit the session's worktree cwd. Each run's PR
   notes its stacking lineage (`stacked on ai/e<E-1>-<slug>`) and its
   merge-together dependency on the prior run's PR.

3. **Run the build pipeline (CORE_FLOW.md §4.2), unchanged.**
   - Phase 1 SPEC: spawn `spec-agent` with the chosen prompt verbatim, `E`, and
     the Rule Pack → run branch, specs/ADRs/tasks, first commit + PR, manifest.
   - Phases 2+3 per task in manifest order: `implement-agent` then
     `validate-agent`, budget 1 initial + 3 retries (§4.3). On exhaustion run
     the failure protocol (§5): FAIL record + rule, task `failed`, dependents
     `blocked`, continue independent tasks.
   - Phase 4: run the saved review+research workflow
     (`.claude/workflows/review-research.md`, §4.6) — `review-agent` (blocking,
     finalizes the run PR) and `research-agent` (non-blocking, opus, proposes
     the next product feature) at the same level, Rule Pack injected into both.
   Inject the Rule Pack (the `<!-- LEARNED-RULES:START -->…END` block of
   `CLAUDE.md`, verbatim) into **every** spawned agent — no agent runs without
   it (CORE_FLOW.md §1, §4.2).

4. **Hand the RESEARCH winner to backlog-agent (orchestrator-owned, §4.6).**
   On research-agent success, spawn `backlog-agent` in its research-handoff
   variant with the verbatim `winner.feature_prompt`, `E`, the `report_markdown`,
   and the winner score → a `backlog/<slug>` PR carrying the report at
   `docs/research/E<N>-<slug>.md`. research-agent never spawns backlog-agent —
   the orchestrator owns the handoff (§1). On a research miss, record it for
   visibility only (§4.6, §5) and continue; RESEARCH never gates the next
   iteration or the Run Report.

5. **Record failures and near-misses exactly as normal (CORE_FLOW.md §5).**
   Write `failures/FAIL-NNNN-*.md` + the earned rule for every terminal failure;
   append one `failures/NEAR-MISSES.md` row per persistent recovered near-miss
   review-agent surfaces; auto-promote a `root-cause-tag` to a rule once it
   recurs ≥ 2 times across recorded entries. A newly earned rule joins the Rule
   Pack and is injected into every later iteration — the loop gets smarter as it
   runs.

6. **Emit the per-iteration Run Report (CORE_FLOW.md §6).** One Run Report per
   iteration: evolution number + outcome, run branch + PR URL (with its
   stacking lineage), ADRs, tasks done/failed/blocked, rules earned, the
   research outcome (winner + score + backlog PR URL, or a recorded miss), and
   anything needing a human decision (merging the run PR and backlog PR always
   do). RESEARCH is non-blocking — do not delay the Run Report for it.

## Loop continuation & termination

After step 4 of iteration N, **immediately begin iteration N+1** using that
iteration's research winner (or the next backlog item, per step 1) as the build
prompt. Repeat until:

- the human **interrupts** (their word ends the loop after the current
  iteration's Run Report), or
- a **stated stop condition** is met (e.g. "stop when you finish e23" → stop
  after that Evolution's Run Report; "until the backlog is empty" → stop when
  step 1 finds no backlog item and no carried winner).

Do not wait on RESEARCH (non-blocking) to start the next iteration, and never
let a non-blocking research miss stall the loop — a missed iteration simply
carries no new winner; pick the next backlog item or surface the empty queue.

## Non-negotiables (restated from CORE_FLOW.md)

These hold on every iteration, exactly as outside the loop:

- The **orchestrator never writes product artifacts** itself — it only spawns
  agents, sequences phases, enforces retries, and records failures/rules
  (CORE_FLOW.md §1, §2).
- The **Rule Pack is injected into every spawned agent** (§4.2).
- **No actor commits, pushes, or merges to `main`, and none force-pushes**
  (§3 Git contract); merging every run PR and backlog PR is the human's
  decision.
- The **whole loop runs inside the run's Claude Code worktree**; each iteration
  stays on its own `ai/e<E>-<slug>` branch (§3, §4.2).
- A prompt that **mixes routes** is split and routed per §4.1; **questions /
  status** requests are answered from the files with no pipeline.

## Failure / stop signal

The loop is orchestrator control flow, so it does not return a `PHASE-FAILURE`
JSON the way a subagent does. Instead:

- A **terminal failure inside an iteration** follows the normal failure
  protocol (§5) and does not stop the loop unless every remaining task is
  blocked or the human says so — the iteration's Run Report states the failure
  and the loop continues to N+1.
- The loop **stops** on human interruption, on a met stop condition, or when a
  precondition for a build run cannot be satisfied (e.g. `git`/`gh`
  unavailable, which is a `PHASE-FAILURE` at the spec phase, CORE_FLOW.md §3).
  When the loop stops, the orchestrator states why in the final iteration's Run
  Report.
