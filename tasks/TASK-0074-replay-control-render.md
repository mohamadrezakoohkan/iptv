---
id: TASK-0074
adr: ADR-0036
evolution: 21
status: done
attempts: 1
depends_on: [TASK-0072]
---

# TASK-0074 — Replay control on past archive-capable schedule rows

## Goal

`mkSchedRow` (`src/client/ui.js`) renders a keyboard-focusable Replay
`<button type="button">` on a schedule row only when the program is PAST, the
owning channel is archive-capable (`Ch.arch === true`), and the program start is
within the archive window (`archDur` days, skipped when `archDur` is 0). The
control carries `data-replay="<chId>|<start>"` and an accessible label; everywhere
else (future rows, the airing program, non-archive channels, M3U/demo) it is
absent. Styling lands in `src/client/app.css`.

## Acceptance criteria

- [ ] A PAST row (`prg.stop <= now`) on an `arch:true` channel within its archive
      window renders a `<button type="button" class="ch-replay" ...>` carrying
      `data-replay="<chId>|<start>"` and `aria-label="Replay <title>"` (title
      HTML-escaped); the aria attribute is present in the baseline HTML (R-0001).
- [ ] A FUTURE row renders the existing Remind toggle and **no** Replay; the
      airing program (`start <= now < stop`) renders neither; a PAST row on an
      `arch:false` (or M3U/demo) channel renders neither.
- [ ] When `archDur > 0` and the program start is older than the archive window
      (`prg.start < now - archDur*86400000`), no Replay is rendered; when
      `archDur === 0` the window check is skipped (Replay still rendered for a
      past archive-capable program).
- [ ] The builder is guarded so a row still renders when archive data is absent
      (channel without `arch`) — no throw, no Replay.
- [ ] The Replay control is styled consistently with the existing row controls
      (Remind toggle) using ADR-0024 spacing/sizing + ADR-0019 colour tokens.

## Test requirements

- **Unit:** `mkSchedRow` (or `epgui.test.js`) emits the Replay button HTML with
  correct `data-replay`/`aria-label` for a past archive-capable in-window
  program; emits no Replay for future, airing, out-of-window, non-archive, and
  no-arch-field cases; baseline aria attribute present (R-0001).
- **UI:** With an archive-capable channel whose guide has a past program, expand
  the guide and assert the Replay button is focusable and present on the past
  row, and absent on future/airing rows and on a non-archive channel's rows. (Use
  the demo/synthetic guide so it runs offline.)
- **Integration:** n/a — pure render; no external connectivity in this task.

## Implementation notes

Render-only (activation/playback is TASK-0075). Files touched:

- `src/client/ui.js` — added three pure helpers + threaded the channel through
  the schedule render:
  - `isReplayable({ ch, prg, now })` — the gating predicate: `ch.arch === true`
    AND `prg.stop <= now` AND (when `archDur > 0`) `prg.start >= now -
    archDur*86400000`; `archDur === 0`/absent skips the window check. A channel
    without `arch` (M3U/demo/no field) is never replayable, so it never throws.
  - `mkReplay({ ch, prg, now })` — returns the `<button type="button"
    class="ch-replay" data-replay="<chId>|<start>" aria-label="Replay <title>">`
    (title HTML-escaped, aria-label PRESENT in baseline per R-0001; one-shot
    action button, no attribute toggling) or `''` when not replayable.
  - `getSchedPrgs({ ch, now })` — for a non-archive channel returns the existing
    upcoming list (`IptvEpg.getSched`); for an archive-capable channel it
    PREPENDS the channel's past in-window programs (read from `IptvEpg.get`,
    which `getSched` omits since it is upcoming-only) so a past archive row can
    render. This is the prerequisite that lets `mkSchedRow` ever see a past row.
  - `mkSchedRow` now takes `ch` in its opts and emits `mkReplay(...)` alongside
    the existing Remind slot; `mkSched` passes `ch` through and uses
    `getSchedPrgs`.
- `src/client/app.css` — `.ch-replay` / `.ch-replay-ico` / `.ch-replay:hover`,
  sized/positioned identically to the `.ch-rem` Remind toggle (ADR-0024
  spacing/sizing/radius tokens, ADR-0019 colour tokens). No per-component
  `:focus-visible` rule — the single global focus ring covers it (controls.test
  enforces exactly one `:focus-visible` rule).
- Traceability: `ADR-0036` added to the `ui.js` and `app.css` ADR header
  comments. ADR-0036 `governs:` already lists `ui.js`, `app.css`, and the test
  files; no change needed.

Tests:
- Unit — `src/tests/unit/epgui.test.js`: a new "Replay control gating" describe
  (reached via `mkCard → mkSched → mkSchedRow`, `Date.now` pinned to REF). The
  loadUi stub's `IptvEpg` gained a `get()` returning the full list; `renderAt`
  mirrors the real split (`getSched` = upcoming-only, `get` = full). Covers:
  past in-window archive row renders Replay with correct `data-replay` +
  baseline `aria-label` (R-0001); title escaped; no Replay on future / airing /
  non-archive / no-`arch`-field (no throw) / out-of-window rows; `archDur===0`
  skips the window check; exactly one Replay + correct row split with a
  past+future guide.
- UI — `src/tests/ui/catchup.test.js`: boots demo mode offline, injects an
  arch:true and an arch:false channel + a past+future guide, re-renders via
  production `rndGrid`/`mkCard`, and asserts the Replay button is focusable and
  present on the past archive row, absent on the future row, and absent on the
  non-archive channel.
- Integration — n/a (pure render, no external connectivity).

Note for TASK-0075: the demo EPG path does not yet synthesize archive-capable
past programs, so the UI test seeds an in-page guide directly rather than
relying on the demo guide; TASK-0075 owns the demo synthesis + `goReplay`
activation.
