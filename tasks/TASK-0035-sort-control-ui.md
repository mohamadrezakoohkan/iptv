---
id: TASK-0035
adr: ADR-0017
evolution: 9
status: pending
attempts: 0
depends_on: [TASK-0033]
---

# TASK-0035 — Sort control in the channel-grid toolbar

## Goal

The user can change the channel sort order from a visible control in the
channel-grid toolbar (`.ch-bar`). Changing it re-orders the grid and persists
the choice, which is restored on the next reload. Builds on the comparator,
`SORTS` list, `setSort`, and `saveSt('sort')`/`loadSt` from TASK-0033.

## Acceptance criteria

- [ ] A labelled native `<select id="ch-sort">` is present in `.ch-bar`
      (`index.html`), next to `#ch-count`, with an accessible label.
- [ ] Its options are rendered from `IptvSrch.SORTS` (id → value, label → text),
      with the option matching `ST.sort` selected on render.
- [ ] Changing the select calls `setSort`, persists via `saveSt('sort')`, and
      re-renders the grid through `getChs` with the new token — the visible card
      order updates accordingly.
- [ ] On page load with a previously persisted `iptv_sort`, the grid renders in
      that order and the select reflects it.
- [ ] The control is keyboard-operable (native select) and styled consistently
      with the existing toolbar (`client/app.css`).

## Test requirements

- **Unit:** the render helper that builds the select options from `SORTS`
  (correct option set, current selection marked). Follow R-0001 — only assert
  attributes/markup the helper actually produces; check the baseline HTML for
  `.ch-bar` before asserting any attribute presence.
- **UI:** in demo mode, change the sort select to `name-asc` and assert the
  first card is the alphabetically-first channel; reload (persisted) and assert
  the order and the selected option are restored. Capture a screenshot of the
  toolbar with the sort control for the PR Test Results block.
- **Integration:** n/a — no external connectivity.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
