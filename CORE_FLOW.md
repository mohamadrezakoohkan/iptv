# CORE_FLOW — Orchestration Harness

This document is the standalone, canonical definition of the orchestration
harness that drives this repository. It defines **how work happens**, never
**what is being built**. If you copied this file — together with `CLAUDE.md`,
`.claude/agents/`, `.claude/skills/`, and the folder templates — into an empty
directory, the harness would work unchanged for any product.

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

Seven actors: **one orchestrator + six subagents** — four pipeline phase
agents, plus one harness maintainer and one backlog capturer that both run
outside the pipeline.

| Actor | Phase | May write | Must never |
|---|---|---|---|
| **Orchestrator** (main session) | all | `failures/`, Learned Rules in `CLAUDE.md`, task-status corrections, terminal-failure commits on the run branch (§5), the failed task's PR Test Results block (§3); puts the run inside a Claude Code worktree at run start (§3, §4.2) | write specs, ADRs, code, tests, or product docs itself |
| **spec-agent** | 1 — SPEC | `specs/`, `adrs/`, `tasks/`; creates the run branch, makes the run's first commit, opens the run PR (§3) | write source code or tests |
| **implement-agent** | 2 — IMPLEMENT | source code, unit tests, UI tests, integration tests (where applicable), task status, ADR traceability fields (`governs:`, `status: deleted`) | edit specs or ADR decision content, mark its own work `done`, run `git commit` / `git push` / `gh` |
| **validate-agent** | 3 — VALIDATE | task status + attempt count; on PASS the per-task commit, push, PR description update, the task's PR Test Results block, and (for the task that exercises user-interactable behavior) the committed demo recording + the PR `### Demo` reference (§3) | fix code or tests (it reports, never repairs) |
| **review-agent** | 4 — REVIEW | `CHANGELOG.md`, `README.md`; the run's final commit, push, and PR description finalization (§3) | change product code, tests, specs, or ADRs |
| **coreflow-agent** | harness (outside the pipeline) | `CORE_FLOW.md`, `CLAUDE.md`, `.claude/agents/*.md`, `.claude/skills/**`, the three templates, `.claude/settings.json`, `.claude/hooks/**`, `.github/workflows/validate-ai-instructions.yml` — in its own dedicated worktree, where it commits, pushes, and opens the harness PR (§4.4) | touch any product artifact (source, `specs/`, `adrs/` records, `tasks/`, `failures/` records, `README.md`, `CHANGELOG.md`), run pipeline phases, spawn agents, or commit/push/merge to `main`, or force-push |
| **backlog-agent** | backlog capture (outside the pipeline) | `BACKLOG.md` only — in its own dedicated worktree, where it commits, pushes, and opens the backlog PR (§4.5) | touch any other file (product or harness), run pipeline phases, spawn agents, block on any other work, commit/push/merge to `main`, or force-push |

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
├── specs/               Living specifications (spec-agent maintains)
│   └── project.md       REQUIRED: product overview, stack, canonical build/test commands
├── adrs/                Architecture Decision Records (spec-agent creates)
│   └── TEMPLATE.md
├── tasks/               Work units derived from ADRs (spec-agent creates; later phases update status)
│   └── TEMPLATE.md
├── failures/            Terminal-failure records that earn rules (orchestrator writes)
│   └── TEMPLATE.md
├── .claude/agents/      The six subagent definitions
└── .claude/skills/      Invocation interfaces (one per subagent) + the
                         validate-ai-instructions checklist
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
and how to run the **unit test suite**, the **UI test suite**, and the
**integration test suite**. The first evolution must establish the unit and UI
commands (via an ADR choosing the stack); the integration command is added when
a task first requires integration tests. `validate-agent` refuses to validate
if the unit-test or UI-test commands are missing — that is a phase failure, not
an excuse to guess. The integration-test command is optional: if absent,
`validate-agent` skips that tier and notes the omission in its report.

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

1. **A Claude Code worktree, branched from `main`.** Before Phase 1, the
   orchestrator puts the run inside a **Claude Code worktree** — the native
   feature (https://code.claude.com/docs/en/worktrees), entered with the
   `EnterWorktree` tool, or by the human having started the session with
   `claude --worktree`. The worktree always branches from the repository's
   default branch (`origin/HEAD` = `main`), starting from a clean tree matching
   the remote — the `worktree.baseRef: "fresh"` setting in
   `.claude/settings.json` makes the worktree branch from `main` on a clean
   tree. All four phases then run inside that single worktree — they share one
   working tree.
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

### Demo
_Populated when the run's user-interactable behavior is first exercised, or
marked exempt._

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
orchestrator on terminal FAIL. Each task contributes one entry per test tier,
using GitHub collapsible `<details>` blocks whose `<summary>` carries the test
count and the final state (`PASS` / `FAIL`):

```
#### TASK-NNNN — <title>

<details><summary>Unit — N tests, PASS</summary>

| Test | Result |
|---|---|
| <test name> | pass / fail |

</details>

<details><summary>UI — N tests, PASS</summary>

<screenshot reference per the screenshot-embed rule below — inline image on a
publicly readable repo, clickable viewer link otherwise>

</details>

<details><summary>Integration — N tests, PASS</summary>

What matters: counts (passed / failed / skipped), the assertion groups
exercised with pass/fail each, endpoints or external surfaces hit, and any
notable live-network anomalies or tolerances. Omit the block entirely when no
integration command is configured.

</details>
```

UI screenshots are referenced by **committed artifact path** on the run branch,
not pasted bytes: the UI suite writes its screenshots to a known run-artifacts
directory that the terminal actor commits with the task, and the block
references them by their committed path. How the block references them depends
on the repository's visibility, because GitHub's image proxy fetches an inline
image's source URL anonymously — that succeeds only for a publicly readable
repo. The actor that writes the block (validate-agent on PASS, the orchestrator
on terminal FAIL) determines visibility deterministically from the host's
metadata before writing it, and then:

- **Publicly readable repo:** embed each screenshot inline as an image whose
  source is the committed-artifact raw URL on the run branch
  (`![<name>](…/raw/<run-branch>/<path>)`) — it renders inline.
- **Non-public repo (private or internal):** reference each screenshot as a
  clickable link to its file-viewer URL on the run branch
  (`[<name>](…/blob/<run-branch>/<path>)`) — never an inline image, which would
  fetch anonymously and 404. Add a one-line note that inline thumbnails on a
  non-public repo require manually dragging the images into the PR in the web
  UI (the only reliable path; out of scope for automation).

The contract is absolute: **never emit an inline image whose source is a raw
URL on a non-public repo** — it renders broken. When a UI run produces no
screenshots, the UI block falls back to the same table form as the unit block
and says so. In every case: never promise an image that will not render. On
terminal FAIL the summary state is `FAIL`, the unit/UI tables mark the failing
rows, and the integration block records what failed.

**Demo recording** — a run that adds or changes **user-interactable product
behavior** must carry a screen recording of the actually-running product
exercising that behavior, referenced from the PR's `### Demo` section. Like UI
screenshots, the recording is a **committed run-artifact on the run branch**
(written by the UI suite to the same known run-artifacts directory, committed
with its task), not pasted bytes — and the same actor that owns the per-task PR
update produces and references it.

- **Who.** The UI tier records it. The first task whose validation exercises the
  run's user-interactable behavior captures the recording during its full UI
  suite run; `validate-agent` commits it with that task and writes the `### Demo`
  reference into the PR on PASS. `review-agent` confirms the section is present
  and accurate at finalization (it audits, never re-records). One recording per
  run is sufficient; a run touching several user-facing flows may carry one per
  flow.
- **Required arc.** The recording must capture, in order: **boot** (launch the
  product from a clean start via the canonical run command in `specs/project.md`)
  → **prepare** (perform the minimal setup the behavior needs to be exercised) →
  **interact** (drive the new behavior end-to-end through its primary user flow
  so the recording shows it working) → **revert runtime state** (reset the
  product's in-app runtime state back to its pre-interaction starting condition —
  an in-app teardown, never a git revert of source) → **stop**. Capture is
  produced during the run by the UI suite, not hand-recorded.
- **How referenced.** A committed video does not render as an inline player from
  a branch URL (GitHub plays a `<video>` only for assets uploaded through the web
  UI), so the `### Demo` reference is always a **clickable link** to the
  committed artifact — never an inline tag that would render broken. Its URL
  obeys the same visibility rule as screenshots: on a **publicly readable repo**
  the link targets the committed-artifact raw URL on the run branch
  (`.../raw/<run-branch>/<path>`); on a **non-public repo** it targets the
  file-viewer URL (`.../blob/<run-branch>/<path>`), with a one-line note that
  inline playback requires manually dragging the file into the PR in the web UI
  (out of scope for automation).
- **Scope cutoff.** A demo is **required** only for runs that add or change
  user-interactable product behavior. A run is **exempt** — no recording — when
  it is a pure refactor or internal change with no user-facing behavior change,
  a headless / non-UI change (no interactive surface to record), a harness run
  (§4.4), or a backlog run (§4.5). An exempt run states it in the `### Demo`
  section as `No demo — <reason>` rather than leaving it blank, so the absence is
  deliberate and visible, never an oversight.

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
                     │   validate-agent: run FULL unit + UI + integration suites
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
it MUST be included in the prompt of every agent spawned during the run. Then
put the run inside a **Claude Code worktree** (§3 Git contract): enter it with
the `EnterWorktree` tool unless the human already started the session with
`claude --worktree`. The worktree branches from `main` (`worktree.baseRef:
"fresh"`), and all four phases run inside it.

**Phase 1 — SPEC.** Spawn `spec-agent` with: the user prompt verbatim, `E`, and
the Rule Pack. The agent reads `CORE_FLOW.md`, everything in `specs/`, and
everything in `adrs/` to understand the project, then:
1. creates and checks out the run branch `ai/e<E>-<slug>` inside the Claude
   Code worktree the orchestrator entered at run start (§3 Git contract) and
   does all of its Phase 1 work there — build work never happens on `main` or
   in the primary working tree,
2. aligns the prompt with the existing project (or defines the project, on the
   first run),
3. creates or updates spec files in `specs/`,
4. writes one ADR per significant decision the prompt forces, seeding its
   `governs:` list with the code paths its tasks will create or shape,
5. derives an ordered set of tasks for each ADR — each task small enough to
   implement and validate in one agent run, with acceptance criteria and
   explicit test requirements (unit; UI where user-facing; integration where
   external connectivity is involved),
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
   tests** (unit always; UI tests whenever the task touches user-facing
   behavior; integration tests whenever the task involves external
   connectivity, API calls, or proxy behavior), then sets the task to
   `validating`. Along the way it keeps traceability true (§3): new files get
   their `ADR:` comment, `governs:` lists are trued up, and an ADR whose last
   governed code was just removed is marked `deleted`.
2. Spawn `validate-agent` with the task ID. It reads the canonical commands
   from `specs/project.md` and executes the **full** unit suite, the **full**
   UI suite, and — if the integration-test command is present — the **full**
   integration suite (full, not task-scoped — this is the regression gate).
   Integration tests may be skipped when the command is absent from
   `specs/project.md`; the omission is noted in the report but is not itself
   a FAIL. It returns PASS or FAIL with the failing tests and a suspected
   cause. On PASS it also makes the task's commit, pushes the run branch,
   updates the PR description, writes the task's collapsible Test Results
   block into the PR, and — when this task is the one that exercises the run's
   user-interactable behavior — commits the UI suite's demo recording and
   writes the PR's `### Demo` reference (§3 Git contract, Test Results, Demo
   recording); on FAIL nothing is
   committed and no Test Results block is written — the retry reworks the tree
   in place, and the block is written only at the task's terminal state.
3. On FAIL: increment `attempts`. If `attempts < 4`, loop to step 1. After the
   3rd failed retry (`attempts = 4`), run the failure protocol (§5, including
   the failure commit and the failed task's Test Results block — that is the
   terminal FAIL state, so its evidence goes into the PR), mark the task
   `failed`, mark tasks that depend on it `blocked`, and continue with the
   remaining independent tasks.

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
   CHANGELOG reference (§3 Git contract), confirming every concluded task has
   its Test Results block (it audits, never regenerates — the terminal actor
   wrote each block) and that the `### Demo` section carries a recording
   reference for a user-interactable run or an explicit `No demo — <reason>`
   for an exempt one (§3 Demo recording).

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
| `coreflow-agent` (harness path) | no retries — a coherent change self-publishes on a `harness/<slug>` branch (§4.4); a failed harness change is reported, recorded, and left to the human |
| `backlog-agent` (backlog path) | no retries — a failed capture is reported and left to the human |

### 4.4 The harness path (coreflow-agent, no pipeline)

Harness prompts bypass the pipeline entirely: the orchestrator spawns
`coreflow-agent` with the human instruction verbatim plus the Rule Pack, and
relays its report. The agent owns the whole harness surface — `CORE_FLOW.md`
(canonical), `CLAUDE.md`, `.claude/agents/*.md`, `.claude/skills/**`, the
three templates, `.claude/settings.json`, `.claude/hooks/**`,
`.github/workflows/validate-ai-instructions.yml` — and nothing else: it never
touches product artifacts and never runs pipeline phases.

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
its report. The agent owns a single file — `BACKLOG.md` at the repository root
— and nothing else: it never touches product or harness artifacts and never
runs pipeline phases. It is **non-blocking**: it may run in the background and
in parallel with the pipeline or another agent, never waits on anything, and
nothing waits on it.

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

It commits and pushes to its own `backlog/<slug>` branch only and opens the PR;
it never commits, pushes, or merges to `main`, and never force-pushes. Merging
the backlog PR is the human's decision. If `git` or an authenticated `gh` CLI
is unavailable, or `git fetch origin main` fails, that is a `PHASE-FAILURE` —
the backlog path does not fall back to an uncommitted write.

## 5. Failure → Rule protocol

A **terminal failure** is any phase ending beyond its retry budget, or any
phase reporting `PHASE-FAILURE`. The harness path counts too: a
`coreflow-agent` `PHASE-FAILURE` is recorded with `phase: harness`. The
failure record and rule append are written inside the run worktree (where the
build changes live and the run branch is checked out), so they commit together
with the working state on that branch. The orchestrator (never the agents)
then:

1. Creates `failures/FAIL-NNNN-<slug>.md` from `failures/TEMPLATE.md`:
   evolution, phase, related ADR/task IDs, symptom, root cause, what each
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
