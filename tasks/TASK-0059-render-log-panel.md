---
id: TASK-0059
adr: ADR-0028
evolution: 17
status: done
attempts: 1
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

**Production code was already in place** (delivered alongside the TASK-0058
shell on this branch): `src/client/ui.js`, `src/client/play.js`,
`src/index.html`, and `src/client/app.css` already implement every acceptance
criterion of this task. This task therefore only added the **tests** the
criteria demand; no production file was changed (verified each criterion against
the existing code first):

- `rndLog()` (ui.js): renders `#log-count` (text = `count()`, toggles the
  `is-empty` hidden CSS class at zero), folds the count into `#log-btn`'s
  `aria-label` (singular/plural, not colour-only), and renders `#log-list` as
  one `mkLogRow` per `IptvErrLog.list()` entry **newest-first** (name + zero-
  padded number, dimmed detail, local time) or the `.log-empty` placeholder
  ("No playback failures this session.") at zero. All entry text is HTML-escaped
  via `escHtml`; guarded to no-op when `window.IptvErrLog` is absent.
- `onLogClear()` (ui.js): `IptvErrLog.clear()` then `rndLog()`. Wired to
  `#log-clear` in `mkEL`, which also calls `rndLog()` on init.
- Capture→re-render mechanism: `onEngErr(msg)` in play.js calls
  `window.IptvUi.rndLog()` (guarded, immediately after `IptvErrLog.add(...)`)
  so a new failure updates the badge and any open panel live. The capture's
  failure-only semantics are unchanged.

**Tests added:**

- `src/tests/unit/logui.test.js` (+17 tests, 17→34): rndLog empty state
  (placeholder + hidden badge + zero accessible name), non-empty (count, visible
  badge, one row per entry, newest-first ordering, name/number/detail rendered,
  singular vs plural accessible name), HTML-escaping of name + detail, the
  IptvErrLog-absent guard, onLogClear (clears + re-renders to empty state, and
  via the wired `#log-clear` click), rndLog on `mkEL` init (empty and
  pre-populated), and the capture→rndLog wiring asserted end-to-end by executing
  the **real** st.js + errlog.js + play.js + ui.js in one synthetic window and
  inducing a fatal failure through `loadPlay` (no-HLS dead-end). Added `dataset`
  / `hidden` to the shared `mkEl` stub and `resolveSignal` to the `IptvEmpty`
  stub so the real play→rndPhase→rndPlayer path runs in the wiring test.
- `src/tests/ui/log.test.js` (+4 tests, 9→13, Playwright): empty state + hidden
  badge with no failures; a captured failure (induced via the exposed
  `IptvErrLog.add(mkEntry(...))` + `rndLog()`, the same path onEngErr uses — no
  live stream) shows the badge count and a matching entry row; multiple failures
  render newest-first with the count; Clear empties the list to the empty state
  and hides the badge.

**R-0001:** the only attribute assertions are on `#log-btn` `aria-expanded` /
`#log-panel` `aria-hidden` (shipped in index.html as `"false"`/`"true"`), the
`#log-count` `is-empty` class (shipped on the element in index.html line 67),
and the `aria-label` rndLog writes itself — no attribute is asserted that the
baseline markup does not declare.

**Traceability:** no change needed — ADR-0028 already lists all six governed
files in `governs:` (incl. both test files), and each already carries its
`ADR: ADR-0028` comment. No ADR decision content touched.

**Run the tests:** unit — `npx vitest run src/tests/unit/logui.test.js`
(34 pass) or full `npx vitest run` (657 pass); UI —
`npx playwright test src/tests/ui/log.test.js` (13 pass).
