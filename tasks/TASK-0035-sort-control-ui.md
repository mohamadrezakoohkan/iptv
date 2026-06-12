---
id: TASK-0035
adr: ADR-0017
evolution: 9
status: done
attempts: 1
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

Files touched:

- `index.html` — added `<div class="ch-bar-sort">` inside `.ch-bar` next to
  `#ch-count`, holding a `<label for="ch-sort">Sort</label>` and an empty
  labelled native `<select id="ch-sort" aria-label="Sort channels">` (options
  rendered at runtime, not baked into the markup). Added ADR-0017 to the top
  HTML comment.
- `client/ui.js` — new `EL.srt` registry slot (`#ch-sort`), wired in `mkEL`
  with a `change` listener to `onSort`. New pure `mkSort({ sorts, cur })` that
  builds the `<option>` HTML from a SORTS list, emitting `value="<id>"` on every
  option and ` selected` on exactly the one whose id equals `cur` (none when
  `cur` is unknown — R-0001: only the attributes the helper actually writes are
  asserted). New `rndSort()` populates `#ch-sort` from `IptvSrch.SORTS` with the
  current `ST.sort` selected. New `onSort(evt)` calls `setSort`, persists via
  `saveSt('sort')`, and re-renders the grid through `getChs` with the new token.
  `mkSort`, `rndSort`, `onSort` added to the `IptvUi` export.
- `client/main.js` — `onReady` now calls `window.IptvUi.rndSort()` right after
  `loadSt()` so the select is populated and reflects the persisted `ST.sort` on
  page load (before any connect). The select options are static across
  connects, so this single call is sufficient.
- `client/app.css` — `.ch-bar-sort`, `.ch-sort-label`, `.ch-sort` (+ hover /
  focus-visible) styled with the existing toolbar tokens (`--sur2`, `--ln`,
  `--tx`, `--dim`, `--acc`, `--font-ui`/`--font-mono`); native select with a
  custom inline-SVG caret. Added ADR-0017 to the top CSS comment.

Tests:

- `tests/unit/sort.test.js` (new, 7 tests) — `mkSort` option set, value/label
  text, SORTS order, current-selection marking (exactly one selected; unknown
  token marks none).
- `tests/ui/sortctl.test.js` (new, 4 tests) — control present/labelled/populated
  with default num-asc (captures `test-results/sort-toolbar.png` for the PR
  block); name-asc reorders to "Action Movies HD" first and persists
  `iptv_sort`; choice restored across reload (select value + grid order);
  name-desc reorders to "World News 24" first.
- `tests/unit/persist.test.js` — added `rndSort: vi.fn()` to the `runMain`
  `IptvUi` stub to match the new `main.js` call site (test harness update, no
  assertion weakened).

Non-obvious:

- `#ch-count` already existed in `.ch-bar` but is populated by no code (pre-this
  task); left untouched per scope.
- ADR-0017 `governs:` was already complete (all listed files exist); no
  traceability changes beyond the per-file `ADR:` comment trues-up already
  present from TASK-0033.

Verification: `npx vitest run` → 422 passed; `npx playwright test` → 116 passed.
