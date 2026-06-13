---
id: TASK-0052
adr: ADR-0025
evolution: 15
status: pending
attempts: 0
depends_on: []
---

# TASK-0052 — Contextual single format chip (markup + show/hide + functional click + styling)

## Goal

Replace the always-present, never-clickable `#chip-hls` / `#chip-ts` pair in the
content-head with a **single contextual format chip** that is hidden until a
channel is playing, shows the engine actually resolved (`HLS` / `TS`, with a
remuxed `.ts` surfacing `HLS`), and does something meaningful on click — toggling
an inline detail that names the active engine — instead of the current no-op.
After this task the content-head shows no format pill when idle, one labelled
chip "on top" while playing, and clicking that chip visibly responds.

## Acceptance criteria

- [ ] `index.html` no longer contains the `.fmt-chips` two-span cluster
      (`#chip-hls`, `#chip-ts`); it contains exactly one chip control
      `<button type="button" id="fmt-chip">` plus its inline-detail element, and
      carries an `ADR: ADR-0025` comment.
- [ ] On load and whenever no channel is playing (idle, error, logged-out,
      connecting), the format chip is **not visible** in the content-head.
- [ ] When a channel plays and an engine resolves, the chip becomes visible at
      the right of the content-head and its label is the resolved engine:
      `HLS` for the hls.js / native-HLS path, `TS` for the mpegts.js path.
- [ ] A `.ts` channel played through the server TS→HLS remux fallback shows
      `HLS` (the engine in use), consistent with ADR-0012 — i.e. `rndChip('hls')`
      after the remux path still labels/shows the chip as HLS.
- [ ] Clicking the chip toggles an inline format detail naming the active engine
      (e.g. "Playing via hls.js" / "Playing via mpegts.js"); clicking again
      hides it. `aria-expanded` mirrors the toggle. The chip is keyboard-
      focusable and the toggle changes neither the state-machine phase nor the
      running engine.
- [ ] When playback stops (teardown / error / disconnect / channel switch to
      idle), the chip is hidden again and any open detail is collapsed.
- [ ] `client/app.css` styles the single chip as a 28px-tall secondary control
      with `--r1` radius reading ADR-0024 tokens and ADR-0019 colour tokens; the
      obsolete `.fmt-chips` container rule is removed; the file carries an
      `ADR: ADR-0025` comment.
- [ ] The existing chip test (`tests/ui/chips.test.js`) and any unit references
      to `#chip-hls` / `#chip-ts` are updated in this task to the single-chip
      contract (no staged migration; suites stay green).

## Test requirements

- **Unit:** `tests/unit/fmtchip.test.js` — exercise `IptvUi.rndChip`: resolving
  `'hls'` → chip shown + label `HLS`; `'ts'` → shown + label `TS`; empty/no
  engine or stop path → chip hidden and detail collapsed; the click handler
  toggles the inline-detail class and `aria-expanded` without touching
  `IptvSt.ST.phase`. Per R-0001, before asserting any attribute mutation on the
  chip, confirm against the baseline `index.html` which attributes the element
  actually carries — only assert toggles on attributes that are present in the
  source (e.g. `aria-expanded` you add) and never assert restoration of an
  attribute that was never in the markup.
- **UI:** `tests/ui/fmtchip.test.js` — load app, assert no chip visible at idle;
  drive a demo-mode channel into PLAY and assert exactly one chip appears with
  the resolved engine label; click it and assert the inline detail appears, then
  click again and assert it hides; return to idle/stop and assert the chip is
  gone. Keep `tests/ui/chips.test.js` updated to the new single-chip ids.
- **Integration:** n/a — no external connectivity (engine resolution and the
  remux-to-HLS surfacing are already integration-covered by ADR-0010/0012
  tasks; this task changes only the content-head surface).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
