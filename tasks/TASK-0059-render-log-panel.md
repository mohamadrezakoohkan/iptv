---
id: TASK-0059
adr: ADR-0028
evolution: 17
status: pending
attempts: 0
depends_on: [TASK-0058]
---

# TASK-0059 — Render the log panel + button badge from `IptvErrLog`; clear action; capture re-render

## Goal

After this task, the log button's count badge and the log panel's entry list
render the live `window.IptvErrLog` contents (ADR-0028): the badge shows the
failure count (hidden when zero), the panel lists entries newest-first (channel
name/number, failure detail, time), an empty log shows a calm placeholder, the
`#log-clear` button empties the log and re-renders, and a freshly captured
failure updates the badge and any open panel immediately.

## Acceptance criteria

- [ ] `rndLog()` in `src/client/ui.js` renders, from `window.IptvErrLog`:
      (a) `#log-count` showing `count()` and getting the "hidden" CSS class when
      `count() === 0`; (b) `#log-list` with one row per `list()` entry
      **newest-first**, each row showing the channel name (and number when
      present) as the primary line, the `detail` string as a dimmed secondary
      line, and the entry time; (c) a single empty-state placeholder ("No
      playback failures this session.") instead of rows when `count() === 0`.
      All entry text is HTML-escaped. `rndLog` is guarded to no-op when
      `window.IptvErrLog` is absent (test isolation).
- [ ] The badge number is part of the log button's accessible name (e.g. via
      `aria-label`/labelled text), not colour-only.
- [ ] `onLogClear()` calls `window.IptvErrLog.clear()` then `rndLog()`, leaving
      the panel showing the empty state and the badge hidden.
- [ ] The capture hook re-renders the log: `onEngErr` in `src/client/play.js`
      calls `window.IptvUi.rndLog()` (guarded, after `add`), so a new failure
      updates the badge and any open panel without a manual refresh.
- [ ] `rndLog()` is exported on `window.IptvUi` and is invoked on `mkEL`
      initialization so the badge/list are correct on load; `#log-clear` is
      wired to `onLogClear` in `mkEL`.

## Test requirements

- **Unit:** extend `src/tests/unit/logui.test.js` (jsdom) — with a stubbed
      `window.IptvErrLog`: empty log renders the placeholder and hides the
      badge; a log with entries renders rows newest-first with name/detail/time
      and shows the badge with the count; entry text containing HTML is escaped;
      `onLogClear` clears and re-renders to the empty state. Assert the
      capture→`rndLog` wiring (calling `onEngErr` with a stubbed `IptvUi.rndLog`
      invokes it). Per R-0001, assert only attribute states the baseline markup
      declares.
- **UI:** add to `src/tests/ui/log.test.js` (Playwright) — drive a playback
      failure (e.g. select a channel whose stream cannot play in the test
      harness, or inject one via the exposed `IptvErrLog`), open the log panel,
      and assert the badge count and a matching entry row appear; click Clear
      and assert the list returns to the empty state and the badge hides. (The
      committed demo recording is TASK-0060.)
- **Integration:** n/a — no external connectivity (renders local in-memory
      state; the UI test induces the failure without depending on a live stream).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
