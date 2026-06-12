---
status: current
---

# Theme — light / dark mode

> Feature spec for the user-toggleable light/dark theme. Behaviour only; the
> mechanism decision and its rationale live in ADR-0019.

## Purpose

The console ships as a dark "broadcast" surface. This feature lets the user
switch between the existing **dark** theme and a new **light** theme with a
single toggle, and remembers the choice across reloads. It is purely
presentational: no state-machine phase, no effect on channels, playback,
accounts, or persistence of other keys.

## 1. Themes

Two themes, identified by a token string:

| Theme   | `data-theme` value | Description                                  |
|---------|--------------------|----------------------------------------------|
| `dark`  | `"dark"`           | the existing broadcast console look (default)|
| `light` | `"light"`          | light surfaces, dark text — the new alternate |

- **Default is `dark`.** A first-time visitor (no stored choice) sees the
  current look unchanged.
- The dark theme reuses the existing `:root` design-token values verbatim
  (see `specs/iptv-player.md` §2). The light theme re-defines the same eight
  colour tokens — `--bg`, `--sur`, `--sur2`, `--ln`, `--tx`, `--dim`,
  `--acc`, `--live` — with light-mode values. Nothing outside those tokens is
  re-styled: every rule that already reads a token recolours automatically.

## 2. Applying a theme

- The active theme is expressed as a `data-theme` attribute on the document
  root element (`<html>`). `data-theme="dark"` (or its absence) yields the
  dark token values; `data-theme="light"` yields the light token values.
- The light token values live in a CSS rule selected by
  `:root[data-theme="light"]` in `client/app.css`, overriding the dark
  defaults declared on `:root`. The dark values stay on `:root` so the page
  renders correctly before any script runs (no flash for the default theme).
- `index.html` ships with no `data-theme` on `<html>` (baseline = dark — see
  Rule R-0001: the attribute is **absent** in source, then set by script).

## 3. Persistence

- The chosen theme persists in `localStorage` under the key `iptv_theme`
  (declared as `S.themeKey` in `client/cfg.js`, matching the `iptv_*` /
  `S.*Key` pattern of the other keys — see ADR-0003).
- Value schema: the plain string `"light"` or `"dark"`. Any other / unparseable
  value is treated as absent and falls back to the `dark` default.
- The read/write helpers live in `client/st.js` alongside the other persistence
  helpers: a `loadTheme()` that returns the stored token (or the `dark`
  default) and a writer that persists the chosen token. Theme is **not** an
  `ST` field driving a phase — it is presentational chrome, like the account
  panel's `is-open` class (ADR-0014).

## 4. Toggle control (top-right)

- A toggle control mounts in `.content-head` (the 56px bar above the player),
  in the **top-right corner**, immediately to the **left of the account
  button** (`#acct-btn`, ADR-0014). The account button keeps its right-edge
  position; the theme toggle sits just before it so both controls live in the
  top-right cluster.
- The control is a **sun ↔ moon switch**: a sun glyph represents the light
  theme and a moon glyph the dark theme. Its visual state reflects the active
  theme (e.g. the sun is emphasised in light mode, the moon in dark mode), via
  CSS class toggling — no inline styles (CONVENTIONS §10).
- It is a single keyboard-focusable control (`#theme-toggle`), with an
  accessible label, `role`/`aria` appropriate for a two-state switch
  (`aria-pressed` or `role="switch"` + `aria-checked`), and a visible focus
  ring consistent with the other `.content-head` controls.
- Clicking (or activating via keyboard) toggles between the two themes:
  updates `data-theme` on `<html>`, persists the new choice, and updates the
  control's sun/moon visual state — all in one synchronous handler, no phase
  transition.

## 5. Initialisation

- On page load (`client/main.js`, `onReady`), the stored theme is read and
  applied to `<html>` **before / independent of** any connect flow, and the
  toggle's initial visual state is rendered to match. Applying the default
  `dark` theme is a no-op visually (it equals the baseline `:root`).
- Theme initialisation must not interfere with the existing init order
  (`mkEL`, phase wiring, `loadSt`, `loadAccts`, auto-reconnect).

## 6. Accessibility & UX

- The toggle is reachable in the keyboard tab order, within the `.content-head`
  cluster, before the account button.
- Theme changes are instantaneous and do not move focus or scroll position.
- The light theme must keep text/background contrast legible for primary text
  (`--tx` on `--bg`/`--sur`) and dimmed text (`--dim`); the accent (`--acc`)
  and live (`--live`) tokens remain recognisable in both themes.
- Respects `prefers-reduced-motion` if any transition is added (consistent
  with the existing `.on-air-dot` rule).

## 7. Out of scope

- No automatic following of the OS `prefers-color-scheme` — the theme is an
  explicit user choice (consistent with this project's "explicit, not
  auto-detected" stance, ADR-0008). A future evolution may add OS-following.
- No per-account or server-synced theme; it is a single client-wide choice.
- No additional themes beyond light and dark.
