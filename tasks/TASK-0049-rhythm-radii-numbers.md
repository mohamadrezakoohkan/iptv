---
id: TASK-0049
adr: ADR-0024
evolution: 14
status: pending
attempts: 0
depends_on: [TASK-0047, TASK-0048]
---

# TASK-0049 — Content vertical rhythm, two-radii system, tabular numbers

## Goal

The content column's vertical rhythm snaps to the grid, the whole surface uses
exactly two radii (plus the 4px small-badge radius), and every numeric element
uses the mono font with tabular numerals (spacing-sizing.md rules 4 + 6 + 9), by
rewiring the relevant `client/app.css` rules to read TASK-0047's tokens.

## Acceptance criteria

- [ ] **Vertical rhythm:** `.player-wrap` padding `var(--s6) var(--s6) 0`
      (24/24/0); `.ch-bar` padding `var(--s5) 0 var(--s3)` (20/0/12); `.ch-grid`
      `gap: var(--s3)` (12px); `.ch-card` `padding: var(--s3)` (12px); `.footer`
      `padding: var(--s4) var(--gut)` (16/24 — the vertical 16px alongside the
      24px gutter already set in TASK-0048).
- [ ] **Two radii only:** controls use `--r1` (6px) — buttons (`.btn`, `.sig-btn`,
      `.ch-empty-btn`), inputs/search (`.field input`, `.search-field`), chips
      (`.fmt-chip`), `.ch-sort`, `.icon-btn`, `.login-mode`, account controls;
      cards/player use `--r2` (8px) — `.ch-card`, `.player-card`, `.acct-conn`;
      small badges use 4px (`--s1`) — `.cat-count`, `.on-air-badge`, `.now-cat`.
      No stray 3px/5px/7px radius values remain (the badge `padding: 3px 5px` in
      rule 7 is a padding exception, not a radius).
- [ ] **Tabular numbers:** `.ch-num`, `.cat-count`, `.ch-bar-count` use
      `var(--font-mono)` with `font-variant-numeric: tabular-nums`.
- [ ] Any existing test asserting a value this task changes (e.g. a card-radius
      or grid-gap test) is updated in this task; no behaviour change.

## Test requirements

- **Unit:** CSS-source assertions for each rhythm value (`.player-wrap`,
  `.ch-bar`, `.ch-grid` gap, `.ch-card` padding, `.footer` padding), for the two
  radii groups referencing `var(--r1)`/`var(--r2)` and badges using `var(--s1)`,
  and for `font-variant-numeric: tabular-nums` on the three numeric selectors.
- **UI:** Playwright computed-style assertions (in demo mode so cards/numbers
  render): a `.ch-card` has `border-radius` 8px and `padding` 12px; the
  `.ch-grid` computed `gap`/`row-gap` is 12px; a `.fmt-chip` and `.btn` have
  `border-radius` 6px; a `.cat-count` has `border-radius` 4px; `.ch-num` and
  `.cat-count` report `font-variant-numeric` including `tabular-nums` and a
  mono `font-family`. Captures `task-0049-grid-cards.png`.
- **Integration:** n/a — no external connectivity.

## Implementation notes

_Filled by implement-agent._
