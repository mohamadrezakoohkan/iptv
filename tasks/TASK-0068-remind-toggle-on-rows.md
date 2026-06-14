---
id: TASK-0068
adr: ADR-0033
evolution: 20
status: pending
attempts: 0
depends_on: [TASK-0067]
---

# TASK-0068 — Remind toggle on each upcoming schedule row and on the NOW/NEXT line

## Goal

The EPG render in `src/client/ui.js` gains a keyboard-focusable Remind
`<button>` with `aria-pressed` on each upcoming schedule row and on the
NOW/NEXT line's NEXT part, plus an in-place `onGridClick` toggle handler that
calls `IptvRem.toggle` and never plays/expands the card. When done, a user can
mark and individually clear reminders directly on the EPG.

## Acceptance criteria

- [ ] `mkSchedRow` renders a Remind `<button>` only for an **upcoming** program
      (`start` in the future relative to render time); current/past rows render
      no toggle. The button carries `data-rem="<chId>|<start>"`, `aria-pressed`
      present in the baseline (`"true"` when a reminder is set, else `"false"`),
      and a state-flipping accessible label.
- [ ] `mkNowNext` renders the same Remind toggle on the NEXT part only (none on
      NOW, none when there is no `next`).
- [ ] `onGridClick` resolves `data-rem`, resolves the live `Prg` via the EPG
      store/selectors, calls `IptvRem.toggle(chId, prg)`, and updates the
      button's `aria-pressed` + accessible label **in place** (no full grid
      re-render), then `evt.stopPropagation()` so toggling neither selects/plays
      the channel nor toggles the schedule expansion.
- [ ] Toggling a set reminder clears it (the same button pressed again),
      reflected in `aria-pressed` flipping back to `"false"`.
- [ ] A guide-less card exposes no schedule and no toggle; when
      `window.IptvRem` is absent the row renders exactly as before (guarded).
- [ ] Styling for the toggle is added in `src/client/app.css` using ADR-0024
      spacing/sizing and ADR-0019 colour tokens; touched files carry
      `ADR: ADR-0033`.

## Test requirements

- **Unit:** `src/tests/unit/remui.test.js` — `mkSchedRow`/`mkNowNext` emit a
  Remind button with `data-rem`, baseline `aria-pressed="false"` for an unset
  upcoming program and `"true"` for a set one (with `IptvRem` stubbed); no
  button for a current/past program or a missing `next`; `onGridClick` routes a
  `data-rem` click to `IptvRem.toggle` and flips `aria-pressed`/label in place
  without re-render. Honor **R-0001**: assert `aria-pressed` is present in the
  rendered baseline before asserting the toggle mutates it (it is, per
  ADR-0033) — never assert an attribute is added that was never in the source.
- **UI:** `src/tests/ui/reminders.test.js` — on the demo fixture, expand a
  channel's guide, focus the Remind toggle (keyboard reachable), activate it,
  and assert `aria-pressed` flips to `"true"` and the channel did **not** start
  playing or collapse/expand unexpectedly; activate again and assert it clears
  (`aria-pressed="false"`). (This file is shared with TASK-0069/0071; this task
  covers the toggle-state portion.)
- **Integration:** n/a — no external connectivity (client render + localStorage).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
