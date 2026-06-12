---
id: TASK-0037
adr: ADR-0019
evolution: 10
status: done
attempts: 1
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

Files touched:

- `client/cfg.js` — added `S.themeKey: 'iptv_theme'` inside the frozen `S`
  object, after `sortKey`. `S` stays frozen; existing keys unchanged. Trued up
  the ADR header to add `ADR-0019`.
- `client/st.js` — added the theme token constants `THMS = ['light','dark']`
  and `THM_DEF = 'dark'` (uniquely named to avoid a shared-window-scope
  "Identifier already declared" collision — they are NOT `SORTS`/`SRTS`-style
  clashes with any other client file). Added `loadTheme()` (returns the stored
  token only when it is exactly `'light'`/`'dark'`, else the `'dark'` default;
  guarded so localStorage exceptions return `'dark'` without throwing) and
  `saveTheme(thm)` (persists `String(thm)` to `S.themeKey`, exception-guarded
  like the other writers). Both added to the `window.IptvSt` public API. Trued
  up the ADR header to add `ADR-0019`. Theme is deliberately NOT an `ST` field
  (it is presentational chrome, ADR-0019 / CONVENTIONS §6 unaffected).
- `client/app.css` — added the `:root[data-theme="light"]` rule re-defining all
  eight colour tokens (`--bg --sur --sur2 --ln --tx --dim --acc --live`) with
  light-mode values; the dark `:root` defaults are unchanged. Trued up the ADR
  header to add `ADR-0019`.
- `tests/unit/theme.test.js` — new. 19 tests: `S.themeKey` value + frozen + key
  preservation; `loadTheme()` light/dark/absent/empty/garbage/non-matching +
  no-throw-on-exception; `saveTheme()` write + round-trip + no-throw + API
  exposure; the light CSS rule exists and re-defines all eight tokens while the
  dark `:root --bg` stays `#0E1216`.
- `tests/ui/theme.test.js` — new. 5 tests: baseline `<html>` has NO `data-theme`
  (Rule R-0001 verified, not assumed); default bg is the dark token; setting
  `data-theme="light"` changes computed bg/surface/text and yields the light
  `--bg`; removing the attribute reverts to dark; `data-theme="dark"` equals the
  no-attribute baseline.

Non-obvious notes for reviewers / TASK-0038:

- No `governs:` change was needed: ADR-0019 already listed all touched/created
  paths (cfg.js, st.js, app.css, the two test files; ui.js + main.js belong to
  TASK-0038).
- The remaining literal colours in `app.css` (the `rgba()` accents derived from
  `--acc`/`--live`, video `#000`, error-banner `#fff`, status-dot greens,
  `.btn-primary { color:#0E1216 }`, spinner `#0E1216`) are theme-agnostic by
  design (ADR-0019 consequences): they read as accent-relative / contrast chrome
  and remain legible under the light palette, so none were tokenised in this
  task.
- The light palette values were chosen for legible contrast (dark `--tx`
  `#1A2129` on light `--bg`/`--sur`; dimmed `--dim` `#5C6975`; a darker accent
  `#C97614` and live `#D32F35` so both stay readable on light surfaces). Final
  visual legibility is exercised by the UI suite and re-checked once the toggle
  ships in TASK-0038.
