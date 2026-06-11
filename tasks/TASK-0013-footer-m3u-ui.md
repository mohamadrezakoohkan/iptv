---
id: TASK-0013
adr: ADR-0005
evolution: 2
status: pending
attempts: 0
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

_Filled by implement-agent._
