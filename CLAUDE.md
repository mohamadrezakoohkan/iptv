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
4. **Every terminal failure becomes a rule** — see §5 of `CORE_FLOW.md`. You
   write the `failures/FAIL-NNNN-*.md` record and append the rule below. This
   is the only product-adjacent writing you are allowed to do, plus correcting
   task-status front-matter when it disagrees with reality, plus committing
   the terminal-failure state to the run branch (CORE_FLOW.md §5) — never to
   `main`.

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
  changes load at next session start. The agent leaves its changes
  uncommitted — committing harness changes is the human's decision.

## Pipeline summary (canonical version: CORE_FLOW.md §4)

| Phase | Agent (`subagent_type`) | In | Out |
|---|---|---|---|
| 1 SPEC | `spec-agent` | user prompt, E, Rule Pack | run branch `ai/e<E>-<slug>`, specs + ADRs + tasks, first commit + PR opened, JSON manifest |
| 2 IMPLEMENT | `implement-agent` | task ID, Rule Pack, last validation report | code + unit, UI, & integration tests, task → `validating` (no commits) |
| 3 VALIDATE | `validate-agent` | task ID | full unit + UI suites executed (+ integration suite if command present); PASS/FAIL report; on PASS task commit + push + PR update |
| 4 REVIEW | `review-agent` | E, manifest, outcomes, Rule Pack | coherence verdict, CHANGELOG `#E`, README sync, final commit + PR finalized |

- Phases 2+3 loop per task, sequentially, budget **1 initial + 3 retries**;
  on exhaustion: failure protocol, task `failed`, dependents `blocked`,
  continue with independent tasks.
- Phase 4 always runs. Review discrepancies get one remediation round, then
  are recorded as failures — never hidden.
- ADR ↔ code traceability (CORE_FLOW.md §3): ADRs declare `governs:`, every
  governed code file carries an `ADR: ADR-NNNN` comment, and a change that
  removes a decision's last code marks its ADR `status: deleted` (the ADR
  file itself is never removed — it is history).
- Git & PR contract (CORE_FLOW.md §3): no actor ever commits or pushes to
  `main`, force-pushes, or merges a PR (`.claude/settings.json` deny rules
  back this up). spec-agent creates branch `ai/e<E>-<slug>`, makes the run's
  first commit, and opens the PR; validate-agent commits, pushes, and updates
  the PR description per passed task; you commit terminal-failure state;
  review-agent makes the final commit and finalizes the PR. Merging is the
  human's decision.
- Finish every run with the Run Report (CORE_FLOW.md §6) — including the run
  branch and PR URL.
- Outside the pipeline: `coreflow-agent` maintains the harness itself
  (CORE_FLOW.md §4.4) — it owns `CORE_FLOW.md`, this file, the agent
  definitions, `.claude/skills/**`, templates, `.claude/settings.json`,
  `.claude/hooks/**`, and `.github/workflows/validate-ai-instructions.yml`,
  and never touches product artifacts.

## Directory map

`specs/` living specs (incl. required `specs/project.md` with canonical
build/test commands) · `adrs/` decisions · `tasks/` work units with status
front-matter · `failures/` failure records · `CHANGELOG.md` numbered Evolution
Log · `README.md` product doc · `.claude/agents/` the five subagents ·
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
| `/coreflow` | harness | harness change instructions |

The full agent procedure lives in `.claude/agents/<name>.md`. The skill is the
caller-facing contract only — trigger, inputs, outputs, failure signal.

## Learned Rules

Append-only. Each rule: `- **R-NNNN** (FAIL-NNNN, E<N>): <imperative rule>`.
Edit or retire a rule only on explicit human instruction.

<!-- LEARNED-RULES:START -->
- **R-0001** (FAIL-0001, E2): Before writing unit tests that assert DOM attribute mutations (`setAttribute` / `removeAttribute`), check the baseline HTML to confirm which attributes are actually present on the element — never assert that an attribute is added back if it was never in the source HTML.
<!-- LEARNED-RULES:END -->
