---
id: FAIL-0002
date: 2026-06-15
evolution: 22
phase: validate
related: [TASK-0064, TASK-0068, TASK-0080, ADR-0031, ADR-0033, ADR-0038]
root-cause-tag: task-attempts-miscount
---

# FAIL-0002 — Concluded tasks left at `attempts: 0` on a clean first-attempt PASS (recurrence-promoted)

## Symptom

Across three consecutive build runs, a task validated and set to `status: done`
on its **first attempt** kept its `attempts` front-matter at `0` while every
sibling task in the same run correctly recorded `attempts: 1`. `review-agent`
surfaced the mismatch each time as a `status-fix` discrepancy and the
orchestrator corrected it:

- E19 — TASK-0064 (now/next line on the channel card)
- E20 — TASK-0068 (Remind toggle on EPG rows)
- E22 — TASK-0080 (Movies browse) — review-agent explicitly noted this was
  "identical to the prior E19 TASK-0064 and E20 TASK-0068 corrections".

Each occurrence is recorded as a row in `failures/NEAR-MISSES.md` under the
single `root-cause-tag: task-attempts-miscount`. Three occurrences ≥ the §5
threshold of 2, so this record is **recurrence-promoted** (mechanical, no
judgment call).

## Root cause

The actor that makes a task's terminal-success commit (`validate-agent` on
PASS) sets `status: done` but does not true up the `attempts` counter to the
attempt number that just succeeded. A clean first-attempt pass therefore leaves
the spec-agent-seeded `attempts: 0` in place, so the task file misrepresents
reality (it reads as "concluded with zero attempts"). The lifecycle only
*increments* `attempts` on a FAIL retry (CORE_FLOW.md §4.2 step 3), so a task
that never fails is never bumped off `0`. The orchestrator, as referee, has been
repairing the field after the fact every run instead of the defect being
prevented at the source.

## Attempts

Not a retry-loop failure — this is a recurrence-promoted bookkeeping defect.
"Attempts" here are the three independent run-level recoveries: in E19, E20, and
E22 the orchestrator detected the wrong `attempts` value (via review-agent) and
corrected `0 → 1` after the task had already been committed `done`. The
correction worked each time but the defect kept recurring because nothing
changed the behavior of the actor that writes the terminal task state.

## Rule earned

> **R-0002:** When concluding a task as `status: done` on a passing validation,
> set its `attempts` front-matter to the actual attempt number — a clean
> first-attempt pass is `attempts: 1`, never `attempts: 0`. The actor making the
> terminal-success commit (validate-agent on PASS) must true up `attempts` so
> the task file matches reality before committing.

Copied verbatim into the Learned Rules section of `CLAUDE.md` by the
orchestrator (between the `LEARNED-RULES` markers), committed with this record
on the run branch.
