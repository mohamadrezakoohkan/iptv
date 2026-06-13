---
id: ADR-0025
title: Replace the always-present HLS/TS pills with one contextual, clickable format chip
date: 2026-06-13
evolution: 15
status: accepted
governs:
  - src/index.html
  - src/client/ui.js
  - src/client/app.css
  - src/tests/unit/fmtchip.test.js
  - src/tests/ui/fmtchip.test.js
  - src/tests/ui/fmtchip-demo.test.js
---

# ADR-0025 — Replace the always-present HLS/TS pills with one contextual, clickable format chip

## Context

E15 prompt (from the parked BACKLOG idea): *"HLS and TS are buttons in top
navigation bar but upon click nothing happens, change this behavior make them a
chip that will be added on top not something always there."*

Reality in the code at the E14 tip:

- `index.html` renders a fixed two-chip cluster in the content-head bar:
  `<div class="fmt-chips" id="fmt-chips"><span class="fmt-chip" id="chip-hls">HLS</span><span class="fmt-chip" id="chip-ts">TS</span></div>`.
  Both `<span>`s are **always present**, even when nothing is playing.
- They carry `cursor: pointer` in `client/app.css` (`.fmt-chip`) but have **no
  click handler anywhere** — clicking either does nothing. This is exactly the
  "upon click nothing happens" complaint.
- `client/ui.js` `rndChip(eng)` toggles `.active` on whichever of the two spans
  matches the engine `client/play.js` resolved (`updChip` → `rndChip`), so when
  idle both sit inert and grey. The engine itself is resolved by `play.js`
  (`getEng`, `runTs`, `runHls`) per ADR-0010/ADR-0012: `.m3u8` → hls.js,
  anything else → mpegts.js, with a `.ts` channel remuxed to HLS surfacing
  `hls`.

The human's resolved assumptions: this is a fix-plus-rework of existing UI
only (no new streaming backend / format support); the controls must become a
**single contextual chip** that is *added on top* of the content/player region
only when a relevant format applies (i.e. while a channel is playing), and the
chip must **do something meaningful on click** rather than reproduce the no-op.

Constraints that bound this decision:
- **ADR-0010 / ADR-0012** own engine resolution and the "remuxed `.ts` surfaces
  HLS" rule. `client/play.js` already pushes the resolved engine through
  `updChip(eng)` → `IptvUi.rndChip(eng)`; this decision reuses that exact
  signal and does **not** change `play.js` or how an engine is chosen.
- **ADR-0024** owns the 4px-grid spacing/sizing/radius token contract; the chip
  is a secondary control (28px tall, `--r1` radius) and must read those tokens.
- **ADR-0019** owns the colour tokens; the chip reads them (accent `--acc`
  treatment, `--dim`/`--tx`/`--ln`), recolouring under both themes.

No accepted ADR is contradicted, superseded, or deleted: ADR-0010/ADR-0012 keep
the engine-resolution role; this ADR only reshapes how that resolved engine is
**surfaced** in the content-head (replacing two inert spans with one contextual
button), so the chip-surface portions of `index.html`/`client/ui.js`/
`client/app.css` move from being incidental to ADR-0010 into being governed by
this ADR's contextual-chip decision.

## Decision

Replace the always-present `#chip-hls` / `#chip-ts` pair with a **single
contextual, clickable format chip** in the content-head bar.

### Markup (`index.html`)

Remove the two-span `.fmt-chips` cluster. In its place put one chip element —
a real `<button type="button" id="fmt-chip" class="fmt-chip">` with an
accessible label — plus a sibling element holding the inline format-detail text
that the chip toggles. The chip is **hidden by default** (no channel playing).
It carries the `ADR: ADR-0025` reference (HTML comment).

### Presence is contextual (`client/ui.js`)

`rndChip(eng)` is rewritten so the chip is **shown only when an engine is
resolved for an actively playing channel** and **removed/hidden otherwise**:

- Called with a resolved engine token (`'hls'` / `'ts'`) — as `play.js` already
  does via `updChip` — the chip is shown, its label set to the engine
  (`HLS` / `TS`), with the existing accent (`.active`) treatment.
- Called with no/empty engine, or whenever playback stops (teardown, error,
  disconnect, idle), the chip is hidden and its toggled detail is collapsed.
  `rndChip` is wired into the existing render/teardown paths so the chip never
  lingers after playback ends.

The resolved-engine semantics are unchanged: a `.ts` channel played through the
server TS→HLS remux fallback is pushed as `'hls'` by `play.js` (ADR-0012), so
the chip shows `HLS`.

### Functional click (`client/ui.js`)

The chip is a focusable `<button>` with a click handler (the no-op is fixed).
Clicking **toggles an inline format detail** that names the active engine (e.g.
"Playing via hls.js" / "Playing via mpegts.js"); clicking again hides it. The
toggle is purely presentational — it sets/clears a CSS class and updates
`aria-expanded`, and never touches the state-machine phase or the running
engine. The handler is registered through the same `IptvUi` wiring as the other
content-head controls.

### Styling (`client/app.css`)

`.fmt-chip` becomes the single chip's style: secondary control — 28px tall
(`calc(var(--s6) + var(--s1))`), `--r1` radius, mono label, reading ADR-0024
spacing/sizing tokens and ADR-0019 colour tokens; `.active` keeps the `--acc`
accent treatment. A hidden state (chip absent when not playing) and the
inline-detail affordance are added, also reading the token layer. The obsolete
`.fmt-chips` container rule is removed.

## Consequences

**Easier:**
- The content-head is clean when idle — no two inert pills that do nothing.
- The chip is honest: it appears only when a format is actually resolved and
  reflects the engine truly in use (including the remux-to-HLS case).
- Clicking the chip now does something the user can see, ending the no-op
  complaint, while staying presentational (no state-machine risk).

**Harder:**
- `rndChip` gains show/hide responsibility, so it must be invoked on every
  playback-stop path (teardown, error, disconnect) — covered by UI tests
  exercising start→stop, not just the highlight.
- The single `#fmt-chip` id replaces `#chip-hls`/`#chip-ts`; the existing chip
  UI test (`tests/ui/chips.test.js`, ADR-0010/0012) and any unit assertions on
  the two old ids must be updated in the same task that changes the markup — no
  staged migration (E7 lesson).

**Ruled out:**
- Keeping a second chip / a persistent toolbar element (the prompt explicitly
  wants "not something always there").
- Letting the chip switch the engine or format (out of scope — no new streaming
  behavior; the chip is contextual/informational + a presentational toggle).
- Changing `client/play.js` engine resolution (ADR-0010/ADR-0012 unchanged).

## Tasks derived

- TASK-0052 — Contextual single format chip: markup + show/hide + functional
  click toggle + styling (index.html, client/ui.js, client/app.css; unit + UI
  tests for resolution→label, contextual presence, click toggle).
- TASK-0053 — Demo recording of the contextual format chip (boot → demo mode /
  play a channel so an engine resolves → show the chip appearing on top and its
  functional click → revert runtime state → stop).

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0025` comment near the top
(native comment syntax; `index.html` uses `<!-- ADR: ... -->`, CSS uses a CSS
comment). When a change removes the last governed code, this ADR is marked
`status: deleted` — the file itself is never removed; it is history.
