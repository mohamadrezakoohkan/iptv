# Near-Misses

Append-only ledger of **persistent recovered failures** — real defects a run
had to fix but that recovered within the retry budget (CORE_FLOW.md §5). The
orchestrator (never the agents) appends one row per persistent recovered
failure, surfaced by `review-agent`, and commits it with the run's working
state on the run branch — never to `main`. Transient recovered failures
(network blip, timeout, in-tolerance live-network sampling) are not recorded.

The `root-cause-tag` is the token recurrence is counted from: when one tag
reaches **2 or more** occurrences across this ledger plus the `root-cause-tag`
front-matter of `FAIL-NNNN-*.md` terminal records, it mandatorily earns a
Learned Rule (CORE_FLOW.md §5). Rows are append-only — never edited or removed
except by explicit human instruction.

| Evolution | Phase | Related (ADR/TASK) | Symptom (one line) | root-cause-tag | Fix (one line) |
|---|---|---|---|---|---|
