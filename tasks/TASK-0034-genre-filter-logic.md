---
id: TASK-0034
adr: ADR-0018
evolution: 9
status: done
attempts: 1
depends_on: []
---

# TASK-0034 — Pure genre filter helper + alphabetical category ordering

## Goal

`client/srch.js` exposes a pure `getCats(cats, q)` helper that filters a
category list by case-insensitive substring on the category name and returns
them in name-ascending order. This is the logic the filterable sidebar
(TASK-0036) will consume; isolating it here keeps it unit-testable without DOM.

## Acceptance criteria

- [ ] `window.IptvSrch.getCats(cats, q)` returns the subset of `cats` whose
      category name (`category_name`, falling back to `name`) contains `q`
      case-insensitively; an empty/whitespace `q` returns all categories.
- [ ] The returned categories are ordered by name ascending
      (case-insensitive `localeCompare`).
- [ ] `getCats` is pure: it does not mutate its input array, and reads no `ST`,
      `window`, or DOM.
- [ ] A category whose name field is missing is handled without throwing
      (treated as empty name).

## Test requirements

- **Unit:** `getCats` substring match (case-insensitive), empty query returns
  all, alphabetical ordering of results, input array not mutated, missing-name
  category tolerated. Pure (no `ST`/DOM).
- **UI:** n/a — not user-facing on its own (the sidebar wiring is TASK-0036).
- **Integration:** n/a — no external connectivity.

## Implementation notes

**Files touched**

- `client/srch.js` — added pure `getCats(cats, q)` (plus private `catName` and
  `cmpCat` helpers), exported on `window.IptvSrch`. Added `ADR-0018` to the
  file's `ADR:` comment.
- `tests/unit/srch.test.js` — added the `getCats — filter + ordering` describe
  block (10 unit tests). Added `ADR-0018` to the file's `ADR:` comment.

**Non-obvious notes**

- `getCats` filters by category **name** (`category_name`, fallback `name`),
  not id — per acceptance criteria and ADR-0018 (the sidebar filter input is
  name-based). Ordering is `localeCompare` on lower-cased names, mirroring the
  existing `cmpName` channel comparator. Missing name → `''` (sorts first,
  never throws).
- Pure: no `ST`/`window`/DOM reads, input array is copied before sort.
- `governs:` already lists `client/srch.js` for ADR-0018 — no traceability
  changes were needed beyond the in-file `ADR:` comment.

**Pre-existing demo cat-casing concern (investigated, NOT fixed here — see
report concerns):** the demo path in `client/api.js` sets each demo channel's
`cat` to the category **name** (`'News'`) while the demo category's `id` is the
lower-cased slug (`'news'`), so `rndSide`'s count and `getChs`'s category filter
yield zero for demo. This is a demo-fixture inconsistency in the channel↔category
**id** linkage (api.js / ADR-0008, surfaced in ui.js / ADR-0009), not a defect in
the genre **name** filter that `getCats` provides — Xtream and M3U both set
`ch.cat === category_id` consistently. Fixing it would touch a different ADR's
data and is out of this task's pure-logic scope.
