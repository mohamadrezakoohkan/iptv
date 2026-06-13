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
| 17 | 2/3 IMPLEMENT/VALIDATE | ADR-0028 / TASK-0058 | Inserting `#log-btn` between `#theme-toggle` and `#acct-btn` broke the untouched `themetoggle.test.js:31` invariant (theme toggle must sit <20px left of the account button; measured ~88px) | layout-adjacency-regression | Reordered the right-edge cluster with CSS flex `order` so source order (log→toggle→account, per ADR-0028) is preserved while the toggle renders one `--s2` gap left of the account button (ADR-0019 satisfied) |
