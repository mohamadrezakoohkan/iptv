---
id: TASK-0045
adr: ADR-0023
evolution: 13
status: pending
attempts: 0
depends_on: [TASK-0043]
---

# TASK-0045 — Guided no-signal idle + stream-error placeholders with retry

## Goal

The player's two no-output states render from `IptvEmpty.resolveSignal`
(TASK-0043): the idle "NO SIGNAL" state gains a guidance line (and a "Connect a
source" action when there is no session), and the stream-error state shows a
human-readable headline + explanation + a working **Retry** button instead of a
raw engine token, per `specs/empty-states.md` §3. After this task a failed stream
reads clearly and recovers in one click, and the idle player points the user to
the next action.

## Acceptance criteria

- [ ] `rndPlayer` in `client/ui.js` renders the idle state from
      `IptvEmpty.resolveSignal({ phase, cur })`, keeping the antenna icon and the
      visible "NO SIGNAL" title, adding a guidance body; in the no-session case it
      shows a "Connect a source" action that focuses the footer login.
      `client/ui.js` ADR comment line includes `ADR-0023`.
- [ ] On a stream error (phase ERR with a current channel), `#player-err` shows a
      warning icon, the constant headline "This channel won't play", a friendly
      one-line explanation (not the raw engine token), and a "Retry" button; the
      raw engine detail appears only as a small dimmed secondary line.
- [ ] Clicking "Retry" re-attempts playback of the current channel through the
      existing play path; `client/play.js` exposes a retry entry point and carries
      `ADR-0023` in its ADR comment line.
- [ ] The idle container carries `role="status"`; the error container carries
      `role="alert"`; placeholder icons carry `aria-hidden="true"`; the Retry and
      Connect buttons are keyboard-focusable with discernible accessible names.
- [ ] Error text is surfaced as visible text, never console-only
      (`specs/iptv-player.md` §12).
- [ ] Player placeholder styling is added to `client/app.css` using existing
      tokens; `index.html` player markup is updated to carry the needed hooks.

## Test requirements

- **Unit:** extend `tests/unit/play.test.js` / a player-render unit test to assert
  the idle markup (title, guidance, conditional Connect action by session
  presence) and the error markup (warning icon, constant headline, friendly body,
  dimmed raw detail, Retry button) from a simulated ST, and that the Retry entry
  point in `play.js` re-invokes the play path for `ST.cur`. Per R-0001, assert
  against the actual rendered markup.
- **UI:** extend `tests/ui/player.test.js` (Playwright) to drive demo mode and
  assert the idle "NO SIGNAL" placeholder shows the guidance line, and (by forcing
  an unplayable channel / error state) the stream-error placeholder shows the
  human-readable headline + a focusable Retry button. Include at least one
  screenshot of each player placeholder written to the run-artifacts dir.
- **Integration:** n/a — no external connectivity (rendering only).

## Implementation notes

_Filled by implement-agent._
</content>
