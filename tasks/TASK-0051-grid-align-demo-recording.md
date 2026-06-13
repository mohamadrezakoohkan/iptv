---
id: TASK-0051
adr: ADR-0024
evolution: 14
status: done
attempts: 1
depends_on: [TASK-0048, TASK-0049, TASK-0050]
---

# TASK-0051 — Demo recording of the unified-grid surfaces

## Goal

A Playwright video-capture spec exists that boots the running product, prepares
it (demo mode), navigates every restyled surface (sidebar, content header
line-up, channel grid, player, footer) visibly showing the aligned gutters and
shared control baselines, reverts the in-app runtime state to its initial
condition, and stops — writing the video to the run-artifacts dir so
`validate-agent` can commit it and reference it from the PR's `### Demo` section.
This run changes user-interactable visual layout across every primary surface, so
it must carry a demo recording (`CORE_FLOW.md` §3 Demo recording).

## Acceptance criteria

- [ ] A dedicated Playwright spec (e.g. `tests/ui/grid-align-demo.test.js`)
      records a video to the run-artifacts dir (`test-results/`) via a
      self-launched Chromium context with `recordVideo` enabled (scoped to this
      spec only, leaving `playwright.config.js` untouched so the rest of the UI
      suite records nothing — matching the TASK-0046 pattern), and renames the
      flushed `.webm` to a deterministic path
      `test-results/e14-grid-align-demo.webm`.
- [ ] The recording follows the required arc in order: **boot** (app loaded from
      a clean start via the canonical run command in `specs/project.md`) →
      **prepare** (enter demo mode so the grid/cards/player render with real
      content) → **interact** (navigate the restyled surfaces: scroll/show the
      sidebar category column, the content-head control line-up, the channel
      grid + a card, the player wrapper, and the footer form row — visibly
      exercising the aligned gutters and shared baselines, e.g. select a
      category and a channel) → **revert runtime state** (in-app teardown: clear
      search, return to All Channels, stop any playback so the app is back at its
      pre-interaction starting condition — never a git revert) → **stop**.
- [ ] During the arc the spec asserts the contract's alignment is real, not a
      blind drive: the content-column gutter x is shared across `.content-head`,
      `.player-card`, `.ch-section`, `.footer`; the two column headers share
      height/bottom-border y; and a footer input + the submit button share a
      36px height and bottom baseline. (Reuses the geometry assertions from
      TASK-0048/0050 so the recording demonstrates the unification.)
- [ ] The produced video lands in `test-results/` on the run branch so the
      terminal actor can commit it and write the PR `### Demo` clickable blob
      link (private repo → `blob/<run-branch>/<path>`, never an inline tag).

## Test requirements

- **Unit:** n/a — this task adds a UI recording spec only; no new product logic.
- **UI:** the demo spec itself is the UI test. It must run under
  `npx playwright test`, produce the video artifact, and assert the alignment of
  the restyled surfaces during the arc. **DEMO RECORDING is a named, required
  output of this task:** validate-agent runs this spec, commits the produced
  video with the task, and references it from the PR `### Demo` section.
- **Integration:** n/a — runs against the local demo source, no external
  connectivity.

## Implementation notes

Implemented by implement-agent (attempt 1).

**Files touched:**
- `tests/ui/grid-align-demo.test.js` (new) — the demo-recording UI spec.
- `adrs/ADR-0024-spacing-sizing-token-contract.md` — added the new spec to
  `governs:` (traceability bookkeeping only; no decision content changed).

**Approach.** Patterned on the inherited E13 demo spec
`tests/ui/empty-demo.test.js`: a per-spec Chromium context launched in
`beforeAll` with `recordVideo` enabled (scoped to this spec only —
`playwright.config.js` is untouched, so the rest of the UI suite records
nothing). `playwright.config.js` already sets `outputDir: '.playwright-out'`
(gitignored), so the committed artifact under `test-results/` survives the run
(the E13 remediation lesson). `afterAll` resolves the auto-named `.webm` path,
closes the context to flush it, then renames it to the deterministic committed
path **`test-results/e14-grid-align-demo.webm`**.

**Arc exercised, in order:** boot (fresh load via the canonical Playwright
webServer) → prepare (connect demo mode through the real footer login, 31 demo
cards) → interact (sidebar 16px gutter + 36px category rows + category select;
both 56px column headers on one bottom line; content-column 24px gutter shared
across `.content-head`/`.player-card`/`.ch-section` with footer padding asserted
separately since it is full-app-width; channel select exercising the player
wrapper; footer form input + submit both 36px on one baseline; theme toggle to
light proving the geometry is theme-agnostic) → revert runtime state (restore
dark theme, stop playback, clear search, return to All Channels) → stop (assert
the recorder is active; `afterAll` renames the video).

**Assertions reuse** the TASK-0048/0050 geometry checks (gutter x, header
height/bottom-border y, footer 36px one-baseline) so the recording is a real
test, not a blind drive. Verified locally: all 9 tests pass and the
`773 KB` `.webm` lands at `test-results/e14-grid-align-demo.webm`.

The validate-agent commits the produced video with this task and writes the PR
`### Demo` clickable blob link (private repo → `blob/<run-branch>/<path>`).
