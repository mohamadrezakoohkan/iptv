---
id: ADR-0019
title: Light/dark theme via data-theme token override + sun/moon toggle (top-right)
date: 2026-06-12
evolution: 10
status: accepted
governs:
  - index.html
  - client/app.css
  - client/cfg.js
  - client/st.js
  - client/ui.js
  - client/main.js
  - tests/unit/theme.test.js
  - tests/ui/theme.test.js
---

# ADR-0019 — Light/dark theme via data-theme token override + sun/moon toggle (top-right)

## Context

E10 prompt: *"create a new feature to support switching between light and dark
mode themes; put the switch on top right corner with a toggle of sun vs moon
like switch."*

The app today is a single dark "broadcast console". Its colour system is
already a clean token layer: eight CSS custom properties on `:root` in
`client/app.css` (`--bg`, `--sur`, `--sur2`, `--ln`, `--tx`, `--dim`, `--acc`,
`--live`), and **every** rule reads those tokens rather than hardcoding colours
(the only literal colours are a handful of `rgba()` accents and `#000`/`#fff`
on the video element and error banner). This means the dark look is, in effect,
the dark theme already — adding a light theme is a matter of supplying a second
set of token values, not editing every rule.

Three sub-decisions the prompt forces:

1. **Mechanism** — how a theme is selected and applied.
2. **Default + persistence** — which theme a first-time visitor sees and how
   the choice survives reload (must align with ADR-0003's localStorage model
   and the `S.*Key` / `iptv_*` key pattern).
3. **Toggle placement** — the sun/moon control's position, which must coexist
   with the account button `#acct-btn` that ADR-0014 already mounts at the
   right edge of `.content-head`.

Constraints: CONVENTIONS.md (vanilla JS, flat state, `rnd*`/`on*`, single `EL`
registry, no inline styles, kebab-case ids, the shared non-module `window`
scope), ADR-0001 (no framework), and the recurring shared-window-scope
collision lesson (a top-level `const`/`let` reused across client files throws
at load).

## Decision

### Mechanism — `data-theme` attribute driving a token-override rule

The active theme is a `data-theme` attribute on the document root (`<html>`):

- `:root` keeps the **dark** token values (the current values, verbatim) — so
  the default theme renders correctly before any script runs, with no flash.
- A new rule `:root[data-theme="light"] { … }` in `client/app.css` re-defines
  the same eight colour tokens with light-mode values. Nothing else is
  re-styled; every existing rule recolours through the tokens automatically.
- `data-theme="dark"` (or the attribute being absent) = dark; `="light"` =
  light. Per Rule R-0001, `index.html` ships **without** a `data-theme`
  attribute on `<html>` (absent in source); script sets/removes it.

Switching a theme is therefore one DOM attribute write plus the toggle's visual
state — no new state-machine phase (presentational chrome, like the account
panel's `is-open` class, ADR-0014; CONVENTIONS §6 unaffected).

### Default + persistence

- **Default theme: dark.** A first-time visitor sees today's look unchanged.
- The choice persists in `localStorage` under key `iptv_theme`, declared as
  `S.themeKey` in `client/cfg.js` (matches the existing `iptv_*` keys /
  `S.*Key` naming, ADR-0003). Value: the plain string `"light"` or `"dark"`;
  any other value is treated as absent → dark default.
- `client/st.js` owns the read/write, alongside the other persistence helpers:
  a `loadTheme()` returning the stored token (or `"dark"`) and a writer that
  persists the chosen token. Theme is **not** added to the `ST` object — `ST`
  drives the phase machine; theme is chrome. (This keeps `ST` fully declared
  per CONVENTIONS §6 and avoids coupling theme to phase transitions.)

### Toggle placement — sun/moon switch, top-right, left of the account button

- A single control `#theme-toggle` mounts in `.content-head`, in the top-right
  cluster, **immediately before `#acct-btn`** in the DOM. The account button
  keeps its right-edge position (it uses `margin-left:auto`); the theme toggle
  is placed just before it so the two controls sit together at top-right. CSS
  ensures a small gap; the toggle does not displace or overlap the account
  button on either breakpoint.
- It is a **sun ↔ moon switch**: a sun glyph (light) and a moon glyph (dark),
  with the active theme's glyph emphasised via CSS class toggling (no inline
  styles, §10). Inline SVG glyphs (consistent with the account/idle SVGs in
  `index.html`).
- It is a keyboard-focusable two-state switch with an accessible name and the
  appropriate ARIA (`role="switch"` + `aria-checked`, or `aria-pressed`), and
  a focus ring consistent with the other `.content-head` controls.

### Rendering & handlers (`client/ui.js`)

- `EL` gains one field — `thm` (`#theme-toggle`) — declared once in the `EL`
  literal and set in `mkEL`, wired there with a `click` listener.
- `rndTheme(theme)` applies the theme: sets/removes `data-theme` on `<html>`,
  updates the toggle's sun/moon visual state and ARIA. Pure DOM write; no
  network, no phase.
- `onTheme()` toggles dark↔light: computes the next theme, applies it via
  `rndTheme`, and persists it via the `st.js` writer. One synchronous handler.
- Any new top-level binding (e.g. a `THEMES` list or theme-key constants) must
  carry a **unique name** not already declared in any other client file, to
  avoid the shared-`window`-scope "Identifier already declared" load error
  that only the full UI suite catches.

### Initialisation (`client/main.js`)

- In `onReady`, after `mkEL`, read the stored theme (`st.loadTheme()`) and call
  `rndTheme(theme)` so `<html>` and the toggle reflect the persisted choice
  before/independent of any connect flow. Existing init order is otherwise
  unchanged.

## Consequences

**Easier:**
- One token-override rule + one attribute = a full light theme; every existing
  styled element recolours for free.
- No new phase, no `ST` change, no framework — pure CONVENTIONS-compliant DOM.
- The choice is inspectable (`<html data-theme>` + `localStorage.iptv_theme`).

**Harder:**
- The light token values must be chosen for legible contrast (primary + dimmed
  text, accent, live) — a design step, validated visually in the UI suite.
- A handful of literal colours (`rgba()` accents, the error banner's `#fff`,
  video `#000`) are theme-agnostic by design; if any reads wrong in light mode
  it must be tokenised in the same task that introduces light values (no
  staged migration — the staged-migration lesson).
- The toggle and account button share the top-right; their layout must be
  verified together on both breakpoints.

**Ruled out:**
- A new state-machine phase for theme (it is presentational, §6).
- Auto-following the OS `prefers-color-scheme` (explicit user choice, per the
  project's "explicit not auto-detected" stance, ADR-0008) — deferrable to a
  future evolution.
- Editing every CSS rule to add a second colour (the token layer makes that
  unnecessary).
- Putting the toggle anywhere but the top-right (prompt is explicit).

## Tasks derived

- TASK-0037 — Theme key, persistence helpers, and light-theme token rule
  (cfg.js `S.themeKey`, st.js `loadTheme`/writer, app.css `[data-theme="light"]`)
- TASK-0038 — Sun/moon toggle markup + CSS in `.content-head` (left of account
  button), `EL.thm`, `rndTheme`, `onTheme`, wiring, and init in main.js

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0019` comment near the top
(native comment syntax; `index.html` via HTML comment, JSON-less). When a
change removes the last governed code, this ADR is marked `status: deleted` —
the file itself is never removed; it is history.
