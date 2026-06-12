---
id: TASK-0034
adr: ADR-0018
evolution: 9
status: pending
attempts: 0
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

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
