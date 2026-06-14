---
status: current
---

# Playback Failure Log

## Purpose

When the user selects a channel and the attempt to **play** it fails (the
stream engine reports a fatal error), the console records that failure in a
**session failure log**. Only failures are logged — a channel that plays
successfully never produces a log entry. A new **log button** sits beside the
existing account button in the top bar; clicking it reveals the recorded
failures so the user can see, at a glance, which channels would not play and
why.

This is a diagnostic surface, not a stored history: the log lives in memory for
the current session only (see ADR-0027) and is gone on reload. It reuses the
app's existing single fatal-error choke point (`onEngErr` in `client/play.js`,
the same path ADR-0023 renders the in-card "This channel won't play"
placeholder from) so successes are structurally impossible to log, and it
mirrors the existing account-button + slide-in-panel affordance (ADR-0014) so
the new control feels native.

The two decisions this spec describes:

- **Capture model** (ADR-0027) — what is logged, when, and where it lives.
- **Log button + panel UI** (ADR-0028) — the top-bar button beside the account
  button and the slide-in panel that surfaces the log.

---

## 1. What is logged (capture model)

A failure entry is recorded **only** at the single fatal-playback choke point
`onEngErr(msg)` in `client/play.js`. Every fatal engine failure already funnels
through it — fatal hls.js errors (`onHlsErr`), mpegts.js errors (`onTsErr`),
and the "not supported" dead-ends in `runHls`. There is no success path that
reaches `onEngErr`, so "only failures are logged" holds structurally, with no
parallel error path to keep in sync.

Each entry captures the channel that failed (read from `IptvSt.ST.cur`, the
current channel at the moment of failure) plus the raw engine detail string:

```
/** @typedef {{ at:number, name:string, num:(number|null), url:string, detail:string }} ErrEntry
 *  at     — Date.now() when the failure was recorded
 *  name   — failed channel's display name (ST.cur.name; "Unknown channel" when absent)
 *  num    — failed channel's number (ST.cur.num) or null
 *  url    — failed channel's stream url (ST.cur.url) or ''
 *  detail — the engine failure detail string passed to onEngErr (the raw token)
 */
```

The log is held by a small, self-contained client module `client/errlog.js`
exposing `window.IptvErrLog`:

- `add(entry)` — append one `ErrEntry`, newest-last, capping the log at a fixed
  maximum (50) by dropping the oldest, so a long session cannot grow unbounded.
- `list()` — return the entries **newest-first** as a fresh array copy (callers
  never mutate internal state).
- `count()` — number of entries currently held.
- `clear()` — empty the log.
- `mkEntry(cur, detail)` — pure builder: turn the current channel (`ST.cur`,
  possibly `null`/partial) plus a detail string into a normalized `ErrEntry`,
  stamping `at = Date.now()`.

The capture call is guarded (`if (window.IptvErrLog) …`) so `play.js` still
works when the log module is absent (test isolation), mirroring the existing
guarded `window.IptvUi` / `updChip` calls. `errlog.js` loads in `index.html`
**before** `play.js` (which writes it) and before `ui.js` (which reads it).

The log is **in-memory, session-scoped** — never persisted to localStorage and
never coupled to the account store. It is a live diagnostic for the current
session.

---

## 2. Log button (top bar)

A new **log button** (`#log-btn`) mounts in `.content-head`, **immediately
beside the account button** (`#acct-btn`) — placed just before it so the two
controls sit together at the right edge, the log button first, the account
button last (it keeps `margin-left:auto`). The log button:

- is keyboard-focusable, with `aria-haspopup="dialog"`,
  `aria-controls="log-panel"`, and `aria-expanded` reflecting panel state;
- carries a glyph (e.g. a list/log icon) and an accessible label ("Log");
- shows a small **count badge** when the log is non-empty (the number of
  recorded failures); the badge is hidden when the count is zero;
- toggles the log panel when clicked.

It mirrors the account button's affordance, sizing, focus ring, and the same
content-head placement convention (CONVENTIONS: handlers `on*`, ids
kebab-case, no inline styles — visual state via CSS class toggling).

---

## 3. Log panel (slide-in)

A new `#log-panel` aside, structurally parallel to the account panel
(ADR-0014): fixed to a screen edge, full height, ~320px wide, `--sur`
background, a border on the inner edge, `z-index` above content, **off-screen
by default**, sliding in via a `transform: translateX` transition driven solely
by an `is-open` class (no inline styles). A dimmed `#log-scrim` overlay sits
behind it; both a scrim click and an in-panel close button (`#log-close`) close
the panel, as does Escape. The panel is `role="dialog"`,
`aria-label="Playback failure log"`, with `aria-hidden` toggled with `is-open`.

Panel contents (top to bottom):

1. **Header row** — "Playback log" title + a close button (`#log-close`) and a
   **Clear** button (`#log-clear`) that empties the log (calls
   `IptvErrLog.clear()`) and re-renders.
2. **Entry list** (`#log-list`) — one row per entry, **newest-first**
   (`IptvErrLog.list()`), each row showing: the channel name (and number when
   present), the failure detail string, and a relative/absolute timestamp of
   when it failed. Long names/urls truncate; the detail is the secondary line.
3. **Empty state** — when the log is empty, the list shows a single calm
   placeholder line ("No playback failures this session.") instead of rows.

Rendering follows the account-panel pattern: a `rndLog()` function renders the
button's count badge, the entry rows, and the empty state from
`IptvErrLog`, and is called after every capture (a failure was just added) and
after `clear()`. Opening/closing the panel is a single `is-open` class toggle
on `#log-panel` + `#log-scrim` plus the button's `aria-expanded` — no new
state-machine phase and no boolean control-flow flag (CONVENTIONS §6: phases
stay INIT/LOAD/READY/PLAY/SRCH/ERR; panel visibility is presentational).

Opening the log panel and the account panel are independent; opening one does
not force the other closed (each is its own presentational toggle), matching
how the account panel behaves today.

### Responsive

On the mobile breakpoint (`< 760px`) the log panel becomes full-width
(`width: 100%`), like the account panel; the log button stays in
`.content-head`.

---

## 4. Accessibility

- The log button has a discernible accessible name and reflects panel state via
  `aria-expanded`; the count badge is exposed to assistive tech (e.g. its
  number is part of the button's accessible name, or labelled), never colour-only.
- The panel is a labelled `role="dialog"`; the entry list is announced; icons
  are decorative (`aria-hidden="true"`).
- The button, close, and clear controls are keyboard-focusable and operable,
  and Escape closes the panel when open — consistent with the account panel and
  `docs/specs/iptv-player.md` §12.

---

## 5. Out of scope

- Persisting the log across sessions or coupling it to the account store
  (ADR-0027: in-memory, session-scoped only).
- Logging anything other than fatal playback failures (no success events, no
  non-playback errors, no connection/parse failures — only the `onEngErr`
  choke point).
- A new state-machine phase for the log or its panel (CONVENTIONS §6: panel
  visibility is presentational).
- Redesigning the account button/panel, footer, sidebar, or surrounding layout
  beyond adding the log button beside the account button.
