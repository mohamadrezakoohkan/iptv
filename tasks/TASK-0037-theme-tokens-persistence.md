---
id: TASK-0037
adr: ADR-0019
evolution: 10
status: pending
attempts: 0
depends_on: []
---

# TASK-0037 — Theme key, persistence helpers, and light-theme token rule

## Goal

Establish the theme data layer with no UI yet: a persisted theme key, the
load/save helpers in `st.js`, and the light-theme CSS token override. After
this task, setting `data-theme="light"` on `<html>` (manually, in the console)
recolours the whole app to a legible light palette, and a stored
`iptv_theme` value round-trips through the helpers — but there is no visible
control yet (TASK-0038 adds it).

## Acceptance criteria

- [ ] `client/cfg.js` declares `S.themeKey: 'iptv_theme'` inside the frozen `S`
      object (matching the existing `iptv_*` / `S.*Key` pattern); `S` stays
      frozen and the existing keys are unchanged.
- [ ] `client/st.js` exposes a `loadTheme()` that returns `'light'` when
      `localStorage['iptv_theme']` is exactly `'light'`, returns `'dark'` when
      it is `'dark'`, and returns the default `'dark'` for any absent, empty,
      or unrecognised value (and never throws when localStorage access throws).
- [ ] `client/st.js` exposes a writer that persists a given theme token to
      `S.themeKey` (string value), guarded against localStorage exceptions, and
      both helpers are added to the `window.IptvSt` public API.
- [ ] Any new top-level binding introduced (e.g. a themes list or token
      constants) has a unique name not already declared in any other client
      file (no shared-window-scope collision).
- [ ] `client/app.css` adds a `:root[data-theme="light"]` rule that re-defines
      all eight colour tokens (`--bg`, `--sur`, `--sur2`, `--ln`, `--tx`,
      `--dim`, `--acc`, `--live`) with light-mode values; the existing `:root`
      dark values are unchanged. If any theme-agnostic literal colour reads
      wrong under the light palette, it is tokenised in this same task.
- [ ] `client/app.css` and `client/cfg.js` and `client/st.js` carry an
      `ADR: ADR-0019` comment in their existing ADR header line.

## Test requirements

- **Unit:** test `loadTheme()` returns `'light'`/`'dark'` for the matching
  stored values, `'dark'` for absent/empty/garbage/non-string values, and does
  not throw when localStorage throws; test the writer persists the token under
  `iptv_theme`. Test `cfg.js` exposes `S.themeKey === 'iptv_theme'` and that
  `S` remains frozen. Mock/stub localStorage as the existing `persist.test.js`
  / `st.test.js` do.
- **UI:** assert the light-theme CSS rule takes effect — with
  `data-theme="light"` set on `<html>`, the computed page background / surface
  / text colours differ from the dark baseline (i.e. the token override
  applies). Per Rule R-0001: the baseline `<html>` has **no** `data-theme`
  attribute — verify that, then verify the attribute drives the recolour; do
  not assert an attribute that was never in the source. (Full toggle-click
  behaviour is TASK-0038.)
- **Integration:** n/a — no external connectivity (theme is client-only,
  localStorage + CSS).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
