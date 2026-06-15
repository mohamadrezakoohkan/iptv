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
| 19 | 3 VALIDATE | ADR-0031 / TASK-0064 | Task concluded `done` on a clean first-attempt PASS but its `attempts` front-matter stayed `0` (every sibling task records `1`); review-agent surfaced the discrepancy, orchestrator corrected it | task-attempts-miscount | Orchestrator set `attempts: 0 → 1` and committed the status correction on the run branch |
| 20 | 3 VALIDATE | ADR-0033 / TASK-0068 | Same as E19: first-attempt PASS task left at `attempts: 0`; review-agent flagged it as a status-fix discrepancy | task-attempts-miscount | Orchestrator set `attempts: 0 → 1` (folded into the E20 review-remediation commit) |
| 22 | 3 VALIDATE | ADR-0038 / TASK-0080 | Third identical occurrence: first-attempt PASS task left at `attempts: 0`; review-agent explicitly noted it matched the E19/E20 corrections | task-attempts-miscount | Orchestrator set `attempts: 0 → 1`; recurrence (3×) crossed the §5 threshold → promoted to FAIL-0002 / R-0002 |
| 23 | 2 IMPLEMENT | ADR-0039 / TASK-0085 → TASK-0086 | `src/client/ctrl.js` was created but its `<script src="/ctrl.js">` include was omitted from `index.html`, so `window.IptvCtrl` would be `undefined` at runtime | missing-script-include | The next task (TASK-0086), whose init wiring depends on `window.IptvCtrl`, added the script include to `src/index.html`; caught and fixed within the run (first occurrence of this tag, below the §5 threshold of 2) |
