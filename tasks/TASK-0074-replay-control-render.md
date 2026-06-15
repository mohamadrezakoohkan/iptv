---
id: TASK-0074
adr: ADR-0036
evolution: 21
status: pending
attempts: 0
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

_Filled by implement-agent._
