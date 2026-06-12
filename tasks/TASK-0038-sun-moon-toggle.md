---
id: TASK-0038
adr: ADR-0019
evolution: 10
status: pending
attempts: 0
depends_on: [TASK-0037]
---

# TASK-0038 — Sun/moon theme toggle in the top-right

## Goal

Add the visible sun ↔ moon toggle control to the top-right of `.content-head`,
immediately left of the account button, wired to the TASK-0037 data layer.
After this task the user can click (or keyboard-activate) the toggle to switch
between dark and light themes; the active theme is applied to `<html>`,
persisted, restored on reload, and the sun/moon glyph reflects the current
theme — all while coexisting cleanly with the account button.

## Acceptance criteria

- [ ] `index.html` adds a single control `#theme-toggle` inside `.content-head`,
      placed in the DOM **immediately before `#acct-btn`**, containing inline
      sun and moon SVG glyphs. It is keyboard-focusable with an accessible name
      and two-state switch ARIA (`role="switch"` + `aria-checked`, or
      `aria-pressed`). `<html>` ships with **no** `data-theme` attribute (Rule
      R-0001 — absent in source; script sets it).
- [ ] `client/app.css` styles the toggle to match the other `.content-head`
      controls (size, border, focus ring, gap before the account button); a
      class on the toggle reflects the active theme so the sun is emphasised in
      light mode and the moon in dark mode. No inline styles. The account
      button keeps its right-edge position on both the desktop and `< 760px`
      breakpoints, with no overlap.
- [ ] `client/ui.js`: `EL` gains a `thm` field (declared once in the `EL`
      literal, set in `mkEL`). `rndTheme(theme)` sets/removes `data-theme` on
      `<html>` and updates the toggle's visual state + ARIA. `onTheme()`
      toggles dark↔light, applies via `rndTheme`, and persists via the
      TASK-0037 writer. The toggle is wired with a `click` listener in `mkEL`.
- [ ] `client/main.js` `onReady` reads the stored theme via `loadTheme()` and
      calls `rndTheme(theme)` after `mkEL`, so the persisted theme (and toggle
      state) is applied on load; existing init order is otherwise unchanged.
- [ ] Any new top-level binding has a unique name (no shared-window-scope
      collision); the FULL UI suite is run to confirm no "Identifier already
      declared" load error across the non-module client scripts.
- [ ] `index.html`, `client/app.css`, `client/ui.js`, `client/main.js` carry
      an `ADR: ADR-0019` comment in their existing ADR header line.

## Acceptance criteria (behaviour, UI-verified)

- [ ] The toggle is visible in the top-right corner of `.content-head`.
- [ ] Clicking it switches the theme and visibly changes page colours
      (background/surface/text differ before vs after).
- [ ] The sun/moon visual state reflects the current theme after each toggle.
- [ ] The choice persists across a page reload (reload shows the last-chosen
      theme, not the default).
- [ ] The toggle and the account button coexist in the top-right without
      overlap; clicking the toggle does not open the account panel and vice
      versa.

## Test requirements

- **Unit:** test `rndTheme(theme)` sets `data-theme="light"` on the root for
  `'light'` and removes it (or sets `'dark'`) for `'dark'`, and updates the
  toggle's state class / ARIA accordingly — using the JSDOM baseline of
  `index.html`. Per Rule R-0001: confirm the baseline root has no `data-theme`
  attribute before asserting it is added/removed; never assert restoration of
  an attribute that was never present. Test `onTheme()` flips the theme and
  calls the persistence writer with the new token.
- **UI (REQUIRED):** the toggle is visible top-right; clicking it switches
  theme and the computed page colours change; the sun/moon state reflects the
  active theme; the choice persists across a reload; the toggle coexists with
  the account button (both present, no overlap, independent activation). Run
  the **full** Playwright UI suite to confirm no cross-file
  global-scope load collision and no regression in the existing
  content-head / account UI tests.
- **Integration:** n/a — no external connectivity (theme is client-only).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
