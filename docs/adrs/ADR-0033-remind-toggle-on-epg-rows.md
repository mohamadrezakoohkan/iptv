---
id: ADR-0033
title: Render the Remind toggle as a keyboard-focusable aria-pressed button on each upcoming EPG schedule row and on the NOW/NEXT line, reusing the existing EPG render
date: 2026-06-15
evolution: 20
status: accepted
governs:
  - src/client/ui.js
  - src/client/app.css
  - src/tests/unit/remui.test.js
  - src/tests/ui/reminders.test.js
  - src/tests/ui/reminders-demo.test.js
---

# ADR-0033 — Render the Remind toggle as a keyboard-focusable aria-pressed button on each upcoming EPG schedule row and on the NOW/NEXT line, reusing the existing EPG render

## Context

E20 prompt: a keyboard-focusable **"Remind" toggle on each row of the
expandable per-channel schedule (and on the NOW/NEXT line)** lets the user mark
an upcoming program; the toggle **reflects state with `aria-pressed`** and
reminders can be **cleared individually**. ADR-0032 supplies the persisted
store (`window.IptvRem`); this ADR decides the **render surface and toggle
behavior**.

Two existing EPG render points are reused (ADR-0031, `docs/specs/epg.md`
§4–§5, `src/client/ui.js`):

- **`mkSchedRow`** builds each schedule-row `<li>`; the expandable schedule is
  built by `mkSched`.
- **`mkNowNext`** / `mkNnRow` build the NOW/NEXT line.

Two existing patterns constrain the toggle:

- **The fav star toggle.** `mkFav` renders a focusable role=button star with an
  on/off class and a state-flipping `aria-label`; `toggleFav` mutates it **in
  place** (no full re-render) and `onGridClick` stops propagation so toggling
  the star never plays the channel. The Remind toggle follows the same posture,
  using `aria-pressed` as its state attribute.
- **Click isolation in `onGridClick`.** The expand control (`data-exp`) and fav
  star (`data-fav`) are resolved by closest-match and call
  `evt.stopPropagation()` so they never bubble to the card's select/play
  handler. The Remind toggle (`data-rem`) joins that list.

## Decision

Render the Remind toggle entirely within the existing EPG render in
`src/client/ui.js` (+ `src/client/app.css`), reading `window.IptvRem` at render
time (guarded for test isolation), with no new state phase, no new boolean
control flag.

### On the schedule row

`mkSchedRow` appends a keyboard-focusable Remind `<button>` for an **upcoming**
program only (program `start` in the future relative to render time):

- `data-rem="<chId>|<start>"` carrying the program identity (ADR-0032 `key`),
- `aria-pressed` — present in the baseline HTML, rendered `"true"` when a
  reminder is already set for that `chId`+`start`, else `"false"`. Per **Rule
  R-0001**, `aria-pressed` is part of the rendered baseline, so a test
  asserting the toggle flips it is asserting a mutation of an attribute that
  exists in source — never asserting an attribute added that was never present,
- an accessible label that flips with state ("Remind me when … starts" /
  "Clear reminder for …").

A current/past program row renders no toggle.

### On the NOW/NEXT line

`mkNowNext` adds the same Remind toggle to the **NEXT** part (the upcoming
program) only; the NOW part (already airing) carries none, and no toggle is
rendered when there is no `next`.

### Toggle behavior

A click-delegated handler in `onGridClick` resolves `data-rem`, calls
`IptvRem.toggle(chId, prg)` (add/remove, persists — ADR-0032), and updates the
button's `aria-pressed` + accessible label **in place** (mirroring
`toggleFav`), stopping propagation so toggling never selects/plays the channel
and never toggles the schedule expansion. Clearing one reminder is the same
toggle pressed again in its set state.

A guide-less card exposes no schedule and therefore no toggles; when
`window.IptvRem` is absent the row renders exactly as today. Full behavior is
specified in `docs/specs/reminders.md` §3–§4, §8.

## Consequences

**Easier:**
- Reuses `mkSchedRow`/`mkNowNext`/the grid and the proven fav-toggle
  in-place-update + propagation-stop model — no new layout region, no new
  phase, no new storage key beyond ADR-0032's.
- `aria-pressed` is a standard toggle-state attribute; the baseline-present
  posture satisfies R-0001 cleanly.

**Harder:**
- The card now carries a third interactive control (expand, fav, remind); the
  `onGridClick` resolution order and propagation stops must keep all three
  cleanly separated (UI test must prove toggling remind neither plays nor
  expands).
- The grid re-renders when guides arrive (ADR-0030/ADR-0031 async); render
  reads `IptvRem` so toggle state survives a re-render.

**Ruled out:**
- A separate reminders list/page (the prompt scopes the toggle to the existing
  EPG rows + now/next line).
- A state-machine phase for toggle state (CONVENTIONS §6 — it is presentational
  like the fav star and expand control).

## Tasks derived

- TASK-0068 — Remind toggle on each upcoming schedule row + on the NOW/NEXT
  line (`mkSchedRow`/`mkSched`/`mkNowNext`), `aria-pressed` baseline, styling,
  and the in-place `onGridClick` toggle handler (propagation-safe).

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0033` comment near the top.
When a change removes the last governed code, this ADR is marked `status:
deleted` — the file itself is never removed; it is history.
