---
id: ADR-0024
title: Unify spacing/sizing/radii under a single 4px-grid token contract (CSS-only restyle)
date: 2026-06-13
evolution: 14
status: accepted
governs:
  - client/app.css
  - index.html
  - tests/ui/grid-align.test.js
---

# ADR-0024 — Unify spacing/sizing/radii under a single 4px-grid token contract (CSS-only restyle)

## Context

E14 prompt (from the parked BACKLOG idea): *"Spacing & sizing unification pass
for the IPTV player UI: replace all eyeballed/hardcoded paddings, gaps, sizes,
and radii with a single 4px-grid token contract so every block edge and control
baseline aligns."* The prompt names the exact token contract, ten rules of
intent, and the acceptance: vertical gutter lines catch every block edge, and
controls in a row share height and baseline.

Today `client/app.css` is full of eyeballed one-offs — `padding: 0 14px`,
`gap: 10px`, `height: 34px`, `padding: 10px 12px`, `padding: 11px`,
`width: 30px`, scattered `border-radius` values (3px/4px/5px/6px/7px/8px) — so
column edges do not line up and controls in a row do not share a baseline. The
colour system is already a clean token layer (ADR-0019: eight colour tokens +
two font tokens on `:root`, every rule reads them); spacing/sizing has **no**
such layer yet. This decision adds the missing geometry layer.

Constraints that bound this decision:
- **ADR-0019** owns the colour tokens and the `:root[data-theme="light"]`
  override rule. Colour and font tokens are reused **unchanged**; this run adds
  an orthogonal spacing/sizing layer and does not contradict ADR-0019.
- **CONVENTIONS.md** §10: no inline styles; tokens via CSS custom properties.
- Resolved scope (human): this is a **CSS-level restyle of existing surfaces
  only** — no new screens, features, or behavioural changes. `--acc` and the
  mono font are reused from the existing theme (not introduced here). "16px on
  mobile" hinges on the project's **existing** `max-width: 760px` breakpoint —
  no new threshold is invented. The off-grid badge values (min-width 26px,
  padding `3px 5px`) are deliberate stated exceptions, applied verbatim.

No accepted ADR is contradicted, superseded, or deleted by this change.

## Decision

Introduce a **single 4px-grid spacing/sizing/radius token contract** on `:root`
in `client/app.css`, and rewire every restyled surface's rule to read those
tokens instead of hardcoded values.

### Tokens (declared once on `:root`, theme-agnostic)

```
--s1: 4px;  --s2: 8px;  --s3: 12px;  --s4: 16px;  --s5: 20px;  --s6: 24px;
--gut: 24px;  --sgut: 16px;   /* content gutter / sidebar gutter */
--ctl: 36px;  --hd: 56px;     /* the one control height / header height */
--r1: 6px;    --r2: 8px;      /* control radius / card+player radius */
```

These are geometry, not colour, so they are declared on `:root` only and are
**not** repeated in the `:root[data-theme="light"]` block (they are identical in
both themes). Small-badge radius (4px) reuses `--s1`; no separate radius token is
added for it.

### Rewiring rules (the ten rules, applied in `client/app.css`)

1. Every padding/gap/size/radius in the restyled surfaces reads a token or a
   token multiple; no `10/11/14/30/34px` one-offs remain (except the two stated
   badge exceptions).
2. One gutter per column on every block: sidebar blocks → `--sgut` (16px) with
   `--s3` (12px) inner control insets; content blocks → `--gut` (24px), `--s4`
   (16px) at the `max-width: 760px` breakpoint.
3. Primary controls (footer inputs, Connect/Disconnect, login-mode control) →
   `--ctl` (36px). Secondary controls (`.fmt-chip`, `.ch-sort`, the card
   number/logo/star row, with a real 28×28 `.ch-fav` hit box) → 28px
   (`calc(var(--s6) + var(--s1))`).
4. Two radii: `--r1` on controls, `--r2` on cards/player; 4px (`--s1`) on small
   badges (`.cat-count`, `.on-air-badge`, `.now-cat`).
5. Both column headers `height: var(--hd)` (56px), each padded to its own
   column gutter (`.sidebar-head` → `--sgut`, `.content-head` → `--gut`), so
   their bottom borders form one line.
6. Content vertical rhythm: `.player-wrap` `var(--s6) var(--s6) 0`; `.ch-bar`
   `var(--s5) 0 var(--s3)`; `.ch-grid` gap `var(--s3)`; `.ch-card` padding
   `var(--s3)`; `.footer` padding `var(--s4) var(--gut)`.
7. `.sidebar-list` flex column, gap `var(--s1)`*… (note: rule 7's "gap 2px" is
   below the 4px unit — it is applied as a literal `2px` list-separation, the
   same class of intentional fine value as the badge exceptions, and is the only
   other sub-grid value). `.cat-btn` height `--ctl`, inner padding `var(--s3)`.
   `.cat-count` min-width 26px, padding `3px 5px` (verbatim exceptions),
   tabular-nums.
8. `.footer-form` flex row, `align-items: flex-end`, gap `var(--s3)`; each
   `.field` label is mono 10px uppercase with `gap: var(--s1)` to a `--ctl`
   input; the submit `.btn` is `--ctl` tall — one shared baseline.
9. All numeric content (`.ch-num`, `.cat-count`, `.ch-bar-count`) uses
   `var(--font-mono)` + `font-variant-numeric: tabular-nums`.
10. One global rule `:focus-visible { outline: 2px solid var(--acc);
    outline-offset: 1px }` replaces every per-component `:focus-visible`
    declaration; those per-component outline rules are removed.

`index.html` is in `governs:` only because the one inline-style sizing hooks
(`style="display:none"`) are not geometry — no markup geometry change is
expected; if a hardcoded size is found in markup during implementation it is
moved to a token-driven CSS rule (implement-agent trues `governs:` up if
`index.html` ends up untouched).

## Consequences

**Easier:**
- One geometry layer: future spacing tweaks change a token, not dozens of rules.
- Column edges and control baselines provably align — testable via computed
  bounding boxes (gutter x, header height/border y, row heights/baselines).
- Two radii and one focus ring make the surface visually consistent and auditable.

**Harder:**
- The rewrite touches nearly every rule in `client/app.css`; the UI tier must
  prove the geometry, not just that the page renders.
- Existing UI tests assert some current pixel values (e.g. `tests/ui/css.test.js`
  checks the 240px sidebar; sort-control / chip / theme-toggle tests may assert
  current heights). Any test asserting a value this contract changes must be
  updated in the same task that changes the rule — no staged migration.
- Two intentional sub-grid / off-grid values survive (badge 26px / `3px 5px`,
  list gap 2px); they are documented exceptions, not regressions.

**Ruled out:**
- A new responsive breakpoint (reuse `max-width: 760px`).
- New colour or font tokens (ADR-0019 + existing fonts reused unchanged).
- Snapping the deliberate badge exceptions to the grid.
- Any JS/behaviour/state change — this is CSS-only.

## Tasks derived

- TASK-0047 — Declare the spacing/sizing/radius token contract on `:root`
  (`--s1..--s6`, `--gut`, `--sgut`, `--ctl`, `--hd`, `--r1`, `--r2`) — the
  foundation other tasks read.
- TASK-0048 — Column gutters + both 56px headers on one line (sidebar `--sgut`
  with 12px insets, content `--gut` / 16px mobile; rules 2 + 5).
- TASK-0049 — Content vertical rhythm + two-radii + tabular numbers (player
  wrapper, section-bar, grid gap, card padding, footer padding; `--r1`/`--r2`/
  4px badges; numeric mono tabular-nums; rules 4 + 6 + 9).
- TASK-0050 — Control heights + sidebar category list + footer form baseline +
  one global focus ring (36px primary / 28px secondary incl. 28×28 star,
  category flex column, footer flex-end one-baseline form, global
  `:focus-visible`; rules 3 + 7 + 8 + 10).
- TASK-0051 — Demo recording of the unified-grid surfaces (boot → demo mode →
  navigate restyled surfaces showing aligned gutters/baselines → revert → stop).

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0024` comment near the top
(native comment syntax; `index.html` via HTML comment). When a change removes
the last governed code, this ADR is marked `status: deleted` — the file itself is
never removed; it is history.
