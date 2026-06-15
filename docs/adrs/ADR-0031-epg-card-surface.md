---
id: ADR-0031
title: Render EPG as a now/next line on each channel card plus a presentational expandable per-channel schedule
date: 2026-06-15
evolution: 19
status: accepted
governs:
  - src/client/ui.js
  - src/client/app.css
  - src/tests/unit/epgui.test.js
  - src/tests/ui/epg.test.js
  - src/tests/ui/epg-demo.test.js
---

# ADR-0031 — Render EPG as a now/next line on each channel card plus a presentational expandable per-channel schedule

## Context

E19 prompt: surface what is on **now and next** per channel via a now/next line
on each channel card, plus an **expandable per-channel schedule view**, reusing
the sidebar/channel-grid layout. ADR-0030 supplies the data (the in-memory
`window.IptvEpg` store + selectors); this ADR decides the **render surface**.

The channel card is built by `mkCard(ch)` in `src/client/ui.js`
(`docs/specs/iptv-player.md` §6). The card body is the channel's primary click
target — `onGridClick` selects the channel and starts playback. Two prior
patterns constrain the design:

- **Contextual presence (ADR-0025).** The format chip is *absent until resolved*
  rather than an always-present inert element. The now/next line follows the same
  posture: a channel with no loaded guide shows nothing, so cards never gain
  empty placeholders or break layout.
- **Presentational open/close (account & log panels, `docs/specs/iptv-player.md`
  §13c, ADR-0028).** Panel open state is a CSS class (`is-open`), never a
  state-machine phase. The schedule expansion follows the same model — an
  `is-expanded` class, no new phase (CONVENTIONS §6 unchanged).

## Decision

Render the EPG entirely within the existing grid/card UI in `src/client/ui.js`
(+ `src/client/app.css`), reading `window.IptvEpg` at render time. No new state
phase, no new boolean control flag, no new localStorage key.

### Now/next line on the card

`mkCard` appends a **now/next line** below the channel name when
`IptvEpg.has(ch.id)`:

- "NOW" marker + the current program title (`getNowNext(ch.id).now`).
- "NEXT" marker + the next program title (`getNowNext(ch.id).next`), dimmer.
- When no guide is loaded, the line is **absent** — the card is identical to
  today's (ADR-0025 contextual-presence posture).
- Titles ellipsize to one line each; markers use the mono font; the line reads
  ADR-0024 spacing/sizing and ADR-0019 colour tokens.

### Expandable per-channel schedule

Each guide-carrying card exposes a keyboard-focusable **expand control** that
**does not** start playback (it does not bubble to the card's select/play
handler). Toggling it adds/removes an `is-expanded` class and renders the
channel's upcoming programs (`getSched(ch.id)`) as a compact list — each row a
local-time range + title (+ optional category), the currently-airing program
visually marked. Expansion is **purely presentational** (the panel-open model,
`docs/specs/iptv-player.md` §13c); it adds no phase. The control carries
`aria-expanded` and an accessible label; the schedule list toggles `aria-hidden`.
A card with no loaded guide exposes no expand control.

Full behavior is specified in `docs/specs/epg.md` §4–§5, §7.

## Consequences

**Easier:**
- Reuses `mkCard` / the grid; no new layout region, no new state phase, no new
  storage key — exactly the "render surface only" the prompt asks for.
- Contextual presence (ADR-0025) means missing guides degrade silently — no
  empty rows, no broken cards, no errors.
- Presentational expansion reuses the proven panel-open class model.

**Harder:**
- The card click target now coexists with an expand control; the control must
  stop propagation so expanding never plays the channel (UI test must prove the
  separation).
- The grid re-renders when guides arrive (ADR-0030 fetch is async); render must
  preserve any open expansion / active selection sensibly.

**Ruled out:**
- A separate full-screen guide page (the prompt scopes this to the existing
  card/grid surface).
- A state-machine phase for expansion (CONVENTIONS §6 — expansion is
  presentational, like the account/log panels).

## Tasks derived

- TASK-0064 — Now/next line on the channel card (`mkCard`, render-on-guide,
  styling)
- TASK-0065 — Expandable per-channel schedule view (expand control + schedule
  list, presentational `is-expanded`, playback-safe)
- TASK-0066 — Demo recording of the EPG now/next + expandable schedule

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0031` comment near the top.
When a change removes the last governed code, this ADR is marked `status:
deleted` — the file itself is never removed; it is history.
