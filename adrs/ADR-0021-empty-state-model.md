---
id: ADR-0021
title: Resolve empty/no-signal placeholders through one pure EmptyState resolver
date: 2026-06-13
evolution: 13
status: accepted
governs:
  - client/empty.js
---

# ADR-0021 — Resolve empty/no-signal placeholders through one pure EmptyState resolver

## Context

The prompt (E13) asks to make the app's empty/"no signal" moments clearer and
more helpful (`specs/empty-states.md`). Those moments span several distinct
causes — idle player, stream error, empty search, empty category, no favourites,
empty source — and today each is rendered ad hoc: the player idle text is static
markup, the stream error dumps a raw engine token, and every empty channel list
shows the identical `No channels found.` string with no awareness of why it is
empty. CONVENTIONS.md §6 favours flat state + pure logic over scattered DOM
conditionals, and the harness requires every behaviour to be unit-testable
without the DOM.

## Decision

Introduce a single client module `client/empty.js` (IIFE exposing
`window.IptvEmpty`) that owns one **pure** resolver returning the structured
`EmptyState` shape from `specs/empty-states.md` §1 — `{ icon, title, body,
action? }` with `action.kind` drawn from the fixed set `clear-search`,
`view-all`, `retry`, `connect`.

- `resolveContent({ total, shown, flt, srch, favs })` → the channel-grid
  `EmptyState` (or `null` when the grid is non-empty), choosing the message by
  the priority rules in `specs/empty-states.md` §2.
- `resolveSignal({ phase, cur })` → the player no-signal `EmptyState` for the
  idle and stream-error cases in `specs/empty-states.md` §3.

The resolver takes plain values (counts, the active filter token, the query
string, the phase) and returns plain data — no DOM access, no globals beyond the
module export. The grid and player renderers (ADR-0022, ADR-0023) consume its
output and are the only code that touches the DOM.

## Consequences

- Every empty/no-signal message is decided in one place by one tested function;
  adding or tweaking a case is a data change, not a new DOM branch.
- The decision is fully unit-testable (input values → expected `EmptyState`)
  with zero DOM, satisfying the harness's "unit always" requirement cleanly.
- Renderers stay thin: they map an `EmptyState` to markup and wire its action to
  an existing handler; they hold no message logic.
- One more client module to load in `index.html`, ordered before `ui.js`.

## Tasks derived

- TASK-0043 — Empty-state resolver module (`client/empty.js`)

## Traceability

`client/empty.js` carries an `// ADR: ADR-0021` comment near the top. If the
resolver is ever removed, this ADR is marked `status: deleted`.
</content>
