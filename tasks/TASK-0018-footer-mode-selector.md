---
id: TASK-0018
adr: ADR-0008
evolution: 4
status: done
attempts: 0
depends_on: [TASK-0017]
---

# TASK-0018 — Footer login-mode selector UI (markup, CSS, handlers, hint text)

## Goal

The footer login form contains an explicit two-option mode selector —
"Username & Password" (`xtream`, default) and "Playlist URL only" (`m3u`) —
that alone controls whether the credential fields are shown and which mode
`connect()` is called with. URL-input auto-detection in the UI is gone:
`updM3u` is removed, `onUrlInput` only manages the Connect button, and
typing any URL never changes the visible fields.

## Acceptance criteria

- [ ] `index.html` `#footer-login` contains a keyboard-accessible
      two-option selector (`#login-mode`, options `#mode-xtream` labelled
      "Username & Password" and `#mode-m3u` labelled "Playlist URL only"),
      default `xtream`; styled as a segmented control in `app.css` with the
      active option visually distinct (uses `--acc` like other active
      states).
- [ ] Selecting `m3u` adds `is-m3u` to `#footer-login` (hides
      `.field-user`/`.field-pass` via the existing CSS rule) and sets the
      hint to `Paste an .m3u / .m3u8 playlist URL — no login needed.`;
      selecting `xtream` removes the class and restores
      `Type "demo" to try a sample playlist.`
- [ ] Typing `https://example.com/list.m3u8` in the URL field while in
      `xtream` mode does NOT hide the credential fields or change the hint;
      `updM3u` and its call from `onUrlInput` are removed from
      `client/ui.js`.
- [ ] Submitting Connect calls `IptvApi.connect(src, { user, pass,
      m3u: <selected mode === 'm3u'> })` — verified for both modes.
- [ ] Connecting with URL `demo` succeeds in both modes (footer reaches the
      connected state).
- [ ] New/changed files carry `ADR: ADR-0008`; obsolete auto-detect cases in
      `tests/unit/m3u-ui.test.js` and `tests/ui/m3u-ui.test.js` are
      rewritten for toggle-driven behavior; ADR-0008 `governs:` trued up.

## Test requirements

- **Unit:** `onMode`/`rndMode` behavior — default mode `xtream`; class +
  hint toggling per mode; `runConn` passes the correct `m3u` flag for each
  mode; URL input no longer toggles class/hint. Heed **R-0001**: the
  baseline `#f-user`/`#f-pass` inputs carry NO `required` attribute — never
  assert an attribute is added back that the source HTML does not have.
- **UI:** Playwright — selector visible with `xtream` active by default;
  credential fields visible by default; clicking "Playlist URL only" hides
  them and swaps the hint; clicking back restores them; typing a `.m3u8`
  URL in `xtream` mode leaves fields visible (no auto-detect); `demo`
  connect succeeds in both modes; selector operable via keyboard.
- **Integration:** n/a — no external connectivity change (full integration
  suite still runs as the regression gate).

## Implementation notes

Files touched:

- `index.html` — added `#login-mode` radiogroup (`.field.field-mode`) as the
  first item of `#login-form`: two native radios `#mode-xtream` (checked) and
  `#mode-m3u` wrapped in `.mode-opt` labels. Baseline hint text corrected to
  the canonical `Type "demo" to try a sample playlist.` so the default DOM
  equals the rendered xtream state. ADR comment updated (+ADR-0008).
- `client/app.css` — segmented-control styles (`.login-mode`, `.mode-opt`,
  `.mode-txt`): radios are absolutely positioned with `opacity: 0` over the
  label (native keyboard/arrow-key semantics preserved; the input itself
  receives clicks); checked option gets `--acc` text + amber tint background;
  `:focus-visible` draws an `--acc` outline. ADR comment updated.
- `client/ui.js` — `updM3u` deleted; added `getMode()` (pure, reads
  `EL.mm3u.checked`), `rndMode()` (toggles `is-m3u` on `#footer-login` +
  swaps hint via `HINT_XTR`/`HINT_M3U` constants), `onMode()` (change
  handler, delegated on the `#login-mode` container — radio `change` events
  bubble). `onUrlInput` now only manages the Connect button. `runConn`
  passes `m3u: getMode() === 'm3u'` to `IptvApi.connect`. New EL entries
  `mode`/`mxt`/`mm3u`. Exports gained `rndMode` + `getMode`. ADR comment:
  ADR-0005 replaced by ADR-0008.
- `tests/unit/m3u-ui.test.js` — rewritten for toggle-driven behavior
  (13 tests): default mode, onMode class+hint toggling both ways, runConn
  m3u flag for both modes (+demo), no-auto-detect on URL input, updM3u
  absence. No `required`-attribute assertions (R-0001).
- `tests/ui/m3u-ui.test.js` — rewritten (8 Playwright tests): default
  selector state, default field visibility, hide/restore on mode switch,
  hint swap, `.m3u8` URL in xtream mode leaves fields visible, demo connect
  in both modes, arrow-key keyboard operation.
- `tests/unit/foot.test.js` — connect-args assertion updated to include
  `m3u: false` (runConn's call shape changed); ADR comment +ADR-0008.
- `tests/ui/m3u.test.js` — now checks `#mode-m3u` before connecting (the
  heuristic fallback no longer triggers from the UI since runConn always
  passes an explicit boolean); ADR comment ADR-0005 → ADR-0008.
- `adrs/ADR-0008-explicit-login-mode.md` — `governs:` trued up with
  `tests/unit/foot.test.js`.

Non-obvious:

- No `main.js` change: stored-creds reconnect still omits `m3u` (engine
  heuristic fallback covers it transitionally) — that is TASK-0019's scope,
  as is persisting the mode in `iptv_creds` (`onOk` still stores
  `{ url, user, pass }`).
- Default state needs no init render: baseline HTML (xtream checked, no
  `is-m3u`, xtream hint) already equals `rndMode()`'s xtream output.

Suites at hand-off: unit 214/214, UI 69/69, integration 10/10 — all green.
