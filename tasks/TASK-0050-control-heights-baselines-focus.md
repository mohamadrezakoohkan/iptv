---
id: TASK-0050
adr: ADR-0024
evolution: 14
status: done
attempts: 1
depends_on: [TASK-0047, TASK-0048, TASK-0049]
---

# TASK-0050 — Control heights, category list, footer baseline, one global focus ring

## Goal

Primary controls share one 36px height and secondary controls one 28px height
(with a real 28×28 star hit box); the sidebar category list becomes a tidy flex
column of 36px rows; the footer form is a single flex-end row whose inputs and
button share one baseline; and a single global `:focus-visible` rule replaces
every per-component focus declaration (spacing-sizing.md rules 3 + 7 + 8 + 10),
by rewiring the relevant `client/app.css` rules to read TASK-0047's tokens.

## Acceptance criteria

- [ ] **Primary controls = `--ctl` (36px):** `.field input`, `.btn`
      (Connect/Disconnect), and `.login-mode` are 36px tall.
- [ ] **Secondary controls = 28px** (`calc(var(--s6) + var(--s1))`):
      `.fmt-chip`, `.ch-sort`; the card number/logo/star row affordances size to
      the 28px secondary scale, including a **real 28×28 hit box** on `.ch-fav`.
- [ ] **Category list (rule 7):** `.sidebar-list` is `display: flex; flex-direction:
      column; gap: 2px` (desktop); `.cat-btn` is `height: var(--ctl)` (36px) with
      `--s3` (12px) inner padding; `.cat-count` has `min-width: 26px`, `padding:
      3px 5px` (verbatim off-grid exceptions) and tabular numerals. The existing
      `max-width: 760px` horizontal-strip rule is preserved.
- [ ] **Footer form (rule 8):** `.footer-form` is `display: flex; align-items:
      flex-end; gap: var(--s3)` (12px); each `.field` label is mono 10px uppercase
      with `gap: var(--s1)` (4px) to its `--ctl` (36px) input; the submit `.btn`
      is `--ctl` so the input row and button share one bottom baseline.
- [ ] **One global focus ring (rule 10):** a single rule
      `:focus-visible { outline: 2px solid var(--acc); outline-offset: 1px }`
      exists, and every per-component `:focus-visible` outline declaration
      (e.g. `.thm-toggle`, `.acct-btn`, `.acct-close`, `.acct-row`,
      `.acct-row-rm`, `.ch-sort`, `.sig-btn`, `.ch-empty-btn`, `.mode-opt input`)
      is removed. Per-component `:focus` / `:focus-within` **border-colour** cues
      on inputs may remain (they are not outline rules).
- [ ] Any existing test asserting a value this task changes (e.g. sort-control
      28px, chip height, control focus outline) is updated in this task; no
      behaviour change.

## Test requirements

- **Unit:** CSS-source assertions: `.field input`/`.btn`/`.login-mode` reference
  `var(--ctl)`; `.fmt-chip`/`.ch-sort`/`.ch-fav` are 28px; `.sidebar-list` is a
  flex column with `gap: 2px`; `.cat-btn` height `var(--ctl)`; `.cat-count`
  `min-width: 26px` + `padding: 3px 5px`; `.footer-form` flex + `align-items:
  flex-end` + `gap: var(--s3)`; exactly one `:focus-visible` outline rule exists
  and the listed per-component `:focus-visible` outline rules are gone.
- **UI:** Playwright (demo mode): `.field input` and `#btn-conn` both measure
  36px tall and their bounding-box bottoms are equal (shared baseline); a
  `.fmt-chip` measures 28px; a `.ch-fav` hit box measures 28×28; a `.cat-btn`
  measures 36px tall; tab to a control and assert the computed `outline` is
  `2px solid` the accent colour with `outline-offset` 1px (the single global
  ring). Captures `task-0050-footer-baseline.png`.
- **Integration:** n/a — no external connectivity.

## Implementation notes

Files touched:
- `client/app.css` — rewired rules 3 + 7 + 8 + 10 to read TASK-0047 tokens:
  - **Rule 3 (primary 36px):** `.field input`, `.btn`, `.login-mode` now read
    `height: var(--ctl)`; `.footer-status` `min-height: var(--ctl)`.
  - **Rule 3 (secondary 28px):** `.fmt-chip` and `.ch-sort` height now
    `calc(var(--s6) + var(--s1))` (28px); `.ch-fav` became a real 28×28 hit box
    (`width`/`height` `calc(var(--s6) + var(--s1))`, centred inline-flex, padding 0).
  - **Rule 7 (category list):** `.sidebar-list` is now `display: flex;
    flex-direction: column; gap: 2px` (desktop) keeping `var(--sgut)` gutter
    (`padding: var(--s2) var(--sgut) var(--s4)`); `.cat-btn` height
    `var(--ctl)` (was 34px) + `flex: none`, keeps `--s3` inner inset; mobile
    `.cat-btn` 34px → `var(--ctl)`; `.cat-count` gained `min-width: 26px`,
    `padding: 3px 5px` (verbatim off-grid exceptions) + `text-align: center`,
    keeps `tabular-nums` and `var(--s1)` radius. The mobile `max-width: 760px`
    horizontal-strip rule is preserved.
  - **Rule 8 (footer baseline):** `.footer-form` gap `10px` → `var(--s3)`;
    `.field` label-to-input gap `4px` → `var(--s1)`. `align-items: flex-end`
    already present; 36px inputs + 36px button now share one bottom baseline.
  - **Rule 10 (one focus ring):** added a single global
    `:focus-visible { outline: 2px solid var(--acc); outline-offset: 1px }`
    near the top; removed every per-component `:focus-visible` outline rule
    (`.sig-btn`, `.ch-empty-btn`, `.ch-sort`, `.thm-toggle`, `.acct-btn`,
    `.acct-close`, `.acct-row`, `.acct-row-rm`, `.mode-opt input`). Input
    `:focus` / `:focus-within` border-colour cues (`.field input:focus`,
    `.search-field:focus-within`) intentionally remain (not outline rules).
- `tests/unit/controls.test.js` (new) — CSS-source assertions for all four rules.
- `tests/ui/controls.test.js` (new) — Playwright: input+button both 36px on one
  baseline, login-mode 36px, chip 28px, star 28×28, category row 36px, and the
  single global focus ring via real keyboard tabbing. Captures
  `task-0050-footer-baseline.png`.
- `adrs/ADR-0024-...md` — `governs:` trued up with the two new test files
  (traceability only).

Non-obvious: the focus-ring UI test tabs with real `page.keyboard.press('Tab')`
(not `.focus()`) because `:focus-visible` only matches under the browser's
keyboard-focus heuristic; programmatic focus would never show the ring.

Full unit suite: 582 passed (25 files). Full UI suite: 172 passed. No
behaviour change — purely CSS geometry + test updates.
