---
id: TASK-0049
adr: ADR-0024
evolution: 14
status: done
attempts: 1
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

**Files touched**

- `client/app.css` — rewired to read TASK-0047 tokens (no hardcoded px on the
  affected rules):
  - *Rhythm (rule 6):* `.player-wrap` `var(--s6) var(--s6) 0`; `.ch-bar`
    `var(--s5) 0 var(--s3)`; `.ch-grid` `gap: var(--s3)`; `.ch-card`
    `padding: var(--s3)`; `.footer` `padding: var(--s4) var(--gut)` (vertical
    16px, up from the old 12px). Mobile block trued up to match: `.player-wrap`
    `var(--s6) var(--s4) 0`, `.footer` `var(--s4)`.
  - *Two radii (rule 4):* `--r1` on all controls (`.btn`, `.sig-btn`,
    `.ch-empty-btn`, `.field input`, `.search-field`, `.fmt-chip`, `.ch-sort`,
    `.icon-btn`, `.login-mode`, `.cat-btn`, and the account controls
    `.acct-btn` / `.acct-close` / `.acct-row` / `.acct-row-rm` / `.thm-toggle`);
    `--r2` on cards/player (`.ch-card`, `.player-card`, `.acct-conn`); `--s1`
    (4px) on small badges (`.cat-count`, `.on-air-badge`, `.now-cat`). The
    in-card affordances `.ch-logo` / `.ch-logo-fb` / `.ch-fav` (stray 5px/3px)
    snapped to `--s1` so no stray 3px/5px/7px radius literal survives — only the
    `border-radius: 50%` circles (dots/spinner) remain literal.
  - *Tabular numbers (rule 9):* `font-variant-numeric: tabular-nums` added to
    `.cat-count` and `.ch-bar-count`; `.ch-num` already had it. All three read
    `var(--font-mono)`.
- `tests/unit/rhythm.test.js` (new) — CSS-source assertions for every rhythm
  value, the two radii groups, the `--s1` badges, the no-stray-radius rule, and
  tabular-nums on the three numeric selectors.
- `tests/ui/rhythm.test.js` (new) — Playwright computed-style assertions in demo
  mode; captures `test-results/task-0049-grid-cards.png`.
- `tests/unit/gutters.test.js` (TASK-0048) — updated: `.player-wrap`'s
  horizontal gutter now reads `--s6` (rule 6 rhythm), identical 24px, so its
  assertion was split out from the generic `--gut` check; column-left alignment
  unchanged. No other existing test asserted a value this task changed.
- `adrs/ADR-0024-…md` — `governs:` trued up with the two new test files
  (traceability bookkeeping only).

**Non-obvious**

- `--s6` and `--gut` are both 24px; the player-wrap reads `--s6` per rule 6 while
  still satisfying the rule-2 content gutter — no visual or alignment change.
- The footer vertical padding intentionally moves 12px → 16px (`--s4`) per
  rule 6; this is the only deliberate spacing change beyond token substitution.
- The `.cat-count` `padding: 2px 5px` is left untouched — the 3px-vertical badge
  padding is TASK-0050's; only the 4px badge radius is this task's.

Full unit suite (564 tests) and the affected UI specs pass.
