---
id: TASK-0013
adr: ADR-0005
evolution: 2
status: done
attempts: 3
depends_on: [TASK-0011]
---

# TASK-0013 — Footer UI adaptation — hide username/password when URL is M3U

## Goal

The footer login form dynamically shows or hides the Username and Password
fields based on whether the Portal URL looks like an M3U URL.

When the user types a value into the Portal URL `<input>` whose pathname ends
with `.m3u` or `.m3u8` (case-insensitive), the Username and Password fields
are hidden and their `required` attribute is removed, and the hint text
updates to `"M3U URL detected — username and password not needed."`.

When the Portal URL does not look like an M3U URL, the fields are visible,
`required` is restored, and the hint text reverts to
`"Type 'demo' to try a sample playlist."`.

This adaptation is driven by `isM3u()` (from TASK-0011) called in a new
`onUrlInp` event handler in `client/ui.js` wired to the `input` event of the
Portal URL field.

## Acceptance criteria

- [ ] Typing `https://example.com/list.m3u` into the Portal URL field causes
      the Username and Password inputs to disappear from view.
- [ ] Typing `https://example.com/list.M3U8` (uppercase) also hides the
      fields.
- [ ] Clearing the URL field (back to empty) restores the Username and
      Password fields.
- [ ] Typing `http://portal.example.com` (no extension, no credentials
      already entered) hides the fields.
- [ ] Typing a non-M3U URL with Username and Password pre-filled shows the
      fields as expected.
- [ ] When fields are hidden, clicking Connect does not fail due to
      empty/missing username and password values (`required` attribute is
      absent).
- [ ] Hint text is `"M3U URL detected — username and password not needed."`
      in M3U mode and `"Type 'demo' to try a sample playlist."` otherwise.
- [ ] CSS class toggling (not inline styles) controls visibility — a class
      `is-m3u` on the footer element with `.is-m3u .field-user, .is-m3u
      .field-pass { display: none }` in `client/app.css` (or equivalent).

## Test requirements

- **Unit:** unit-test `onUrlInp` in isolation using JSDOM or equivalent —
  verify that the correct DOM mutations (class added/removed, `required`
  toggled, hint text updated) occur for M3U vs non-M3U URL inputs.
- **UI:** Playwright test: load app, type `https://example.com/test.m3u`
  into the Portal URL field, assert Username and Password fields are not
  visible. Type `http://portal.example.com/api` (non-M3U), assert they become
  visible again.

## Implementation notes

### Files changed

- `client/app.css` — added `.footer-login.is-m3u .field-user, .footer-login.is-m3u .field-pass { display: none; }` rule; updated ADR comment to include ADR-0005.
- `client/ui.js` — added `updM3u(url)` function (lines 284-298); extended `onUrlInput` to call `updM3u(EL.url.value.trim())`; updated ADR comment to include ADR-0005.
- `index.html` — added `field-user` class to the username `<div class="field">` wrapper and `field-pass` class to the password `<div class="field">` wrapper; updated ADR comment to include ADR-0005.
- `adrs/ADR-0005-m3u-playlist-support.md` — trued up `governs:` to add `client/app.css`, `index.html`, `tests/unit/m3u-ui.test.js`, `tests/ui/m3u-ui.test.js`.

### Tests added

- `tests/unit/m3u-ui.test.js` — 11 unit tests covering `updM3u` via the `onUrlInput` handler: M3U extension URLs add class and remove `required`; empty string and "demo" keyword remove class and restore `required`; hint text switches correctly for both cases.
- `tests/ui/m3u-ui.test.js` — 5 Playwright tests covering the full in-browser behavior: `.m3u` URL hides fields; clearing URL restores fields; hint text updates correctly; plain `http://` URL (no credentials) also hides fields per the `isM3u` heuristic.

### Non-obvious decisions

The task instructions specified the UI test should assert fields become visible after typing `http://portal.example.com/api`. However, `isM3u('http://portal.example.com/api', '', '')` returns `true` per the ADR-0005 heuristic (plain http URL with no credentials = M3U). The acceptance criteria themselves confirm this: "Typing `http://portal.example.com` (no extension, no credentials already entered) hides the fields." The UI test was therefore adjusted to use an empty URL string to demonstrate field restoration — which is consistent with the acceptance criterion "Clearing the URL field (back to empty) restores the Username and Password fields." An additional test documents that plain portal URLs with no credentials also hide fields, matching the ADR decision.
