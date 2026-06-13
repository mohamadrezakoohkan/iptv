---
id: TASK-0048
adr: ADR-0024
evolution: 14
status: done
attempts: 1
depends_on: [TASK-0047]
---

# TASK-0048 — Column gutters + both 56px headers aligned on one line

## Goal

Every block in a column shares one horizontal gutter so the column's left edges
line up, and both column headers are exactly 56px tall padded to their own
gutter so their bottom borders form one continuous horizontal line
(spacing-sizing.md rules 2 + 5). Implements the gutter/header half of the
restyle by rewiring the relevant `client/app.css` rules to read the tokens from
TASK-0047.

## Acceptance criteria

- [ ] **Sidebar gutter = `--sgut` (16px):** `.sidebar-head`, `.sidebar-search`,
      and `.sidebar-list` apply 16px horizontal gutter; controls inside
      (`.search-field`, and `.cat-btn` per rule 7 — but its full snap lands in
      TASK-0050) use `--s3` (12px) inner insets. Sidebar block left edges align
      at 16px from the sidebar's left.
- [ ] **Content gutter = `--gut` (24px):** `.content-head`, `.player-wrap`,
      `.ch-section`, and `.footer` apply 24px horizontal gutter; at the existing
      `max-width: 760px` breakpoint the content gutter is `--s4` (16px). Content
      block content-left edges align at 24px (16px on mobile).
- [ ] **Both headers 56px on one line:** `.sidebar-head` and `.content-head` are
      `height: var(--hd)` (56px); `.sidebar-head` padded to `--sgut`,
      `.content-head` padded to `--gut`; their bottom borders sit at the same y.
- [ ] No `padding: 0 14px` / `padding: 10px 12px` / `padding: 0 20px` one-offs
      remain on these blocks — each reads a gutter token.
- [ ] Any existing test asserting a value this task changes (e.g. content-head
      padding) is updated in this task; no behaviour change.

## Test requirements

- **Unit:** CSS-source assertions that `.content-head`, `.player-wrap`,
  `.ch-section`, `.footer` reference `var(--gut)` (and the mobile rule references
  `var(--s4)`), and that `.sidebar-head`/`.sidebar-search`/`.sidebar-list`
  reference `var(--sgut)`; both header rules use `var(--hd)`.
- **UI:** Playwright bounding-box assertions on a 1280px viewport: the content
  block content-left x of `.content-head`, the `.player-card`, `.ch-section`
  contents, and `.footer` are equal (the 24px gutter line); the sidebar block
  left x of `.sidebar-head`/`.sidebar-search`/`.sidebar-list` are equal (16px);
  `.sidebar-head` and `.content-head` have equal height (56px) and equal
  bottom-border y. A 750px-viewport check confirms the content gutter becomes
  16px. Captures `task-0048-gutters.png` to the run-artifacts dir.
- **Integration:** n/a — no external connectivity.

## Implementation notes

**`client/app.css` (the only product file changed):**

- **Sidebar gutter → `--sgut` (16px), rule 2.** `.sidebar-head` `padding: 0 14px`
  → `0 var(--sgut)`; `.sidebar-search` `padding: 10px 12px` → `10px var(--sgut)`;
  `.sidebar-list` `padding: 8px 8px 16px` → `8px var(--sgut) 16px`. Inner controls:
  `.search-field` `0 10px` → `0 var(--s3)` and `.cat-btn` `0 10px` → `0 var(--s3)`
  (12px inner inset; the full `.cat-btn` snap is TASK-0050). Vertical values are
  left untouched — vertical rhythm is TASK-0049's scope.
- **Content gutter → `--gut` (24px), rule 2.** `.content-head` `0 20px` →
  `0 var(--gut)`; `.player-wrap` `16px 20px 10px` → `16px var(--gut) 10px`;
  `.ch-section` `0 20px 16px` → `0 var(--gut) 16px`; `.footer` `12px 20px` →
  `12px var(--gut)`. At the **existing** `max-width: 760px` breakpoint, four
  override lines narrow the content gutter to `--s4` (16px) — no new breakpoint
  introduced.
- **Both headers 56px on one line, rule 5.** `.sidebar-head` and `.content-head`
  `height: 56px` → `height: var(--hd)`; each padded to its own column gutter
  (`--sgut` / `--gut`). Both bottom borders sit at the same y (UI-verified).

No `0 14px` / `10px 12px` / `0 20px` / `56px` one-offs remain on these blocks.
No JS, markup, or behaviour change. `app.css` already carries `ADR: ADR-0024`.

**Tests added:**
- `tests/unit/gutters.test.js` — CSS-source assertions: sidebar blocks read
  `var(--sgut)`, content blocks read `var(--gut)` (and `var(--s4)` in the
  mobile block), inner controls read `var(--s3)`, both headers read `var(--hd)`,
  and no surviving gutter/header literals.
- `tests/ui/gutters.test.js` — Playwright bounding-box checks on a 1280px
  viewport (content-column content-left x aligned; sidebar block left x aligned;
  both headers 56px tall with bottom borders on one y) and a 750px-viewport
  check that the content gutter becomes 16px. Captures
  `test-results/task-0048-gutters.png`.

ADR-0024 `governs:` trued up to list both new test files.
