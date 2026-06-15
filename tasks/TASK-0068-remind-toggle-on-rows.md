---
id: TASK-0068
adr: ADR-0033
evolution: 20
status: done
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

Implemented entirely within the existing EPG render in `src/client/ui.js`
(ADR-0031 surface) plus styling in `src/client/app.css`, reading
`window.IptvRem` at render time (guarded), with no new state-machine phase,
no new control flag, and no new storage key (TASK-0067's `iptv_rems`).

**Files touched (production):**
- `src/client/ui.js`
  - `getRemLabel(opts)` — pure: the state-flipping accessible label
    ("Remind me when … starts" / "Clear reminder for …"), title HTML-escaped.
  - `mkRemBtn(opts)` — pure: the Remind `<button>` HTML; `data-rem="<chId>|<start>"`,
    `aria-pressed` PRESENT in the baseline (R-0001: `"true"` when set per
    `IptvRem.has`, else `"false"`), `on` class mirroring the fav star, and an
    `aria-hidden` clock glyph.
  - `mkRem(opts)` — pure guard: returns the toggle only for an UPCOMING program
    (`prg.start > now`) and only when `window.IptvRem` is present; `''` otherwise
    (current/past program, missing `next`, or module absent).
  - `mkSchedRow` now appends `mkRem({ chId: prg.chId, prg, now })` (the `getSched`
    current row has `start <= now` so it renders no toggle).
  - `mkNowNext` restructured: the NOW/NEXT text rows are wrapped in an
    `aria-hidden="true"` `.ch-nn-text` span (was on the `.ch-nn` div), and the
    Remind toggle for the NEXT program is rendered as a sibling OUTSIDE the
    aria-hidden span so it stays keyboard/AT reachable. `.ch-nn` is now a flex
    row.
  - `getRemPrg(chId, start)` — resolves the live `Prg` from `IptvEpg.getSched`
    by matching `start`; null when no guide / no match (stale `data-rem` → no-op).
  - `toggleRem(btn)` — resolves `chId`+`start` (split on the last `|`), calls
    `IptvRem.toggle`, updates the button's `aria-pressed` + `aria-label` + `on`
    class IN PLACE (mirrors `toggleFav`); guarded no-op when `IptvRem` absent or
    program unresolvable. Exported on `window.IptvUi`.
  - `onGridClick` resolves `[data-rem]` (after `[data-exp]`, before `[data-fav]`)
    and calls `evt.stopPropagation()` + `toggleRem` so toggling neither
    plays/selects the channel nor toggles the schedule expansion.
  - `onGridKey` skips `[data-rem]` (real `<button>` fires its own native click,
    same posture as `[data-exp]`).
- `src/client/app.css` — `.ch-rem` toggle styling on ADR-0024 spacing/sizing/
  radius tokens (`--s6`/`--s1`/`--r1`) and ADR-0019 colour tokens
  (`--ln`/`--sur2`/`--dim`/`--tx`/`--acc`); `[aria-pressed="true"]` uses the
  accent token. `.ch-nn` → flex row, new `.ch-nn-text` column span.

**Tests added:**
- `src/tests/unit/remui.test.js` (13 tests) — schedule-row + now/next toggle
  emission (baseline `aria-pressed="false"`/`"true"`, upcoming-only, NEXT-only,
  no-`next`, label escaping, IptvRem-absent guard), and `toggleRem` in-place
  flip both directions, stale/absent-module no-ops, no full re-render. R-0001
  honored: `aria-pressed` asserted present in the rendered baseline first.
- `src/tests/ui/reminders.test.js` (4 tests) — demo-fixture: keyboard-focus +
  activate the NOW/NEXT toggle and an upcoming schedule-row toggle, assert
  `aria-pressed` flips both ways with no playback / no unexpected collapse, and
  the current row carries no toggle.
- `src/tests/ui/reminders-demo.test.js` (demo recording) — full boot → prepare
  → interact → revert arc producing `test-results/e20-reminders-demo.webm`.

**Touched (non-decision) for the ADR-0033 NOW/NEXT restructure:** ADR-0031's
`epgui.test.js`, `epg.test.js`, `epg-demo.test.js` had three assertions on
`.ch-nn[aria-hidden]` retargeted to the new `.ch-nn-text` span — the decorative
text stays aria-hidden; only the markup nesting changed.

**ADR traceability:** `ui.js` + `app.css` ADR comment headers gain `ADR-0033`;
ADR-0033 `governs:` trued up to add `src/tests/ui/reminders-demo.test.js`.

**Non-obvious / for reviewers:**
- The demo guide's single upcoming program is the SAME program as NEXT, so the
  NOW/NEXT toggle and the one upcoming schedule-row toggle reference the same
  reminder. Because updates are in place (no re-render, per spec §4), the two
  buttons do not cross-sync within a session; the demo clears between the two
  interactions to keep each starting from an unset baseline.
- `IptvRem.load()` is not yet wired into `main.js` onReady, so reminders do not
  survive a page reload yet — boot-time load + the firing timer belong to
  ADR-0034 / later tasks, outside this task's scope. Within a session the
  toggle persists via `IptvRem.add`/`rm` (localStorage) and renders correctly.
