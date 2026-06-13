---
id: ADR-0023
title: Replace raw player idle/error text with guided no-signal placeholders + retry
date: 2026-06-13
evolution: 13
status: accepted
governs:
  - src/client/ui.js
  - src/client/play.js
  - src/client/app.css
  - src/index.html
---

# ADR-0023 — Replace raw player idle/error text with guided no-signal placeholders + retry

## Context

The player card has two no-output states (`specs/iptv-player.md` §5b). The idle
state is a static "NO SIGNAL" label with no guidance; the error state dumps the
raw engine detail string (e.g. `mediaError`, `MPEG-TS not supported`) straight
into `#player-err`. The prompt (E13) wants "no signal" clearer and more helpful,
distinct from empty-list states, with a recovery affordance
(`specs/empty-states.md` §3). ADR-0021 provides `resolveSignal`; this ADR decides
the player rendering.

## Decision

`rndPlayer` in `client/ui.js` renders both player no-output states from
`IptvEmpty.resolveSignal({ phase, cur })` (ADR-0021), keeping the existing
`#player-idle` / `#player-err` hooks and the existing show/hide logic:

- **Idle:** the antenna icon stays; a clearer title (the literal "NO SIGNAL"
  remains the visible title) plus a one-line guidance body that adapts to whether
  a session exists (pick a channel vs connect a source), with the `connect`
  action shown only in the no-session case (`specs/empty-states.md` §3a). The
  container carries `role="status"`.
- **Stream error:** a warning icon, a constant headline ("This channel won't
  play"), a friendly one-line explanation, and a **Retry** button
  (`action: retry`). The raw engine detail is preserved as a small, dimmed
  secondary line — not the primary message. The container carries `role="alert"`
  (`specs/empty-states.md` §3b, §4).

Retry re-attempts playback of the current channel through the existing play path
in `client/play.js` (a small exported re-play entry point invoked by the Retry
button). No new state-machine phase is added; this is rendering of the existing
INIT/READY/ERR states.

## Consequences

- A failed stream now reads as a human-understandable message with a one-click
  recovery, while the raw token stays available for diagnostics.
- The idle player guides the user toward the next action (pick a channel, or
  connect when there is no session).
- `play.js` exposes a retry entry point; `ui.js` wires the Retry/Connect buttons
  to existing handlers. No change to engine selection or stream fetching.
- Existing player/idle/error tests that assert the raw token or bare "NO SIGNAL"
  must be updated to the new structured copy.

## Tasks derived

- TASK-0045 — Guided no-signal idle + stream-error placeholders with retry

## Traceability

`client/ui.js`, `client/play.js`, `client/app.css`, and `index.html` carry
`ADR: ADR-0023` in their ADR comment lines. When this decision's rendering is
removed, this ADR is marked `status: deleted`.
</content>
