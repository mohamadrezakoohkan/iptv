# CORE_FLOW — Orchestration Harness

This document is the standalone, canonical definition of the orchestration
harness that drives this repository. It defines **how work happens**, never
**what is being built**. If you copied this file — together with `CLAUDE.md`,
`.claude/agents/`, and the folder templates — into an empty directory, the
harness would work unchanged for any product.

**Hard rule: no product specifics in this file.** Product knowledge lives in
`specs/`, `adrs/`, `README.md`, and the source tree. This file changes only
when the harness itself changes, and only on an explicit human instruction
executed by `coreflow-agent` (§4.4) — never as a side effect of a build run.

---

## 1. Philosophy

The project evolves exclusively through numbered prompts. A human writes a
prompt; the harness turns it into specifications, decisions, tasks, code,
tests, and documentation — and converts every terminal failure into a
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

Six actors: **one orchestrator + five subagents** — four pipeline phase
agents, plus one harness maintainer that runs outside the pipeline.

| Actor | Phase | May write | Must never |
|---|---|---|---|
| **Orchestrator** (main session) | all | `failures/`, Learned Rules in `CLAUDE.md`, task-status corrections, terminal-failure commits on the run branch (§5) | write specs, ADRs, code, tests, or product docs itself |
| **spec-agent** | 1 — SPEC | `specs/`, `adrs/`, `tasks/`; creates the run branch, makes the run's first commit, opens the run PR (§3) | write source code or tests |
| **implement-agent** | 2 — IMPLEMENT | source code, unit tests, UI tests, task status, ADR traceability fields (`governs:`, `status: deleted`) | edit specs or ADR decision content, mark its own work `done`, run `git commit` / `git push` / `gh` |
| **validate-agent** | 3 — VALIDATE | task status + attempt count; on PASS the per-task commit, push, and PR description update (§3) | fix code or tests (it reports, never repairs) |
| **review-agent** | 4 — REVIEW | `CHANGELOG.md`, `README.md`; the run's final commit, push, and PR description finalization (§3) | change product code, tests, specs, or ADRs |
| **coreflow-agent** | harness (outside the pipeline) | `CORE_FLOW.md`, `CLAUDE.md`, `.claude/agents/*.md`, the three templates, `.claude/settings.json` | touch any product artifact (source, `specs/`, `adrs/` records, `tasks/`, `failures/` records, `README.md`, `CHANGELOG.md`), run pipeline phases, or git-commit/push anything (harness changes await the human) |

Git is part of the contract: **no actor — orchestrator included — ever commits
to `main`, pushes to `main`, force-pushes, or merges a pull request.** All run
work lands on the run's `ai/` branch and reaches `main` only through a PR
merged by the human (§3, Git & pull-request contract).

The subagents are defined in `.claude/agents/<name>.md` and are spawned by the
orchestrator via the Agent tool with `subagent_type` set to the agent name.
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
├── specs/               Living specifications (spec-agent maintains)
│   └── project.md       REQUIRED: product overview, stack, canonical build/test commands
├── adrs/                Architecture Decision Records (spec-agent creates)
│   └── TEMPLATE.md
├── tasks/               Work units derived from ADRs (spec-agent creates; later phases update status)
│   └── TEMPLATE.md
├── failures/            Terminal-failure records that earn rules (orchestrator writes)
│   └── TEMPLATE.md
└── .claude/agents/      The five subagent definitions
```

### Identifiers

| Artifact | Format | Sequence |
|---|---|---|
| Evolution (CHANGELOG entry) | `#N` | last entry in `CHANGELOG.md` + 1 (`#0` = bootstrap) |
| ADR | `ADR-NNNN` | global, max existing in `adrs/` + 1 |
| Task | `TASK-NNNN` | global, max existing in `tasks/` + 1 (linked to its ADR via front-matter) |
| Failure | `FAIL-NNNN` | global, max existing in `failures/` + 1 |
| Rule | `R-NNNN` | mirrors the `FAIL-NNNN` that earned it |

File names embed the ID: `adrs/ADR-0001-<slug>.md`, `tasks/TASK-0001-<slug>.md`,
`failures/FAIL-0001-<slug>.md`. Specs are not numbered: `specs/project.md` plus
one `specs/<feature-slug>.md` per feature area, each with front-matter
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

`specs/project.md` is the single source of truth for how to build the product
and how to run the **unit test suite** and the **UI test suite**. The first
evolution must establish them (via an ADR choosing the stack). `validate-agent`
refuses to validate if these commands are missing — that is a phase failure,
not an excuse to guess.

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
the single exception to "implement-agent never edits `adrs/`": it may update
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

1. **Branch.** At the start of Phase 1, `spec-agent` creates the run branch
   from the current HEAD: `ai/e<E>-<slug>` (the evolution number plus 2–5
   kebab-case words condensing the prompt). No build work ever happens on
   `main`. If `git` or an authenticated `gh` CLI is unavailable, that is a
   `PHASE-FAILURE` — the harness does not build outside a run branch.
2. **First commit, then PR.** `spec-agent` commits the Phase 1 artifacts as
   the run's first commit (`E<N> spec: <prompt, condensed>`), pushes the
   branch (`git push -u origin <run-branch>`), and immediately opens the run
   PR against `main` (`gh pr create`) with the description structure below.
3. **One commit per concluded task.** On PASS, `validate-agent` commits all
   working-tree changes of the task (`TASK-NNNN: <title>`), pushes, and
   updates the PR description. On terminal failure, the **orchestrator**
   commits the working-tree state together with the failure record
   (`FAIL-NNNN: TASK-NNNN failed terminally`) and pushes — failures are
   visible in the PR, never hidden. `implement-agent` never commits; review
   remediation rounds follow the same per-task mechanics.
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

### Outcome
_Run in progress._
```

A task's line becomes `- [x] … — done` when validated, or `- [ ] … — failed
(FAIL-NNNN)` / `- [ ] … — blocked` at finalization. The final Outcome states
shipped / partial / failed, the rules earned, and `Recorded as CHANGELOG #E`.

The harness path (§4.4) makes no commits at all: `coreflow-agent` leaves its
changes in the working tree, and the human decides when harness changes land.
(Rule-ledger appends during a build run are different: the orchestrator's
terminal-failure commit carries them, as part of the run's record.)

## 4. The pipeline

### 4.1 Routing

Every human prompt takes exactly one of three routes:

- **Build prompt** — adds, changes, or removes product behavior or structure
  → the full pipeline below: one run, one Evolution entry.
- **Harness prompt** — an explicit request to change the harness itself
  (`CORE_FLOW.md`, `CLAUDE.md`, agent definitions, templates, the rule
  ledger, harness settings) → `coreflow-agent` (§4.4). No pipeline, no
  evolution number. This is how humans contribute to the harness instead of
  the product.
- **Question / status request** → the orchestrator answers directly from the
  files. Nothing is spawned, nothing is written.

When a prompt mixes routes, split it and say so in the Run Report; when the
intent is ambiguous, ask the human rather than guess.

### 4.2 Run sequence

```
        ┌──────────────────────────── run start ────────────────────────────┐
        │ E = next evolution number;  Rule Pack = Learned Rules from CLAUDE.md │
        └────────────────────────────────────────────────────────────────────┘
                                        │
Phase 1  SPEC        spec-agent: ai/e<E>-<slug> branch → specs + ADRs + tasks
                                  → first commit + push → open PR (manifest)
                                        │
Phase 2+3 per task   ┌─► implement-agent (task, rule pack, last failure report)
(in manifest order)  │            │
                     │   validate-agent: run FULL unit + UI suites
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
Phase 4  REVIEW      review-agent: coherence check → CHANGELOG #E → README sync
                                   → final commit + push → PR finalized
                                        │
                     Run Report to the human (§6)
```

**Run start (orchestrator).** Read this file in full. Compute `E`. Extract the
Learned Rules section of `CLAUDE.md` verbatim — this is the **Rule Pack**, and
it MUST be included in the prompt of every agent spawned during the run.

**Phase 1 — SPEC.** Spawn `spec-agent` with: the user prompt verbatim, `E`, and
the Rule Pack. The agent reads `CORE_FLOW.md`, everything in `specs/`, and
everything in `adrs/` to understand the project, then:
1. creates the run branch `ai/e<E>-<slug>` from the current HEAD and checks
   it out (§3 Git contract) — build work never happens on `main`,
2. aligns the prompt with the existing project (or defines the project, on the
   first run),
3. creates or updates spec files in `specs/`,
4. writes one ADR per significant decision the prompt forces, seeding its
   `governs:` list with the code paths its tasks will create or shape,
5. derives an ordered set of tasks for each ADR — each task small enough to
   implement and validate in one agent run, with acceptance criteria and
   explicit test requirements (unit; UI where user-facing),
6. commits the Phase 1 artifacts as the run's first commit, pushes the
   branch, and opens the run PR against `main` (§3 Git contract),
7. returns a JSON manifest of ADRs and tasks, plus the run branch name and
   the PR URL.

The orchestrator verifies every file in the manifest exists before proceeding.
If `spec-agent` reports `PHASE-FAILURE` (e.g. the prompt contradicts accepted
ADRs and the contradiction is not resolvable from the prompt), the run halts:
failure protocol, then ask the human.

**Phases 2+3 — IMPLEMENT + VALIDATE, per task.** Tasks execute sequentially in
manifest order (no parallel implementation — agents share one working tree).
For each task:

1. Spawn `implement-agent` with the task ID, the Rule Pack, and — on retries —
   the previous validation report verbatim. It implements the task **and its
   tests** (unit always; UI tests whenever the task touches user-facing
   behavior), then sets the task to `validating`. Along the way it keeps
   traceability true (§3): new files get their `ADR:` comment, `governs:`
   lists are trued up, and an ADR whose last governed code was just removed
   is marked `deleted`.
2. Spawn `validate-agent` with the task ID. It reads the canonical commands
   from `specs/project.md` and executes the **full** unit suite and the
   **full** UI suite (full, not task-scoped — this is the regression gate).
   It returns PASS or FAIL with the failing tests and a suspected cause. On
   PASS it also makes the task's commit, pushes the run branch, and updates
   the PR description (§3 Git contract); on FAIL nothing is committed — the
   retry reworks the tree in place.
3. On FAIL: increment `attempts`. If `attempts < 4`, loop to step 1. After the
   3rd failed retry (`attempts = 4`), run the failure protocol (§5, including
   the failure commit), mark the task `failed`, mark tasks that depend on it
   `blocked`, and continue with the remaining independent tasks.

**Phase 4 — REVIEW.** Always runs, even if some tasks failed. Spawn
`review-agent` with `E`, the manifest, per-task outcomes, and the Rule Pack.
It verifies the run is coherent — specs match ADRs, ADRs match tasks, done
tasks have real code and real passing tests, ADR ↔ code traceability holds
(§3), nothing in the manifest was silently skipped — then:
1. appends Evolution entry `#E` to `CHANGELOG.md` (prompt condensed, outcome,
   artifacts, failures if any),
2. updates `README.md` if the product's identity, setup, or commands changed,
3. commits its updates as the run's final commit, pushes the run branch, and
   finalizes the PR description — final task statuses, outcome, rules earned,
   CHANGELOG reference (§3 Git contract).

If review finds discrepancies that require code changes, the orchestrator
dispatches **one remediation round** through the standard implement→validate
loop (fresh budget of 1 initial + 1 retry), then review re-checks once. Still
discrepant → failure protocol; the discrepancy is recorded, not hidden.

### 4.3 Retry budget summary

| Loop | Budget |
|---|---|
| implement ↔ validate, per task | 1 initial attempt + 3 retries |
| review remediation, per run | 1 round (1 attempt + 1 retry), then record failure |
| spec, review themselves | no retries — a phase that cannot complete is a terminal failure |
| `coreflow-agent` (harness path) | no retries — a failed harness change is reported, recorded, and left to the human |

### 4.4 The harness path (coreflow-agent, no pipeline)

Harness prompts bypass the pipeline entirely: the orchestrator spawns
`coreflow-agent` with the human instruction verbatim plus the Rule Pack, and
relays its report. The agent owns the whole harness surface — `CORE_FLOW.md`
(canonical), `CLAUDE.md`, `.claude/agents/*.md`, the three templates,
`.claude/settings.json` — and nothing else: it never touches product
artifacts and never runs pipeline phases.

Its core obligation is **consistency**: a harness change must land on every
affected layer in one pass (canonical definition → operating summary → agent
definitions → templates), because drift between layers is how a harness rots.
Changes to agent definitions or settings take effect at the next session
start; the agent's report says so whenever that applies.

The harness path never touches git history: `coreflow-agent` commits nothing
and pushes nothing. Its changes stay in the working tree until the human
commits them — committing harness changes is always the human's decision.

## 5. Failure → Rule protocol

A **terminal failure** is any phase ending beyond its retry budget, or any
phase reporting `PHASE-FAILURE`. The harness path counts too: a
`coreflow-agent` `PHASE-FAILURE` is recorded with `phase: harness`. The
orchestrator (never the agents) then:

1. Creates `failures/FAIL-NNNN-<slug>.md` from `failures/TEMPLATE.md`:
   evolution, phase, related ADR/task IDs, symptom, root cause, what each
   attempt tried, and the **rule earned** — one imperative, generalized
   sentence ("Always…", "Never… when…") that would have prevented the failure.
2. Appends the rule to the Learned Rules section of `CLAUDE.md`, between the
   `LEARNED-RULES` markers, as:
   `- **R-NNNN** (FAIL-NNNN, E<N>): <rule text>`
3. Commits the working-tree state together with the failure record and the
   rule append to the run branch and pushes
   (`FAIL-NNNN: TASK-NNNN failed terminally`, §3 Git contract) — the failure
   is visible in the PR, never hidden. If no run branch exists yet (Phase 1
   failed before branching, or the failure is on the harness path), the
   record stays uncommitted and the Run Report says so. Never commit to
   `main`.
4. Reports the new rule in the Run Report.

Because the Rule Pack is injected into every agent prompt of every future run,
an earned rule is a permanent behavior change — the harness must never make
the same mistake twice. Rules are append-only; a rule may only be edited or
retired by explicit human instruction.

A failure that was **recovered** within the retry budget earns a rule only if
the root cause generalizes (e.g. a toolchain quirk, not a one-off typo);
`review-agent` proposes such rules in its report and the orchestrator decides.

## 6. Run Report

After Phase 4 the orchestrator reports to the human, in this order: evolution
number and one-line outcome; the run branch and PR URL; ADRs created; tasks
done / failed / blocked; rules earned (verbatim); CHANGELOG/README updates;
anything requiring a human decision — merging the PR always is. The report is
conversation output, not a file — the files already hold the durable record.

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
