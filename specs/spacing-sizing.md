---
status: current
---

# Spacing & sizing — the 4px-grid token contract

> Feature spec for the spacing/sizing unification pass over the existing IPTV
> player UI. This is a **CSS-level restyle only** — no new screens, features, or
> behavioural changes. The mechanism decision and its rationale live in
> ADR-0024. Colour tokens (`--bg`…`--live`, `--acc`) and the fonts
> (`--font-ui`, `--font-mono`) are **owned by ADR-0019 / the existing theme and
> are reused unchanged** — this feature introduces only spacing/sizing/radius
> tokens and rewires existing rules to read them.

## Purpose

Today every surface of the console (sidebar, content header, player wrapper,
channel grid/cards, footer, account panel) carries eyeballed, hardcoded
paddings, gaps, sizes, and radii — 10px, 11px, 14px, 30px, 34px one-offs that
do not line up. This pass replaces them with a **single 4px-grid token
contract** so every block edge and control baseline aligns: vertical gutter
lines catch every block edge, and controls in a row share height and baseline.

It is purely presentational. No state-machine phase, no JS behaviour change, no
change to channels, playback, accounts, persistence, theme, or empty-states. The
only files that change are `client/app.css` (the rules) and — only if any
hardcoded size lives in markup — `index.html`; no other client file is touched.

## 1. Token contract

Eight new custom properties are declared once on `:root` in `client/app.css`,
alongside the existing colour/font tokens (ADR-0019). They are **theme-agnostic**
(identical in dark and light — they are geometry, not colour) so they live on
`:root` only and are **not** re-declared in `:root[data-theme="light"]`.

| Token    | Value | Meaning                                              |
|----------|-------|------------------------------------------------------|
| `--s1`   | 4px   | grid unit 1                                          |
| `--s2`   | 8px   | grid unit 2                                          |
| `--s3`   | 12px  | grid unit 3                                          |
| `--s4`   | 16px  | grid unit 4                                          |
| `--s5`   | 20px  | grid unit 5                                          |
| `--s6`   | 24px  | grid unit 6                                          |
| `--gut`  | 24px  | content-column horizontal gutter                     |
| `--sgut` | 16px  | sidebar-column horizontal gutter                     |
| `--ctl`  | 36px  | the one primary-control height                       |
| `--hd`   | 56px  | header height (both column headers)                  |
| `--r1`   | 6px   | control radius                                       |
| `--r2`   | 8px   | card / player radius                                 |

A third radius value — **4px** small-badge radius — is expressed via `--s1`
(4px) where a badge needs it; no separate `--r3` token is introduced (4px is
already the grid unit). The contract is twelve declared tokens plus the reuse of
`--s1` for small-badge radius.

## 2. The ten rules (binding)

These restate the prompt's intent as the spec's acceptance surface.

1. **Snap to the 4px grid.** Every padding, gap, size, and radius reads a token
   (or a token-derived multiple). No raw `10px`/`11px`/`14px`/`30px`/`34px`
   one-offs survive in the restyled surfaces — except the two **deliberate
   stated exceptions** in rule 7.
2. **One horizontal gutter per column, applied to every block in it, so column
   edges align.**
   - **Sidebar gutter = `--sgut` (16px)** on the column's full-width blocks
     (`.sidebar-head`, `.sidebar-search`, `.sidebar-list`), with **12px (`--s3`)
     inner insets** on the controls inside (`.cat-btn`, `.search-field`).
   - **Content gutter = `--gut` (24px)** on every content block
     (`.content-head`, `.player-wrap`, `.ch-section`, `.footer`), **16px
     (`--s4`) on mobile** (the existing `max-width: 760px` breakpoint — no new
     breakpoint is introduced).
3. **Control heights.** Primary controls are exactly **`--ctl` (36px)**: the
   footer inputs, the Connect/Disconnect buttons, the login-mode segmented
   control. **Secondary controls are 28px (`--s6` + `--s1`):** the format chips
   (`.fmt-chip`), the sort `<select>` (`.ch-sort`), and the card
   number/logo/star row affordances — including a real **28×28 star hit box**
   (`.ch-fav`).
4. **Two radii only.** **`--r1` (6px)** on controls (buttons, inputs, chips,
   select, icon buttons, segmented control); **`--r2` (8px)** on cards and the
   player (`.ch-card`, `.player-card`, `.acct-conn`); **4px (`--s1`)** on small
   badges (`.cat-count`, `.on-air-badge`, `.now-cat`).
5. **Both column headers exactly `--hd` (56px), padded to their column gutter,
   so their bottom borders form one continuous line.** `.sidebar-head` uses
   `--sgut`; `.content-head` uses `--gut`; both are `height: var(--hd)`.
6. **Content-column vertical rhythm.**
   - player wrapper padding `24px 24px 0` → `var(--s6) var(--s6) 0`.
   - grid section-bar (`.ch-bar`) padding `20px 0 12px` → `var(--s5) 0 var(--s3)`.
   - grid gap `12px` → `var(--s3)`.
   - card padding `12px` → `var(--s3)`.
   - footer padding `16px 24px` → `var(--s4) var(--gut)`.
7. **Category list.** `.sidebar-list` is a **flex column**, **gap 2px**, with
   **36px rows** (`.cat-btn` height `--ctl`) and **12px inner padding** (`--s3`).
   Count badges (`.cat-count`): **min-width 26px** and **padding `3px 5px`** —
   these two values are the **deliberate stated off-grid exceptions** and are
   applied verbatim, not snapped — plus **tabular numerals**
   (`font-variant-numeric: tabular-nums`). (The mobile sidebar stays a
   horizontal strip per the existing `max-width: 760px` rule; the gap-2px /
   36px-row / 12px-inset contract governs the desktop column.)
8. **Footer form.** `.footer-form` is a **flex row**, **align-items: flex-end**,
   **gap 12px** (`--s3`); each field stacks a **mono 10px uppercase label** with
   a **4px gap** (`--s1`) above a **36px input** (`--ctl`); the submit button is
   the same **36px** so the whole row shares one baseline.
9. **All numbers use the mono font with tabular numerals.** Every element whose
   content is numeric — channel number (`.ch-num`), count badges (`.cat-count`,
   `.ch-bar-count`) — uses `var(--font-mono)` with
   `font-variant-numeric: tabular-nums`.
10. **One global focus ring.** A single rule
    `:focus-visible { outline: 2px solid var(--acc); outline-offset: 1px }`
    replaces all per-component `:focus-visible` declarations. Per-component
    `:focus-visible` rules are removed (the global rule covers them); per-component
    `:focus` / `:focus-within` border-colour cues on inputs may remain as they
    are not outline rules.

## 3. Alignment acceptance (externally checkable)

- **Vertical gutter lines catch every block edge.** Within the content column,
  the left content-edge of `.content-head`, `.player-wrap`'s card,
  `.ch-section`, and `.footer` share the same x (24px from the column's left;
  16px on mobile). Within the sidebar, `.sidebar-head`, `.sidebar-search`, and
  `.sidebar-list` share the same x (16px from the sidebar's left).
- **Both headers form one bottom line.** `.sidebar-head` and `.content-head`
  have equal height (56px) and their bottom borders sit at the same y.
- **Controls in a row share height and baseline.** In the footer form, every
  `.field input` and the submit `.btn` measure 36px tall and their bottom edges
  align (the row is `align-items: flex-end`). The two format chips share 28px
  height and a common baseline.
- **Two radii only** across the restyled surfaces (6px controls, 8px cards/
  player, 4px small badges) — no stray radius values.
- **One focus outline.** Tabbing to any focusable control yields the identical
  `2px solid var(--acc)` outline with `1px` offset, from the single global rule.

## 4. Out of scope

- No new tokens for colour or typography (reuse ADR-0019 + existing fonts).
- No new screens, controls, behaviours, or state-machine phases.
- No new responsive breakpoint — the existing `max-width: 760px` is the only one.
- No change to JS, persistence, or any test of behaviour — only CSS layout/UI
  tests assert the new geometry.
- The off-grid badge values (min-width 26px, padding `3px 5px`) are intentional
  and are **not** to be "fixed" to the grid.

## 5. Demo

This run changes user-interactable visual layout across every primary surface,
so it carries a demo recording (`CORE_FLOW.md` §3 Demo recording): a Playwright
video-capture spec boots the running product, enters demo mode, navigates the
restyled surfaces (sidebar, header line-up, grid, player, footer) visibly
showing the aligned gutters and shared baselines, reverts the in-app runtime
state, and stops — writing the video to `test-results/`.
