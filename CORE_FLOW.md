# CORE_FLOW — Orchestration Harness

This document is the standalone, canonical definition of the orchestration
harness that drives this repository. It defines **how work happens**, never
**what is being built**. If you copied this file — together with `CLAUDE.md`,
`.claude/agents/`, `.claude/skills/`, and the folder templates — into an empty
directory, the harness would work unchanged for any product.

**Hard rule: no product specifics in this file.** Product knowledge lives in
`docs/specs/`, `docs/adrs/`, `README.md`, and the source tree. This file changes only
when the harness itself changes, and only on an explicit human instruction
executed by `coreflow-agent` (§4.4) — never as a side effect of a build run.

---

## 1. Philosophy

The project evolves exclusively through numbered prompts. A human writes a
prompt; the harness turns it into specifications, decisions, tasks, code,
unit tests, and documentation — and converts every terminal failure into a
permanent rule so the same mistake cannot be made twice.

Three properties the harness must always preserve:

1. **Artifact-first.** Nothing counts unless it is written to a file. Specs,
   decisions, tasks, failures, and rules are files. Conversation memory is
   never load-bearing: any new session must be able to resume the project from
   the files alone.
2. **Separation of powers.** The orchestrator owns control flow — sequencing,
   retries, failure recording, reporting. Agents own the work. No agent steers
   the pipeline, and the orchestrator never does an agent's work itself.
3. **Learning by failing.** Every terminal failure produces a rule. Rules are
   permanent, live in `CLAUDE.md`, and are injected into every future run. The
   harness gets smarter as the failure archive grows.

## 2. Actors

Eight actors: **one orchestrator + seven subagents** — four pipeline phase
agents and one non-blocking research agent that runs alongside Phase 4, plus
one harness maintainer and one backlog capturer that both run outside the
pipeline.

| Actor | Phase | May write | Must never |
|---|---|---|---|
| **Orchestrator** (main session) | all | `failures/` (terminal records + the `failures/NEAR-MISSES.md` ledger, §5), Learned Rules in `CLAUDE.md`, task-status corrections, terminal-failure commits on the run branch (§5), the failed task's PR Test Results block (§3); puts the run inside a Claude Code worktree at run start (§3, §4.2) | write specs, ADRs, code, tests, or product docs itself |
| **spec-agent** | 1 — SPEC | `docs/specs/`, `docs/adrs/`, `tasks/`; creates the run branch, makes the run's first commit, opens the run PR (§3) | write source code or tests |
| **implement-agent** | 2 — IMPLEMENT | source code, unit tests, task status, ADR traceability fields (`governs:`, `status: deleted`) | edit specs or ADR decision content, mark its own work `done`, run `git commit` / `git push` / `gh` |
| **validate-agent** | 3 — VALIDATE | task status + attempt count; on PASS the per-task commit, push, PR description update, the task's PR Test Results block (§3) | fix code or tests (it reports, never repairs) |
| **review-agent** | 4 — REVIEW | `CHANGELOG.md`, `README.md`; the run's final commit, push, and PR description finalization (§3) | change product code, tests, specs, or ADRs |
| **research-agent** | 4 — RESEARCH (non-blocking, alongside REVIEW) | produces the run's research report content and returns it plus the scored winning feature to the orchestrator (§4.6); it persists no committed file — backlog-agent writes `docs/research/E<N>-<slug>.md` on the backlog branch | spawn or trigger any agent (including backlog-agent), commit/push/merge, write to `BACKLOG.md`, write product code/specs/ADRs/tasks, or block the run, REVIEW, or the Run Report |
| **coreflow-agent** | harness (outside the pipeline) | `CORE_FLOW.md`, `CLAUDE.md`, `.claude/agents/*.md`, `.claude/skills/**`, the three templates, `.claude/settings.json`, `.claude/hooks/**`, `.github/workflows/validate-ai-instructions.yml` — in its own dedicated worktree, where it commits, pushes, and opens the harness PR (§4.4) | touch any product artifact (source, `docs/specs/`, `docs/adrs/` records, `tasks/`, `failures/` records, `README.md`, `CHANGELOG.md`), run pipeline phases, spawn agents, or commit/push/merge to `main`, or force-push |
| **backlog-agent** | backlog capture (outside the pipeline) | `BACKLOG.md` — plus, when the orchestrator hands it a research winner, the run's research report `docs/research/E<N>-<slug>.md` committed alongside the entry (§4.5, §4.6) — in its own dedicated worktree, where it commits, pushes, and opens the backlog PR | touch any other file (product or harness), run pipeline phases, spawn agents, block on any other work, commit/push/merge to `main`, or force-push |

Git is part of the contract: **no actor — orchestrator included — ever commits
to `main`, pushes to `main`, force-pushes, or merges a pull request.** All run
work lands on the run's `ai/` branch and reaches `main` only through a PR
merged by the human (§3, Git & pull-request contract). The two outside-the-
pipeline paths always self-publish — `backlog-agent` on a `backlog/<slug>`
branch (§4.5) and `coreflow-agent` on a `harness/<slug>` branch (§4.4) — each
committing, pushing, and opening its own PR, but on its own branch only —
never to `main`.

The subagents are defined in `.claude/agents/<name>.md` and are spawned by the
orchestrator via the Agent tool with `subagent_type` set to the agent name.
Each subagent also has a caller-facing invocation interface in
`.claude/skills/` (trigger, inputs, outputs, failure signal); the agent
definition remains the full procedure.
Agents are **stateless workers**: everything they need arrives in their prompt
or is read from files; everything they produce is written to files plus a
structured final report back to the orchestrator. Agents never spawn other
agents and never talk to the human.

## 3. Repository contract

```
.
├── CLAUDE.md            Orchestrator instructions + Learned Rules (auto-loaded each session)
├── CORE_FLOW.md         This file — the harness definition
├── README.md            Product-facing doc (review-agent maintains)
├── CHANGELOG.md         Numbered Evolution Log (review-agent maintains)
├── BACKLOG.md           Parked ideas, append-only (backlog-agent maintains; optional, created on first use)
├── docs/specs/          Living specifications (spec-agent maintains)
│   └── project.md       REQUIRED: product overview, stack, canonical build/test commands
├── docs/research/       Next-feature research reports, one per run (research-agent produces; backlog-agent commits — §4.6; created on first use)
├── docs/adrs/           Architecture Decision Records (spec-agent creates)
│   └── TEMPLATE.md
├── tasks/               Work units derived from ADRs (spec-agent creates; later phases update status)
│   └── TEMPLATE.md
├── failures/            Failure records that earn rules (orchestrator writes)
│   ├── TEMPLATE.md
│   └── NEAR-MISSES.md    Append-only ledger of persistent recovered near-misses (orchestrator; created on first use)
├── src/                 Product source and tests (implement-agent writes)
├── .claude/agents/      The seven subagent definitions + the autonomous-loop
│                        orchestrator runbook (a procedure doc, not a subagent — §4.7)
├── .claude/skills/      Invocation interfaces (one per subagent, plus the
│                        autonomous-loop runbook) + the validate-ai-instructions checklist
└── .claude/workflows/   Saved Claude Code workflows the orchestrator invokes
                         (e.g. the post-VALIDATE review+research fan-out — §4.6)
```

### Identifiers

| Artifact | Format | Sequence |
|---|---|---|
| Evolution (CHANGELOG entry) | `#N` | last entry in `CHANGELOG.md` + 1 (`#0` = bootstrap) |
| ADR | `ADR-NNNN` | global, max existing in `docs/adrs/` + 1 |
| Task | `TASK-NNNN` | global, max existing in `tasks/` + 1 (linked to its ADR via front-matter) |
| Failure | `FAIL-NNNN` | global, max existing in `failures/` + 1 |
| Rule | `R-NNNN` | mirrors the `FAIL-NNNN` that earned it |

File names embed the ID: `docs/adrs/ADR-0001-<slug>.md`, `tasks/TASK-0001-<slug>.md`,
`failures/FAIL-0001-<slug>.md`. Specs are not numbered: `docs/specs/project.md` plus
one `docs/specs/<feature-slug>.md` per feature area, each with front-matter
`status: draft | current | superseded`.

### Task lifecycle

```
pending → in-progress → validating → done
                              ├────→ failed   (retry budget exhausted)
                              └────→ blocked  (a dependency failed)
```

Each task file carries front-matter: `id`, `adr`, `status`, `attempts`,
`depends_on`. `implement-agent` sets `in-progress` → `validating`;
`validate-agent` sets `done` or reports failure (orchestrator sets `failed` /
`blocked`). The orchestrator is the referee: if a status field and reality
disagree, the orchestrator corrects the file.

### Canonical commands

`docs/specs/project.md` is the single source of truth for how to build the product
and how to run the **unit test suite** — the only required test tier in this
harness. The first evolution must establish the unit-test command (via an ADR
choosing the stack). `validate-agent` refuses to validate if the unit-test
command is missing — that is a phase failure, not an excuse to guess. This
harness requires unit tests only; it has no UI-test or integration-test tier.

### ADR ↔ code traceability

Every ADR is bidirectionally linked to the code that implements its decision:

1. **ADR side.** ADR front-matter carries `governs:` — the code files (or
   directories, for pervasive decisions) created or shaped by the decision.
   `spec-agent` seeds it with planned paths; `implement-agent` trues it up as
   files are actually created, renamed, or removed.
2. **Code side.** Every governed file carries, near the top, a reference in
   its native comment syntax: `ADR: ADR-NNNN` (several ADRs: one
   comma-separated line). Formats that cannot carry comments (e.g. JSON) are
   linked from the ADR side only.
3. **Deletion.** When a change removes the last code implementing a decision —
   its `governs:` list becomes empty or every listed path is gone — whoever
   made that change marks the ADR `status: deleted`, noting the evolution.
   The ADR file itself is never removed: it is history.

ADR status meanings: `proposed` (not yet in force) · `accepted` (in force) ·
`superseded` (replaced by a newer ADR — set by `spec-agent`, pointers both
ways) · `deleted` (no code implements the decision anymore).

Maintaining these links is mechanical bookkeeping, not decision-making. It is
the single exception to "implement-agent never edits `docs/adrs/`": it may update
`governs:` and set `status: deleted`, never decision content. `review-agent`
audits traceability every run (§4.2 Phase 4).

### Git & pull-request contract

`main` is protected. The harness never commits to `main`, never pushes to
`main`, never force-pushes anywhere, and never merges or closes a pull
request — `main` advances **only** when the human merges a run's PR. Deny
rules in `.claude/settings.json` block the common command forms as a
backstop, but this contract — not the patterns — is the canonical
protection.

One build run = one branch = one pull request:

1. **A Claude Code worktree, branched from `main`.** Before Phase 1, the
   orchestrator puts the run inside a **Claude Code worktree** — the native
   feature (https://code.claude.com/docs/en/worktrees), entered with the
   `EnterWorktree` tool, or by the human having started the session with
   `claude --worktree`. The worktree always branches from the repository's
   default branch (`origin/HEAD` = `main`), starting from a clean tree matching
   the remote — the `worktree.baseRef: "fresh"` setting in
   `.claude/settings.json` makes the worktree branch from `main` on a clean
   tree. All four committing phases (SPEC, IMPLEMENT, VALIDATE, REVIEW) then run
   inside that single worktree — they share one working tree. The non-blocking
   Phase 4 RESEARCH (§4.6) runs alongside but never writes to the run branch —
   its only durable output lands on a separate `backlog/<slug>` branch via
   backlog-agent.
   Inside it, `spec-agent` creates and checks out the run branch `ai/e<E>-<slug>`
   (the evolution number plus 2–5 kebab-case words condensing the prompt). No
   build work ever happens on `main` or in the primary working tree. If `git`
   or an authenticated `gh` CLI is unavailable, that is a `PHASE-FAILURE` — the
   harness does not build outside a run worktree.
2. **First commit, then PR.** `spec-agent` commits the Phase 1 artifacts as
   the run's first commit (`E<N> spec: <prompt, condensed>`), pushes the
   branch (`git push -u origin <run-branch>`), and immediately opens the run
   PR against `main` (`gh pr create`) with the description structure below.
3. **One commit per concluded task.** On PASS, `validate-agent` commits all
   working-tree changes of the task (`TASK-NNNN: <title>`), pushes, updates
   the PR description, and writes the task's Test Results block into the PR
   (see Test Results below). On terminal failure, the **orchestrator** commits
   the working-tree state together with the failure record
   (`FAIL-NNNN: TASK-NNNN failed terminally`), pushes, and writes the failed
   task's Test Results block from the last validation report — failures and
   their test evidence are visible in the PR, never hidden. `implement-agent`
   never commits; review remediation rounds follow the same per-task mechanics.
4. **Final commit.** `review-agent` commits its CHANGELOG/README updates
   (`E<N>: review`), pushes, and finalizes the PR description. The run ends
   with the PR open; merging — or closing — it is the human's decision.

Pushes are always explicit — `git push origin <run-branch>`, never a bare
`git push` — and run-branch history is append-only, like everything else in
this harness: no force pushes, no rebases, no amending pushed commits.

**PR description** — created by `spec-agent`, task lines updated by
`validate-agent` as tasks conclude, statuses and outcome finalized by
`review-agent`:

```
## Evolution #E — <prompt, one line>

### ADRs
- ADR-NNNN — <title>

### Tasks
- [ ] TASK-NNNN — <title> — pending

### Test Results
_Populated as each task reaches a terminal validation state._

### Outcome
_Run in progress._
```

A task's line becomes `- [x] … — done` when validated, or `- [ ] … — failed
(FAIL-NNNN)` / `- [ ] … — blocked` at finalization. The final Outcome states
shipped / partial / failed, the rules earned, and `Recorded as CHANGELOG #E`.

**Test Results** — collapsible test evidence, written **once per task, only at
its terminal validation state**: a PASS (task `done`) or the ultimate FAIL
after the retry budget is exhausted. Never written on an intermediate FAIL
that will be retried, and never duplicated across attempts. The actor that
makes the task's terminal commit owns its block: `validate-agent` on PASS, the
orchestrator on terminal FAIL. Each task contributes one Unit entry, using a
GitHub collapsible `<details>` block whose `<summary>` carries the test count
and the final state (`PASS` / `FAIL`):

```
#### TASK-NNNN — <title>

<details><summary>Unit — N tests, PASS</summary>

| Test | Result |
|---|---|
| <test name> | pass / fail |

</details>
```

Unit is the only test tier in this harness, so the block carries one
`<details>` entry only. On terminal FAIL the summary state is `FAIL` and the
unit table marks the failing rows.

The harness path (§4.4) self-publishes like the backlog path: `coreflow-agent`
commits its harness changes on a dedicated `harness/<slug>` branch, pushes, and
opens a PR against `main` — merging that PR is the human's decision. (Rule-ledger
appends during a build run are different: the orchestrator's terminal-failure
commit carries them on the run branch, as part of the run's record.) The backlog
path (§4.5) likewise always commits, pushes, and opens a PR for its single
appended entry — on a `backlog/<slug>` branch in its own worktree. Neither path
ever commits, pushes, or merges to `main`, and neither force-pushes.

## 4. The pipeline

### 4.1 Routing

Every human prompt takes exactly one of four routes:

- **Build prompt** — adds, changes, or removes product behavior or structure
  → the full pipeline below: one run, one Evolution entry.
- **Harness prompt** — an explicit request to change the harness itself
  (`CORE_FLOW.md`, `CLAUDE.md`, agent definitions, skills, templates, the
  rule ledger, harness settings, hooks, the CI validation workflow) →
  `coreflow-agent` (§4.4). No pipeline, no evolution number. This is how
  humans contribute to the harness instead of the product.
- **Backlog prompt** — an explicit request to park an idea for later ("add to
  the backlog", "note this down") → `backlog-agent` (§4.5). No pipeline, no
  evolution number; non-blocking, may run in the background and in parallel
  with anything else. It always captures the idea in a new worktree, commits,
  pushes, and opens a PR (§4.5).
- **Question / status request** → the orchestrator answers directly from the
  files. Nothing is spawned, nothing is written.

When a prompt mixes routes, split it and say so in the Run Report; when the
intent is ambiguous, ask the human rather than guess.

A request to **build features autonomously in a continuous loop** is not a fifth
route: it is the build route run repeatedly by the orchestrator. The orchestrator
follows the autonomous-loop runbook (§4.7), and each iteration is one ordinary
build run.

### 4.2 Run sequence

```
        ┌──────────────────────────── run start ────────────────────────────┐
        │ E = next evolution number;  Rule Pack = Learned Rules from CLAUDE.md │
        │ orchestrator enters a Claude Code worktree (from main, baseRef fresh)│
        └────────────────────────────────────────────────────────────────────┘
                                        │
Phase 1  SPEC        spec-agent: ai/e<E>-<slug> branch in the run worktree
                                  → specs + ADRs + tasks
                                  → first commit + push → open PR (manifest)
                                        │
Phase 2+3 per task   ┌─► implement-agent (task, rule pack, last failure report)
(in manifest order)  │            │
                     │   validate-agent: run the FULL unit suite
                     │            │
                     │       PASS ─► task done → commit + push + PR update
                     │       FAIL ─► attempt < 4 ? ──yes──┐
                     │                                    │ (loop back with report)
                     └────────────────────────────────────┘
                              attempt = 4 (1 initial + 3 retries) and still FAIL
                                        │
                          FAILURE PROTOCOL (§5): FAIL record + rule
                          + failure commit, task → failed,
                          dependents → blocked, continue others
                                        │
                     ┌──────────────────┴──────────────────┐  (review+research
                     │  VALIDATE concluded for all tasks    │   workflow, §4.6:
                     │  → orchestrator runs the saved        │   both spawned
                     │    review+research workflow (§4.6)    │   together, Rule
                     └──────────────────┬──────────────────┘   Pack injected)
                       ┌────────────────┴─────────────────┐
Phase 4 REVIEW         │                                   │  Phase 4 RESEARCH
(blocking)             │                                   │  (non-blocking)
review-agent:          │                                   │  research-agent
coherence check →      │                                   │  (opus): 3 next
CHANGELOG #E →         │                                   │  PRODUCT features →
README sync →          │                                   │  score → winner →
final commit + push    │                                   │  report content +
→ PR finalized         │                                   │  winner returned
                       └────────────────┬─────────────────┘   (never blocks)
                                        │
                     orchestrator hands the research winner + report content to
                     backlog-agent (§4.5, §4.6) → backlog/<slug> PR; a research
                     failure is recorded for visibility only (§5), never blocks
                                        │
                     Run Report to the human (§6) — review outcome + research
                     outcome (winning feature + backlog PR URL, or recorded miss)
```

**Run start (orchestrator).** Read this file in full. Compute `E`. Extract the
Learned Rules section of `CLAUDE.md` verbatim — this is the **Rule Pack**, and
it MUST be included in the prompt of every agent spawned during the run. Then
put the run inside a **Claude Code worktree** (§3 Git contract): enter it with
the `EnterWorktree` tool unless the human already started the session with
`claude --worktree`. The worktree branches from `main` (`worktree.baseRef:
"fresh"`), and all four committing phases run inside it; the non-blocking
Phase 4 RESEARCH (§4.6) runs alongside but commits only via backlog-agent's own
`backlog/<slug>` branch.

**Phase 1 — SPEC.** Spawn `spec-agent` with: the user prompt verbatim, `E`, and
the Rule Pack. The agent reads `CORE_FLOW.md`, everything in `docs/specs/`, and
everything in `docs/adrs/` to understand the project, then:
1. creates and checks out the run branch `ai/e<E>-<slug>` inside the Claude
   Code worktree the orchestrator entered at run start (§3 Git contract) and
   does all of its Phase 1 work there — build work never happens on `main` or
   in the primary working tree,
2. aligns the prompt with the existing project (or defines the project, on the
   first run),
3. creates or updates spec files in `docs/specs/`,
4. writes one ADR per significant decision the prompt forces, seeding its
   `governs:` list with the code paths its tasks will create or shape,
5. derives an ordered set of tasks for each ADR — each task small enough to
   implement and validate in one agent run, with acceptance criteria and
   explicit unit-test requirements (unit tests are the only test tier),
6. commits the Phase 1 artifacts as the run's first commit, pushes the
   branch, and opens the run PR against `main` (§3 Git contract),
7. returns a JSON manifest of ADRs and tasks, plus the run branch name and the
   PR URL. (The run worktree is the session's own Claude Code worktree, so the
   orchestrator does not need a path echoed in the manifest.)

The orchestrator verifies every file in the manifest exists before proceeding.
If `spec-agent` reports `PHASE-FAILURE` (e.g. the prompt contradicts accepted
ADRs and the contradiction is not resolvable from the prompt), the run halts:
failure protocol, then ask the human.

**Phases 2+3 — IMPLEMENT + VALIDATE, per task.** Tasks execute sequentially in
manifest order (no parallel implementation — agents share the run's one
worktree). The whole run executes inside the Claude Code worktree the
orchestrator entered at run start, so every phase operates in the run worktree,
never in the primary working tree. For each task:

1. Spawn `implement-agent` with the task ID, the Rule Pack, and — on retries —
   the previous validation report verbatim. It implements the task **and its
   unit tests** (unit tests are the only test tier), then sets the task to
   `validating`. Along the way it keeps traceability true (§3): new files get
   their `ADR:` comment, `governs:` lists are trued up, and an ADR whose last
   governed code was just removed is marked `deleted`.
2. Spawn `validate-agent` with the task ID. It reads the canonical command
   from `docs/specs/project.md` and executes the **full** unit suite (full, not
   task-scoped — this is the regression gate). It returns PASS or FAIL with the
   failing tests and a suspected cause. On PASS it also makes the task's commit,
   pushes the run branch, updates the PR description, and writes the task's
   collapsible Test Results block into the PR (§3 Git contract, Test Results);
   on FAIL nothing is
   committed and no Test Results block is written — the retry reworks the tree
   in place, and the block is written only at the task's terminal state.
3. On FAIL: increment `attempts`. If `attempts < 4`, loop to step 1. After the
   3rd failed retry (`attempts = 4`), run the failure protocol (§5, including
   the failure commit and the failed task's Test Results block — that is the
   terminal FAIL state, so its evidence goes into the PR), mark the task
   `failed`, mark tasks that depend on it `blocked`, and continue with the
   remaining independent tasks.

**Phase 4 — REVIEW + RESEARCH (concurrent siblings).** Once VALIDATE has
concluded for **all** tasks, the orchestrator runs the saved review+research
workflow (§4.6, in `.claude/workflows/`): it spawns `review-agent` (blocking —
it finalizes the run PR) and `research-agent` (non-blocking — it runs in
parallel/background and may finish after the Run Report) at the same level,
injecting the Rule Pack into both prompts. RESEARCH never gates REVIEW, PR
finalization, or the Run Report; a research failure is recorded for visibility
only and the run still completes green (§5, §4.6).

**Phase 4 REVIEW.** Always runs, even if some tasks failed. `review-agent`
receives `E`, the manifest, per-task outcomes, and the Rule Pack.
It verifies the run is coherent — specs match ADRs, ADRs match tasks, done
tasks have real code and real passing tests, ADR ↔ code traceability holds
(§3), nothing in the manifest was silently skipped — then:
1. appends Evolution entry `#E` to `CHANGELOG.md` (prompt condensed, outcome,
   artifacts, failures if any),
2. updates `README.md` if the product's identity, setup, or commands changed,
3. commits its updates as the run's final commit, pushes the run branch, and
   finalizes the PR description — final task statuses, outcome, rules earned,
   CHANGELOG reference (§3 Git contract), confirming every concluded task has
   its Test Results block (it audits, never regenerates — the terminal actor
   wrote each block).

If review finds discrepancies that require code changes, the orchestrator
dispatches **one remediation round** through the standard implement→validate
loop (fresh budget of 1 initial + 1 retry), then review re-checks once. Still
discrepant → failure protocol; the discrepancy is recorded, not hidden.

**Phase 4 RESEARCH.** Runs alongside REVIEW and is fully non-blocking (§4.6):
it must never gate REVIEW, the run PR, or the Run Report, and it never touches
the run's `ai/` branch. `research-agent` (model: opus, for maximum coverage)
receives `E`, the run prompt, the product context paths, and the Rule Pack, and
acts as a product researcher: it surveys this product's domain — competitor
products and user-demand signals (app-store reviews, forums, feature-request
threads) for in-demand features — cross-references this product's own specs and
`README.md`, excludes anything already parked in `BACKLOG.md` or already shipped
per `CHANGELOG.md`, proposes exactly **3** candidate **product**
features (never harness features) to build next, scores each on the documented
scale (§4.6), picks the highest-scoring winner, and returns the full report
content plus the structured winner to the orchestrator. The orchestrator then
hands the verbatim winning feature **and** the report content to `backlog-agent`
(§4.5) — research-agent never spawns it — which commits the report at
`docs/research/E<N>-<slug>.md` alongside its `BACKLOG.md` entry on a
`backlog/<slug>` PR. If research-agent fails (e.g. web access unavailable), the
orchestrator records the miss for visibility only (§5) and the run still
completes green — no winner, no backlog handoff, no rule.

### 4.3 Retry budget summary

| Loop | Budget |
|---|---|
| implement ↔ validate, per task | 1 initial attempt + 3 retries |
| review remediation, per run | 1 round (1 attempt + 1 retry), then record failure |
| spec, review themselves | no retries — a phase that cannot complete is a terminal failure |
| `research-agent` (Phase 4 RESEARCH) | no retries — non-blocking; a failed research pass is recorded for visibility only (§5, §4.6) and never blocks the run, REVIEW, or the Run Report |
| `coreflow-agent` (harness path) | no retries — a coherent change self-publishes on a `harness/<slug>` branch (§4.4); a failed harness change is reported, recorded, and left to the human |
| `backlog-agent` (backlog path) | no retries — a failed capture is reported and left to the human |

### 4.4 The harness path (coreflow-agent, no pipeline)

Harness prompts bypass the pipeline entirely: the orchestrator spawns
`coreflow-agent` with the human instruction verbatim plus the Rule Pack, and
relays its report. The agent owns the whole harness surface — `CORE_FLOW.md`
(canonical), `CLAUDE.md`, `.claude/agents/*.md`, `.claude/skills/**`,
`.claude/workflows/**` (saved Claude Code workflows — e.g. the post-VALIDATE
review+research fan-out, §4.6), the three templates, `.claude/settings.json`,
`.claude/hooks/**`, `.github/workflows/validate-ai-instructions.yml` — and
nothing else: it never touches product artifacts and never runs pipeline
phases.

Its core obligation is **consistency**: a harness change must land on every
affected layer in one pass (canonical definition → operating summary → agent
definitions → skills → templates), because drift between layers is how a
harness rots. Changes to agent definitions, skill frontmatter, or settings
take effect at the next session start; the agent's report says so whenever
that applies. Additionally, before completing any run that touches
instruction artifacts (`CORE_FLOW.md`, `CLAUDE.md`, `.claude/agents/*.md`,
`.claude/skills/**`), coreflow-agent reads
`.claude/skills/validate-ai-instructions/SKILL.md` and applies its 15-point
checklist to every changed artifact, including the full scored report with
`VERDICT:` line in its return.

The harness path **always** self-publishes — it consumes no evolution number
but, like the backlog path (§4.5), never leaves its work in the working tree
for the human to commit. On every spawn that produces a coherent change,
`coreflow-agent`:

1. fetches `origin/main` and creates or uses a dedicated branch
   `harness/<slug>` (2–5 kebab-case words condensing the instruction),
2. commits its harness changes there (`harness: <slug>`),
3. pushes the branch (`git push -u origin harness/<slug>`),
4. opens a PR against `main` (`gh pr create`) describing the change.

It commits and pushes to its own `harness/<slug>` branch only; it never
commits, pushes, or merges to `main`, and never force-pushes. Merging the
harness PR is the human's decision. If the change cannot be executed
coherently, `coreflow-agent` returns `PHASE-FAILURE` and self-publishes
nothing; if `git` or an authenticated `gh` CLI is unavailable, that too is a
`PHASE-FAILURE` — the harness path does not fall back to an uncommitted write.

### 4.5 The backlog path (backlog-agent, no pipeline)

Backlog prompts bypass the pipeline entirely: the orchestrator spawns
`backlog-agent` with the human's idea verbatim plus the Rule Pack, and relays
its report. The agent owns `BACKLOG.md` at the repository root — and, only when
the orchestrator hands it a Phase 4 RESEARCH winner (§4.6), also the run's
research report file `docs/research/E<N>-<slug>.md` it commits alongside that
entry — and nothing else: it never touches product or other harness artifacts
and never runs pipeline phases. It is **non-blocking**: it may run in the
background and in parallel with the pipeline or another agent, never waits on
anything, and nothing waits on it.

Its job is to capture intent for later, not to build it. Before appending, it
interrogates the idea for ambiguity — listing the load-bearing terms and what
each could mean — then resolves each into an assumption it writes down rather
than asking the human; it never blocks on a question. For a term whose answer
would change the problem or the solution it states the assumption plainly
instead of inventing a definitive answer. It appends exactly one entry per
spawn, with two fields — `user input:` (the idea verbatim) and `assumptions:`
(one bullet per resolved term) — and never edits or removes prior entries
(`BACKLOG.md` is append-only).

The backlog path **always** self-publishes — it consumes no evolution number
but, unlike every other path, never leaves its work in the working tree for the
human to commit. On every spawn `backlog-agent`:

1. fetches `origin/main` and creates a **new git worktree** off fresh
   `origin/main` (never off the current working-tree HEAD) on a dedicated
   branch `backlog/<slug>` (2–5 kebab-case words condensing the idea), so the
   capture is isolated from any in-flight run sharing the main working tree and
   the PR diff is exactly the one appended entry,
2. appends its single entry to `BACKLOG.md` in that worktree,
3. commits it (`backlog: <slug>`),
4. pushes the branch (`git push -u origin backlog/<slug>`),
5. opens a PR against `main` (`gh pr create`) whose description contains
   **only** the exact verbatim user input and the resolved assumptions — no
   other sections.

**Research-handoff variant (from Phase 4 RESEARCH, §4.6).** When the
orchestrator spawns `backlog-agent` with a research winner instead of a raw
human idea, it passes the verbatim winning feature **and** the research report
content. backlog-agent then, in the same `backlog/<slug>` worktree, also writes
the report to `docs/research/E<N>-<slug>.md`, `git add`s it together with
`BACKLOG.md`, commits both in the one `backlog: <slug>` commit, and its PR
description carries the winning feature, its scores, and a pointer to the
committed report (still no harness or product code). Everything else about the
backlog path is unchanged. This keeps the run's `ai/` branch fully independent
of research.

In both variants it commits and pushes to its own `backlog/<slug>` branch only
and opens the PR; it never commits, pushes, or merges to `main`, and never
force-pushes. Merging the backlog PR is the human's decision. If `git` or an
authenticated `gh` CLI is unavailable, or `git fetch origin main` fails, that is
a `PHASE-FAILURE` — the backlog path does not fall back to an uncommitted write.

### 4.6 The research path (research-agent, Phase 4, non-blocking)

RESEARCH is a Phase 4 sibling of REVIEW, not a separate route: it runs on every
build run, automatically, alongside REVIEW once VALIDATE has concluded for all
tasks. It exists to keep a scored next-feature proposal flowing into the backlog
without a human prompt. The orchestrator **owns research end-to-end** — once
this path exists it auto-runs it every build run and never asks the human to
confirm or to choose; the only human decision is whether to merge the resulting
backlog PR.

**Orchestration — the saved workflow.** The fan-out is a **saved Claude Code
workflow** ([docs](https://code.claude.com/docs/en/workflows)) stored at
`.claude/workflows/review-research.md` (a harness-owned artifact type, §4.4).
After VALIDATE concludes, the orchestrator invokes that workflow; it spawns
`review-agent`
(blocking) and `research-agent` (non-blocking) at the same level and **injects
the Rule Pack into both prompts** — no agent runs without it. REVIEW finalizes
the run PR; RESEARCH runs in parallel/background and may finish after REVIEW or
after the Run Report. RESEARCH never gates REVIEW, PR finalization, or the Run
Report.

**research-agent (model: opus).** It uses the opus model for maximum coverage.
Spawned with `E`, the run prompt, the product context paths, and the Rule Pack,
it acts as a product researcher and:

1. reads this product's `docs/specs/` and `README.md` to ground itself in what
   the product is, plus `BACKLOG.md` and `CHANGELOG.md` to know what is already
   parked or already shipped;
2. researches the web (`WebSearch` + `WebFetch`) — competitor products in this
   product's domain and user-demand signals (app-store reviews, forums,
   feature-request threads) — for in-demand features;
3. proposes exactly **3** candidate **product** features to build next (never
   harness features), each excluded if already parked in `BACKLOG.md` or already
   shipped per `CHANGELOG.md`;
4. scores each candidate on three equally weighted dimensions — **user demand /
   frequency**, **product-fit / alignment**, and **competitive
   differentiation** — on a documented **1–5** scale per dimension (15 max);
   highest total wins, and ties break toward the higher product-fit score;
5. produces the full report content — all 3 candidates, their per-dimension
   scores and totals, the winner, and sources / citations — and returns it plus
   the structured winner to the orchestrator. It commits nothing and spawns no
   agent.

**Backlog handoff (orchestrator-owned).** research-agent does **not** spawn
`backlog-agent`. The orchestrator takes research-agent's returned winner and
report content and spawns `backlog-agent` (§4.5 research-handoff variant) with
the verbatim winning feature and the report; backlog-agent commits the report at
`docs/research/E<N>-<slug>.md` alongside its `BACKLOG.md` entry on a
`backlog/<slug>` PR. This preserves "the orchestrator owns control flow" (§1)
and backlog-agent's self-publishing.

**Failure is non-blocking and does not pollute rule promotion.** If
research-agent reports `PHASE-FAILURE` (e.g. web access unavailable, no
candidate survives dedup), the orchestrator records the miss for visibility only
— a one-line note in the Run Report (§6) and, when the failure is a genuine
external/process failure worth keeping, a `research-miss` line appended to a
dedicated **Research misses** section of `failures/NEAR-MISSES.md` that is
**explicitly excluded from the §5 recurrence count** (it carries no
`root-cause-tag` and never feeds the ≥ 2 rule-promotion threshold). A research
failure earns no rule and never blocks the run: REVIEW still finalizes the PR
and the run completes green. The harness deliberately keeps transient external
research failures out of the learning machinery (§5).

### 4.7 The autonomous build loop (orchestrator runbook, no new route)

The autonomous build loop lets the human ask the orchestrator to keep shipping
features without a prompt between Evolutions — e.g. "keep building features
forever until I stop you" or "ship the next feature until you finish e23". It is
**orchestrator control flow, not a new route and not a new agent**: each
iteration is one ordinary build run (§4.2), and §1's separation of powers still
holds — the orchestrator (the main session) runs the loop and spawns the
pipeline agents; no agent runs the loop or spawns agents (§2). The loop's
step-by-step runbook lives at `.claude/agents/autonomous-loop.md` with a
caller-facing skill at `.claude/skills/autonomous-loop/SKILL.md`; that runbook is
a **non-spawnable procedure document**, not a `subagent_type`, so the
eight-actor count in §2 is unchanged.

**One iteration = one full build run = one Evolution = one PR** (§4.2): SPEC →
IMPLEMENT+VALIDATE per task → REVIEW + RESEARCH via the saved workflow (§4.6),
Rule Pack injected into every spawned agent (§4.2). The loop adds two
loop-specific mechanics on top of an unchanged §4.2:

1. **Next-feature selection.** Each iteration's build prompt is the top unbuilt
   item of `BACKLOG.md` if present, otherwise the **carried-forward winner** of
   the prior iteration's Phase 4 RESEARCH (§4.6). Within one session, build and
   backlog PRs are human-merge-gated, so `main`'s `BACKLOG.md` does not grow
   between iterations — the carry-forward winner is the source when the backlog
   is empty.
2. **Run-branch stacking.** Because build PRs and backlog PRs are not
   auto-merged, `main` does not advance during the loop. So iteration N (N≥2)
   creates `ai/e<E>-<slug>` from the **prior run-branch HEAD**
   (`ai/e<E-1>-<slug>`), not fresh from `main`, so consumed-backlog state, prior
   features, and contiguous Evolution/ADR/TASK numbering carry forward. This is
   the documented "draining several unmerged evolutions in one session" override
   of the default fresh-from-`main` posture; iteration 1 still branches fresh
   from `main` and `.claude/settings.json` still pins `worktree.baseRef:
   "fresh"` (§3) — the default single-run posture is unchanged. Each run's PR
   notes its stacking lineage and its merge-together dependency on the prior PR.

After each iteration's backlog handoff (§4.6) the orchestrator emits that
iteration's Run Report (§6) and immediately begins the next iteration, repeating
until the human interrupts or a stated stop condition is met (a named evolution
shipped, a count reached, or the backlog drained with no carried winner). All
loop non-negotiables are §4.2's: the orchestrator writes no product artifact, no
actor touches `main` or force-pushes (§3), and a prompt that mixes routes is
split per §4.1. RESEARCH stays non-blocking (§4.6) — it never delays the next
iteration or any iteration's Run Report.

## 5. Failure → Rule protocol

A **terminal failure** is any phase ending beyond its retry budget, or any
phase reporting `PHASE-FAILURE`. The harness path counts too: a
`coreflow-agent` `PHASE-FAILURE` is recorded with `phase: harness`. **One
exception: Phase 4 RESEARCH (§4.6) is non-blocking** — a `research-agent`
`PHASE-FAILURE` is *not* a terminal failure in this sense: it earns no
`FAIL-NNNN` record, no rule, and does not block the run; it is recorded for
visibility only (Run Report line, optional `research-miss` line in the Research
misses section of `failures/NEAR-MISSES.md`) as defined in §4.6 and below. The
failure record and rule append are written inside the run worktree (where the
build changes live and the run branch is checked out), so they commit together
with the working state on that branch. The orchestrator (never the agents)
then:

1. Creates `failures/FAIL-NNNN-<slug>.md` from `failures/TEMPLATE.md`:
   evolution, phase, related ADR/task IDs, a single `root-cause-tag` (the
   short kebab-case slug defined below), symptom, root cause, what each
   attempt tried, and the **rule earned** — one imperative, generalized
   sentence ("Always…", "Never… when…") that would have prevented the failure.
2. Appends the rule to the Learned Rules section of `CLAUDE.md`, between the
   `LEARNED-RULES` markers, as:
   `- **R-NNNN** (FAIL-NNNN, E<N>): <rule text>`
3. Commits the run worktree's state together with the failure record and the
   rule append to the run branch and pushes (from inside the run worktree)
   (`FAIL-NNNN: TASK-NNNN failed terminally`, §3 Git contract), and — when the
   terminal failure is an exhausted task (not a Phase 1 / harness-path
   failure) — writes the failed task's Test Results block into the PR from the
   last validation report (§3 Test Results), so the failing evidence is
   visible in the PR, never hidden. If no run branch exists yet (Phase 1
   failed before branching, or the failure is on the harness path), the
   record stays uncommitted, no PR block is written, and the Run Report says
   so. Never commit to `main`.
4. Reports the new rule in the Run Report.

Because the Rule Pack is injected into every agent prompt of every future run,
an earned rule is a permanent behavior change — the harness must never make
the same mistake twice. Rules are append-only; a rule may only be edited or
retired by explicit human instruction.

### Recovered failures, near-misses, and recurrence

A failure that was **recovered** within the retry budget is classified by the
orchestrator (from `review-agent`'s surfaced per-task outcomes) as one of:

- **transient** — a flaky cause that retry alone is the correct and complete
  response to: a network blip, a timeout, or live-network integration sampling
  inside the tolerances already documented in the harness. A transient
  recovered failure is **not recorded** — no entry, no rule.
- **persistent** — a real defect the run had to fix: a wrong test assertion,
  scope-sequencing / half-migrated runtime, a shared-scope collision, a
  traceability gap, a verification miss, and the like. Every persistent
  recovered failure gets a **lightweight near-miss entry** (below) — never the
  full terminal dossier.

**Near-miss entries.** The orchestrator (never the agents) appends one row per
persistent recovered failure to the append-only ledger `failures/NEAR-MISSES.md`
(created from its header on first use). Each row carries, at minimum: evolution,
phase, related task/ADR IDs, a one-line symptom, a single **root-cause tag** (a
short kebab-case slug — e.g. `shared-scope-collision`, `wrong-test-assertion`,
`scope-sequencing`, `traceability-gap`, `verification-miss`), and the one-line
fix. The root-cause tag is **required** on every entry — it is the token the
recurrence count below is computed from. `review-agent` surfaces the run's
persistent recovered near-misses in its report (it already sees per-task
outcomes); the orchestrator writes the rows and commits them with the run's
working state on the run branch (§3 Git contract), never to `main`.

**Recurrence ⇒ mandatory rule (threshold = 2).** Count the occurrences of each
root-cause tag across **all recorded entries** — every `root-cause-tag` row in
`failures/NEAR-MISSES.md` plus every `root-cause-tag` front-matter value on a
`failures/FAIL-NNNN-*.md` terminal record. When the same root-cause tag has
appeared **2 or more times** across those recorded entries, it **automatically**
earns a Learned Rule — no judgment call. The orchestrator MUST then write a
`failures/FAIL-NNNN-<slug>.md` record (carrying that root-cause tag and
referencing the recurring entries) and append the `R-NNNN` rule between the
`LEARNED-RULES` markers in `CLAUDE.md`, exactly as the terminal path (steps
1–4 above) does — same append-only format, same commit-on-run-branch rule.

**Research misses are excluded from this machinery (§4.6).** A Phase 4 RESEARCH
failure is recorded for visibility only and never feeds rule promotion. Any
`research-miss` line the orchestrator appends lives in a dedicated **Research
misses** section of `failures/NEAR-MISSES.md`, kept separate from the
persistent-near-miss table; it carries **no** `root-cause-tag`, so it is never
counted in the recurrence total above and can never auto-earn a rule. This keeps
transient external research failures (web outage, timeout, dedup leaving no
candidate) out of the learning machinery by design.

**First-occurrence discretionary path (unchanged).** A first-occurrence
recovered failure whose root cause obviously generalizes (e.g. a toolchain
quirk, not a one-off typo) may still earn a rule by judgment: `review-agent`
proposes it in its report and the orchestrator decides. This discretionary path
is additive — it does not replace the mechanical recurrence ≥ 2 trigger above,
which is mandatory regardless of judgment.

Rules earned by either path follow the append-only constraint: a rule may only
be edited or retired by explicit human instruction.

## 6. Run Report

After Phase 4 the orchestrator reports to the human, in this order: evolution
number and one-line outcome; the run branch and PR URL; ADRs created; tasks
done / failed / blocked; rules earned (verbatim); CHANGELOG/README updates; the
**research outcome** (§4.6) — the winning next-feature with its score and the
`backlog/<slug>` PR URL, or a one-line recorded research miss if RESEARCH did
not produce a winner; anything requiring a human decision — merging the run PR
and the backlog PR always are. Because RESEARCH is non-blocking, the Run Report
is not delayed for it: if research-agent has not yet returned, report the run
outcome and note the research outcome will follow. The report is conversation
output, not a file — the files already hold the durable record.

## 7. Invariants

Checked by the orchestrator at the start of every run; any violation is fixed
first (folders/templates recreated, statuses corrected) and noted in the Run
Report:

1. All folders and required files in §3 exist.
2. `CORE_FLOW.md` contains no product specifics.
3. Every rule in `CLAUDE.md` references an existing `failures/` record, and
   every terminal failure record has a rule.
4. No task is `in-progress`/`validating` at rest (a previous run died mid-way
   → investigate, correct status, mention in report).
5. Evolution numbers in `CHANGELOG.md` are contiguous.
6. The orchestrator wrote no product artifact itself.
7. ADR ↔ code traceability holds (§3): every non-deleted ADR's governed paths
   exist and reference it, and no ADR whose governed code is gone is still
   marked `accepted`.
8. The harness wrote nothing to `main` (§3 Git contract): every build-run
   commit sits on its `ai/e<E>-<slug>` branch, no actor force-pushed or
   merged a PR, and `main` has advanced only through human-merged PRs.
