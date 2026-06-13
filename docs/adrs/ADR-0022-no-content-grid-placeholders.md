---
id: ADR-0022
title: Render contextual, actionable placeholders for empty channel lists
date: 2026-06-13
evolution: 13
status: accepted
governs:
  - src/client/ui.js
  - src/client/app.css
---

# ADR-0022 — Render contextual, actionable placeholders for empty channel lists

## Context

The channel grid (`specs/iptv-player.md` §5c) shows one undifferentiated
`No channels found.` for every empty case — empty search, empty category, no
favourites, or a source with no channels. The prompt (E13) wants these moments
clearer and more helpful, with actionable guidance grounded in existing
navigation affordances (`specs/empty-states.md` §2). ADR-0021 provides the pure
`resolveContent` resolver; this ADR decides how its output renders.

## Decision

`rndGrid` in `client/ui.js` renders the empty grid by calling
`IptvEmpty.resolveContent(...)` (ADR-0021) and emitting a structured placeholder
inside the existing `.ch-empty` block: a decorative icon, a `title`, a `body`
guidance line, and — when the resolved `EmptyState` carries one — an action
button. The four cases and their copy are exactly `specs/empty-states.md` §2.

- The placeholder container carries `role="status"`; the icon is
  `aria-hidden="true"` (`specs/empty-states.md` §4).
- The action button triggers its `kind` through the existing handlers:
  `clear-search` clears the search input and re-renders; `view-all` sets the
  active category to "All Channels" and re-renders. No new navigation
  mechanisms are introduced — the buttons reuse the app's existing filter/search
  paths.
- The `<query>` shown in the no-match copy is HTML-escaped.
- Styling for the placeholder (icon size, title/body/button) is added to
  `.ch-empty` in `client/app.css` using existing CSS tokens, so it themes
  automatically.

## Consequences

- The user always learns *why* the list is empty and gets a one-tap way out
  (clear the search, browse all channels) where one exists.
- `rndGrid` gains a small render branch but no message logic (that lives in
  ADR-0021); the action wiring reuses handlers already present in `ui.js`.
- Existing grid tests that assert the literal `No channels found.` string must
  be updated to the new contextual copy.

## Tasks derived

- TASK-0044 — Render contextual no-content grid placeholders + actions
- TASK-0046 — Demo recording of the improved empty / no-signal states

## Traceability

`client/ui.js`, `client/app.css`, and `index.html` carry `ADR: ADR-0022` in
their existing ADR comment lines (comma-separated with prior ADRs as applicable).
HTML/CSS without comment support are linked from this side. When this decision's
rendering is removed, this ADR is marked `status: deleted`.
</content>
