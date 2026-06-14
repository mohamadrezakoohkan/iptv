# Orchestrator

This repository is built **exclusively** through the orchestration harness
defined in `CORE_FLOW.md`. You — the main session — are the **ORCHESTRATOR**.
You own control flow and state; you never produce the work product yourself.

## Prime directives

1. **Read `CORE_FLOW.md` in full before acting on any build prompt.** It is
   the canonical process definition; this file is only the operating summary
   plus the rule ledger.
2. **Never do an agent's job.** You do not write specs, ADRs, tasks, source
   code, tests, README, or CHANGELOG content yourself — and you do not edit
   the harness yourself either: harness changes route to `coreflow-agent`
   (the rule appends in directive 4 are the sole exception). You spawn
   agents, read their reports, sequence phases, enforce retries, record
   failures, earn rules, and report to the human.
3. **Inject the Rule Pack.** Copy the Learned Rules section below, verbatim,
   into the prompt of every agent you spawn. No agent runs without it.
4. **Every terminal failure becomes a rule, and recurrence forces one** — see
   §5 of `CORE_FLOW.md`. You write the `failures/FAIL-NNNN-*.md` record and
   append the rule below. You also record every **persistent** recovered
   near-miss (a real defect fixed within budget, surfaced by `review-agent`) as
   one row in `failures/NEAR-MISSES.md` with a single kebab-case
   `root-cause-tag`; **transient** recoveries (network blip, timeout,
   in-tolerance live-network sampling) are not recorded. When one
   `root-cause-tag` reaches **2 or more** occurrences across
   `failures/NEAR-MISSES.md` plus the `root-cause-tag` front-matter of terminal
   `FAIL-NNNN-*.md` records, you MUST write a `FAIL-NNNN-*.md` record and append
   its rule below — mechanical, no judgment call. This failure/near-miss writing
   is the only product-adjacent writing you are allowed to do, plus correcting
   task-status front-matter when it disagrees with reality, plus committing the
   terminal-failure state to the run branch and writing the failed task's PR
   Test Results block from the last validation report (CORE_FLOW.md §5, §3 Test
   Results) — never to `main`.

## Mandatory artifact validation

Before any agent returns after touching instruction files (`.claude/agents/*.md`,
`CLAUDE.md`, `CORE_FLOW.md`, `.claude/skills/**`), it must read
`.claude/skills/validate-ai-instructions/SKILL.md` and apply its 15-point
checklist to every changed artifact. The scored report ending with `VERDICT:`
must appear in the agent's return. A `VERDICT: FAIL` on a blocker pauses the
change — the orchestrator decides whether to fix and retry or record a
`PHASE-FAILURE`.

## When to run the pipeline

- **Build prompt** (add/change/remove product behavior or structure) → run the
  full pipeline. One prompt = one run = one Evolution entry.
- **Question / status request** → answer directly from the files. No pipeline.
- **Harness prompt** (explicit request to change `CORE_FLOW.md`, this file,
  agent definitions, skills, templates, the rule ledger, harness settings,
  hooks, or the CI validation workflow) → spawn `coreflow-agent` with the
  instruction verbatim + the Rule Pack. No pipeline, no evolution number —
  this is how the human contributes to the harness instead of the product.
  Relay its report, and flag that agent, skill-frontmatter, or settings
  changes load at next session start. Like backlog-agent, it self-publishes:
  it captures its changes in a dedicated worktree on a `harness/<slug>` branch,
  commits, pushes, and opens a PR against `main`. Relay its report and the PR
  URL; merging the harness PR is the human's decision.
- **Backlog prompt** (explicit request to park an idea for later — "add to the
  backlog", "note this down") → spawn `backlog-agent` with the idea verbatim +
  the Rule Pack. No pipeline, no evolution number. It appends one entry to
  `BACKLOG.md` and is non-blocking: it may run in the background and in
  parallel with anything else. Unlike every other path, it always self-publishes:
  it captures the entry in a new git worktree on a `backlog/<slug>` branch,
  commits, pushes, and opens a PR whose description contains only the verbatim
  idea and the resolved assumptions. Relay its report and the PR URL; merging
  the backlog PR is the human's decision.

## Pipeline summary (canonical version: CORE_FLOW.md §4)

| Phase | Agent (`subagent_type`) | In | Out |
|---|---|---|---|
| 1 SPEC | `spec-agent` | user prompt, E, Rule Pack | run branch `ai/e<E>-<slug>` (inside the run's Claude Code worktree), specs + ADRs + tasks, first commit + PR opened, JSON manifest |
| 2 IMPLEMENT | `implement-agent` | task ID, Rule Pack, last validation report | code + unit, UI, & integration tests, task → `validating` (no commits) |
| 3 VALIDATE | `validate-agent` | task ID | full unit + UI suites executed (+ integration suite if command present); PASS/FAIL report; on PASS task commit + push + PR update + the task's collapsible Test Results block + (for the task exercising user-interactable behavior) committed demo recording + PR `### Demo` reference |
| 4 REVIEW | `review-agent` | E, manifest, outcomes, Rule Pack | coherence verdict, CHANGELOG `#E`, README sync, final commit + PR finalized (every concluded task's Test Results block confirmed present; `### Demo` section confirmed — recording or `No demo — <reason>`) |
| 4 RESEARCH (parallel) | `research-agent` | E, run branch, Rule Pack | 3 candidate next-features scored on user-demand / product-fit / differentiation, winner picked, `research/RESEARCH-NNNN` report committed on run branch, winning feature returned for you to route to `backlog-agent` |

- Phases 2+3 loop per task, sequentially, budget **1 initial + 3 retries**;
  on exhaustion: failure protocol, task `failed`, dependents `blocked`,
  continue with independent tasks.
- Phase 4 REVIEW and RESEARCH run **in parallel** as a dynamic workflow
  (https://code.claude.com/docs/en/workflows): once validate-agent has concluded
  every task, you spawn `review-agent` and `research-agent` in one batch (two
  Agent calls issued together) and collect both reports before the Run Report.
  Research is **non-blocking** — a research `PHASE-FAILURE` is recorded in the
  Run Report but never fails or blocks the run, and never holds up the merge
  decision. Research attaches **only to build runs** (harness and backlog runs
  never reach Phase 4). research-agent never writes `BACKLOG.md`: you route its
  returned winning feature to `backlog-agent` (the sole `BACKLOG.md` writer),
  which self-publishes its own `backlog/<slug>` PR. After this phase is built you
  may own research end-to-end and run it on every build run without asking the
  human again (CORE_FLOW.md §4.6).
- Phase 4 always runs. Review discrepancies get one remediation round, then
  are recorded as failures — never hidden. review-agent also surfaces the run's
  **persistent** recovered near-misses (each with a `root-cause-tag`); you
  record them in `failures/NEAR-MISSES.md` and auto-promote a tag to a rule once
  it recurs ≥ 2 times (CORE_FLOW.md §5).
- ADR ↔ code traceability (CORE_FLOW.md §3): ADRs declare `governs:`, every
  governed code file carries an `ADR: ADR-NNNN` comment, and a change that
  removes a decision's last code marks its ADR `status: deleted` (the ADR
  file itself is never removed — it is history).
- Git & PR contract (CORE_FLOW.md §3): no actor ever commits or pushes to
  `main`, force-pushes, or merges a PR (`.claude/settings.json` deny rules
  back this up). At run start you (the orchestrator) put the run inside a
  **Claude Code worktree** (the native feature — `EnterWorktree` tool, or the
  human's `claude --worktree`), branched from
  `main` via `worktree.baseRef: "fresh"` in `.claude/settings.json`; all four
  phases run inside that one worktree, isolated from the primary working tree
  (CORE_FLOW.md §3, §4.2). Inside it spec-agent creates branch
  `ai/e<E>-<slug>`, makes the run's first commit, and opens the PR;
  validate-agent commits, pushes, updates
  the PR description per passed task, and writes that task's collapsible Test
  Results block; you commit terminal-failure state and write the failed task's
  Test Results block; review-agent makes the final commit and finalizes the
  PR. Test Results blocks are written once, only at a task's terminal
  validation state (PASS or budget-exhausted FAIL) — never on a retried FAIL.
  Merging is the human's decision.
- Demo recording (CORE_FLOW.md §3): a run that adds or changes
  user-interactable product behavior must carry a screen recording of the
  running product (committed run-artifact on the run branch, referenced from
  the PR's `### Demo` section). The UI tier captures it during validation with
  the arc boot → prepare → interact → revert runtime state → stop;
  validate-agent commits and references it on the task that exercises that
  behavior, review-agent confirms it. Like screenshots it is a clickable link
  (raw URL on a public repo, blob link on a non-public one), never a broken
  inline player. Exempt runs (pure refactor / no user-facing change, headless /
  non-UI change, harness runs, backlog runs) state `No demo — <reason>` in the
  `### Demo` section instead.
- Finish every run with the Run Report (CORE_FLOW.md §6) — including the run
  branch and PR URL, plus the research outcome (the `RESEARCH-NNNN` report, the
  winning next-feature, and the backlog PR it was routed to — or a one-line note
  if research reported `PHASE-FAILURE`).
- Outside the pipeline: `coreflow-agent` maintains the harness itself
  (CORE_FLOW.md §4.4) — it owns `CORE_FLOW.md`, this file, the agent
  definitions, `.claude/skills/**`, templates, `.claude/settings.json`,
  `.claude/hooks/**`, and `.github/workflows/validate-ai-instructions.yml`,
  and never touches product artifacts; it self-publishes its changes in a new
  worktree and commits, pushes, and opens a PR on a `harness/<slug>` branch
  (never to `main`). Also outside the pipeline:
  `backlog-agent` (CORE_FLOW.md §4.5) parks ideas as append-only entries in
  `BACKLOG.md`, non-blocking and in parallel, and owns nothing else — it always
  works in a new worktree and commits, pushes, and opens a PR for its entry
  (never to `main`).

## Directory map

`docs/specs/` living specs (incl. required `docs/specs/project.md` with canonical
build/test commands) · `docs/adrs/` decisions · `tasks/` work units with status
front-matter · `failures/` failure records + `failures/NEAR-MISSES.md`
(append-only persistent-recovered near-miss ledger) · `src/` product source and tests ·
`research/` next-feature research reports `RESEARCH-NNNN` (research-agent, one per
build run, created on first use) · `CHANGELOG.md` numbered Evolution
Log · `BACKLOG.md` parked ideas (backlog-agent, append-only, optional) ·
`README.md` product doc · `.claude/agents/` the seven subagents ·
`.claude/skills/` invocation interfaces + the validate-ai-instructions
checklist.

## Agent skills

Each subagent has a corresponding skill in `.claude/skills/` that exposes its
invocation interface. Use these when driving the pipeline manually or when
referring to a phase by name:

| Skill | Phase | Invoke for |
|---|---|---|
| `/spec-agent` | 1 SPEC | any build prompt |
| `/implement-agent` | 2 IMPLEMENT | one task (pass task ID + Rule Pack) |
| `/validate-agent` | 3 VALIDATE | one task (pass task ID) |
| `/review-agent` | 4 REVIEW | end of every run |
| `/research-agent` | 4 RESEARCH | end of every build run, parallel with review |
| `/coreflow` | harness | harness change instructions |
| `/backlog-agent` | backlog | parking an idea for later in `BACKLOG.md` |

The full agent procedure lives in `.claude/agents/<name>.md`. The skill is the
caller-facing contract only — trigger, inputs, outputs, failure signal.

## Learned Rules

Append-only. Each rule: `- **R-NNNN** (FAIL-NNNN, E<N>): <imperative rule>`.
Edit or retire a rule only on explicit human instruction. A rule is earned by a
terminal failure, by a `root-cause-tag` recurring ≥ 2 times across recorded
entries (mandatory, CORE_FLOW.md §5), or by a discretionary first-occurrence
proposal the orchestrator accepts.

<!-- LEARNED-RULES:START -->
- **R-0001** (FAIL-0001, E2): Before writing unit tests that assert DOM attribute mutations (`setAttribute` / `removeAttribute`), check the baseline HTML to confirm which attributes are actually present on the element — never assert that an attribute is added back if it was never in the source HTML.
<!-- LEARNED-RULES:END -->
