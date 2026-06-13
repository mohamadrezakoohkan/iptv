---
id: TASK-0052
adr: ADR-0025
evolution: 15
status: done
attempts: 1
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

**Production code**

- `index.html` — replaced the always-present `.fmt-chips` two-span cluster
  (`#chip-hls`, `#chip-ts`) with a single `<button type="button" id="fmt-chip"
  class="fmt-chip" aria-expanded="false" hidden>` plus a sibling
  `<span class="fmt-detail" id="fmt-detail" hidden>` for the toggled engine
  detail. Carries an `<!-- ADR: ADR-0025 -->` comment.
- `client/ui.js` — EL registry: `chls`/`cts` → `fchp`/`fdtl`. `rndChip(eng)`
  rewritten: a resolved token (`'hls'`/`'ts'`) shows the chip, sets its label
  via `FMT_LBL`, marks `.active`, and records `dataset.eng`; an empty/unknown
  token hides the chip, clears `.active`, resets `aria-expanded="false"`, and
  collapses the detail. New `onFmtChip()` handler toggles `#fmt-detail`
  visibility + text (from `FMT_DTL`) and mirrors `aria-expanded`, never touching
  `ST.phase` or the engine. `mkEL` wires the chip click; exports add `onFmtChip`.
  `rndPlayer()` now calls `rndChip('')` whenever phase is not `PLAY`, so the chip
  is removed on every teardown/error/idle/disconnect/switch path (rndPhase →
  rndPlayer runs on every transition).
- `client/app.css` — `.fmt-chips` container rule removed; `.fmt-chip` kept as the
  single chip's style (28px tall `calc(var(--s6)+var(--s1))`, `--r1` radius,
  ADR-0019 colour tokens), plus `.fmt-chip[hidden]`, `.fmt-detail`, and
  `.fmt-detail[hidden]`. Carries a CSS `ADR: ADR-0025` comment.

  Engine resolution in `client/play.js` (ADR-0010/0012) is unchanged — it still
  pushes the resolved engine through `updChip(eng)` → `rndChip(eng)`, including
  the remux-to-HLS `updChip('hls')` case.

**New global names** (verified unique across `client/*.js`): `FMT_LBL`,
`FMT_DTL`, `onFmtChip`.

**Tests**

- Added `tests/unit/fmtchip.test.js` (rndChip resolution/label/hide, onFmtChip
  toggle + aria-expanded, no phase mutation).
- Added `tests/ui/fmtchip.test.js` (idle hidden → demo play shows labelled chip
  → click toggles detail → stop hides chip).
- Updated `tests/ui/chips.test.js`, `tests/ui/live.test.js`,
  `tests/ui/fallback.test.js` to the single `#fmt-chip` contract (visible +
  label) instead of the old two-chip `.active` assertions.
- Updated `tests/ui/controls.test.js` to measure the chip after playing a demo
  channel (it is now contextual, hidden at idle).
- Updated `tests/unit/acctui.test.js` + `tests/unit/themetoggle.test.js` element
  id lists from `chip-hls`/`chip-ts` to `fmt-chip`/`fmt-detail`.

**Notes for reviewers**

- ADR-0025 `governs:` trued up: removed `tests/ui/fmtchip-demo.test.js` (that file
  is TASK-0053's demo recording, not created here).
- `tests/ui/live.test.js` requires live portal credentials/network; only its chip
  selectors were updated. All other UI tests (182) and the full unit suite (592)
  pass locally.
