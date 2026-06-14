---
id: TASK-0065
adr: ADR-0031
evolution: 19
status: pending
attempts: 0
depends_on: [TASK-0062, TASK-0064]
---

# TASK-0065 — Expandable per-channel schedule view

## Goal

Each guide-carrying channel card exposes a keyboard-focusable **expand control**
that toggles a per-channel schedule list (`window.IptvEpg.getSched(ch.id)`)
without ever starting playback. Expansion is purely presentational (an
`is-expanded` CSS class on the card — no state-machine phase, mirroring the
account/log panel open model). A channel with no loaded guide shows no expand
control.

## Acceptance criteria

- [ ] `mkCard` renders an expand control (a focusable `<button>`) **only when**
      `window.IptvEpg.has(ch.id)`, carrying `aria-expanded` (reflecting open
      state) and an accessible label (e.g. "Show guide for <name>").
- [ ] Clicking/activating the control toggles an `is-expanded` class on the card
      and toggles the schedule list's visibility (and `aria-hidden`); it is
      **purely presentational** — no `go()`/state-machine phase change, no new
      localStorage key.
- [ ] Activating the expand control does **not** start playback: the handler stops
      propagation so it never reaches the card's select/play handler
      (`onGridClick`). Clicking the card body (not the control) still plays.
- [ ] The expanded schedule renders `getSched(ch.id)` rows: each row shows the
      program's **local-time range** (start–stop), **title**, and optional
      category; the currently-airing program is visually marked.
- [ ] A card with no loaded guide exposes **no** expand control and renders as
      before.
- [ ] Schedule expansion handling lives in the event-delegated grid handler /
      `ui.js` render layer (consistent with `onGridClick` delegation); `app.css`
      styles the schedule list and `is-expanded` state from existing token layers.
- [ ] `ui.js`/`app.css` carry `ADR: ADR-0031`.

## Test requirements

- **Unit:** `src/tests/unit/epgui.test.js` — `mkCard` renders the expand control
  with correct `aria-expanded`/label only when a guide is present; schedule rows
  render time-range + title + category from `getSched`; the current program is
  marked; guide-less cards have no control. Run under `npx vitest run`.
- **UI:** `src/tests/ui/epg.test.js` — boot in demo mode, click a card's expand
  control: assert the schedule list appears (`is-expanded`, `aria-expanded=true`,
  visible rows) and that **playback did not start** (no PLAY phase / no active
  player) — proving the control is playback-safe; collapse again; assert clicking
  the card body still plays the channel.
- **Integration:** n/a — render reads the in-memory store; no external
  connectivity.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
