---
id: TASK-0065
adr: ADR-0031
evolution: 19
status: done
attempts: 1
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

Files touched:

- `src/client/ui.js` — added the schedule render + toggle layer (ADR: ADR-0031
  comment already present from TASK-0064):
  - `fmtPrgTime(ts)` — pure local-time clock string (`HH:MM`) for a unix-ms
    program timestamp; '' for an invalid stamp (mirrors `fmtLogTime`).
  - `mkSchedRow({ prg, now })` — one `<li class="ch-sched-row">` with a local
    `start–stop` range, escaped title, optional escaped category, and the
    `ch-sched-cur` marker class when `start <= now < stop`.
  - `mkSched(ch)` — the focusable `<button class="ch-exp" data-exp="<id>"
    aria-expanded="false" aria-label="Show guide for <name>">` plus the
    `<ul class="ch-sched" aria-hidden="true">` of `getSched(ch.id)` rows.
    Returns `''` when the schedule is empty (no expand affordance), so a
    guide-less card is unchanged. Baseline `aria-expanded` is `"false"` in the
    source markup (R-0001 — the attribute is always present; the toggle flips it,
    never adds it back from nothing).
  - `mkCard(ch)` now appends `mkSched(ch)` (guarded by the same
    `window.IptvEpg && has(ch.id)` check that guards the now/next line).
  - `toggleSched(btn)` — presentational toggle: flips the card's `is-expanded`
    class, the control's `aria-expanded`, and the list's `aria-hidden`, reading
    the live DOM state (no ST phase, no boolean flag, no storage key — mirrors
    `setAcct`/`setLog`).
  - `onGridClick` intercepts `[data-exp]` **before** the `[data-id]` card
    resolution, calls `evt.stopPropagation()`, and toggles — so activating the
    control never reaches the card's select/play path.
  - `onGridKey` skips `[data-exp]` targets: the `<button>` fires its own native
    click on Enter/Space (handled by `onGridClick`), so routing the keydown too
    would double-toggle.
  - `mkSched` + `toggleSched` exported on `window.IptvUi`.
- `src/client/app.css` — `.ch-exp` control, `.ch-sched` list (`display:none`
  collapsed → `display:flex` under `.ch-card.is-expanded`), `.ch-sched-row`
  (+ `.ch-sched-cur` current marker), `.ch-sched-time`/`-meta`/`-title`/`-cat`.
  All on existing ADR-0024 spacing/radius and ADR-0019 colour tokens; ADR comment
  already present from TASK-0064.
- `src/tests/unit/epgui.test.js` — extended `loadUi` with a `getSched` selector
  (driven by a `sched` Prg[] per channel) and added 13 unit tests covering the
  expand control presence/absence (guide / no guide / empty schedule / module
  absent), `aria-expanded="false"` baseline + label, the schedule rows
  (time range + title + optional category), the current-program marker
  (pinned `Date.now`), and HTML escaping.
- `src/tests/ui/epg.test.js` — 2 Playwright tests: the expand control toggles
  the schedule presentationally (`is-expanded` / `aria-expanded` / `aria-hidden`,
  visible rows, one current marker) **without** starting playback (no `is-play`,
  empty `#now-info`, hidden video) then collapses; and a card-body click still
  plays after expanding.

Non-obvious notes:

- Expand affordance is gated on a **non-empty `getSched`**, not just `has()`:
  a card whose guide has nothing upcoming shows no control. The now/next line
  keeps its own `has()` guard, so the two affordances are independent.
- `has(ch.id)` true + empty schedule is possible in principle; the demo guide
  always has ≥1 upcoming program (current + next), so every demo card carries the
  control.
- Pre-existing unrelated UI failure: `src/tests/ui/log-demo.test.js:182` fails
  on this machine (expects detail `HLS not supported` but the live demo stream
  surfaces `levelLoadError`). It fails identically on the TASK-0064 baseline
  (verified via stash) and is network/MSE-environment dependent — not caused by
  this task, which touches only card render + grid click delegation.
