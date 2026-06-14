---
id: RESEARCH-0000
date: YYYY-MM-DD
evolution: <N>
winner: <one-line description of the winning feature>
---

# RESEARCH-0000 — <winning feature, short title>

## Method

How the survey was run: which competitor products were examined and which
public app-review sources (app stores, forums, review sites) were mined for
demand signals. Note the dedup pass against `BACKLOG.md` (parked) and
`CHANGELOG.md` (shipped) — features already built or parked are excluded.

## Candidates and scores

Exactly three candidate features, each scored 1–5 on the three dimensions
(no build-effort/complexity dimension). Highest total wins.

| Candidate feature | User demand (a) | Product-fit (b) | Differentiation (c) | Total |
|---|---|---|---|---|
| <feature 1> | 0 | 0 | 0 | 0 |
| <feature 2> | 0 | 0 | 0 | 0 |
| <feature 3> | 0 | 0 | 0 | 0 |

- **(a) user demand / frequency** — how often requested across mined reviews +
  size of the competitor gap.
- **(b) product-fit / alignment** — fit with the product's current scope and
  existing specs/ADRs.
- **(c) competitive differentiation** — table-stakes vs. standout vs.
  competitors.

## Winner

The highest-scoring candidate, with a one-paragraph rationale. State the
tie-break if two candidates tie (prefer higher user-demand, then product-fit).
This feature is the one the orchestrator routes to `backlog-agent`.

## Sources

- <competitor product> — <what it has that informed a candidate, URL>
- <app-review source> — <demand signal observed, URL>

---

This report is written by `research-agent` (CORE_FLOW.md §4.6), committed on the
run branch — never on `main`. The winning feature reaches `BACKLOG.md` only via
`backlog-agent`; research-agent never writes `BACKLOG.md`.
