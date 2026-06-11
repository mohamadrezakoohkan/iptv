---
id: TASK-0018
adr: ADR-0008
evolution: 4
status: pending
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

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
