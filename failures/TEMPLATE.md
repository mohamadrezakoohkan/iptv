---
id: FAIL-0000
date: YYYY-MM-DD
evolution: <N>
phase: validate    # spec | implement | validate | review | harness
related: []        # ADR/TASK IDs involved
root-cause-tag: <kebab-case-slug>   # REQUIRED single tag, e.g. shared-scope-collision, wrong-test-assertion — the token recurrence (§5, threshold 2) is counted from
---

# FAIL-0000 — <one-line symptom>

## Symptom

What was observed (failing tests, PHASE-FAILURE message, discrepancy), with
the relevant output trimmed to the evidence.

## Root cause

The actual cause, as deep as it could be diagnosed — not the surface error.

## Attempts

What each attempt tried and why it didn't work (1 initial + retries).

## Rule earned

> **R-0000:** One imperative, generalized sentence ("Always…" / "Never… when…")
> that would have prevented this failure.

Copied verbatim into the Learned Rules section of `CLAUDE.md` by the
orchestrator.

---

This template is for a **terminal** failure (retry budget exhausted or a
`PHASE-FAILURE`) or a **recurrence-promoted** record (a `root-cause-tag` that
reached the threshold of 2 across recorded entries — §5). A **persistent
recovered near-miss** is NOT a full record: it is one row appended to
`failures/NEAR-MISSES.md` with evolution, phase, related IDs, a one-line
symptom, its `root-cause-tag`, and the one-line fix (§5). A **transient**
recovered failure (network blip, timeout, in-tolerance live-network sampling)
is not recorded at all.
