---
id: TASK-0046
adr: ADR-0022
evolution: 13
status: done
attempts: 1
depends_on: [TASK-0044, TASK-0045]
---

# TASK-0046 — Demo recording of the improved empty / no-signal states

## Goal

A Playwright video-capture spec exists that boots the running product, prepares
it (demo mode), drives every improved empty/no-signal state end-to-end, reverts
the in-app runtime state to its initial condition, and stops — writing the video
to the run-artifacts dir so `validate-agent` can commit it and reference it from
the PR's `### Demo` section. This is the run's required demo recording: the run
changes user-interactable behavior (E13), so it must carry one
(`CORE_FLOW.md` §3 Demo recording).

## Acceptance criteria

- [ ] A dedicated Playwright spec (e.g. `tests/ui/empty-demo.test.js`) records a
      video to the run-artifacts dir (e.g. `test-results/`) via Playwright video
      capture configured for this spec (browser context with `video` recording
      enabled; the saved `.webm`/video path is deterministic and discoverable for
      committing).
- [ ] The recording follows the required arc in order: **boot** (app loaded from
      a clean start via the canonical run command in `specs/project.md`) →
      **prepare** (enter demo mode / load the demo source) → **interact** (trigger
      and view each improved state: the no-match grid placeholder with its Clear
      search action, the favourites-empty placeholder with Browse all, the player
      idle "NO SIGNAL" guidance, and the stream-error placeholder with Retry) →
      **revert runtime state** (clear search, return to All Channels, stop any
      playback so the app is back at its pre-interaction starting condition — an
      in-app teardown, never a git revert) → **stop**.
- [ ] The spec asserts each improved state is visible during the arc (so the
      recording is a real demonstration, not a blind drive), reusing the contextual
      copy from `specs/empty-states.md` §2–§3.
- [ ] The produced video file lands in the run-artifacts dir on the run branch so
      the terminal actor can commit it and write the PR `### Demo` clickable blob
      link (private repo → `blob/<run-branch>/<path>`, not an inline tag).

## Test requirements

- **Unit:** n/a — this task adds a UI recording spec only; no new product logic.
- **UI:** the demo spec itself is the UI test. It must run under
  `npx playwright test`, produce the video artifact, and assert the improved
  empty/no-signal states appear during the arc. **DEMO RECORDING is a named,
  required output of this task**: validate-agent runs this spec, commits the
  produced video with the task, and references it from the PR `### Demo` section.
- **Integration:** n/a — runs against the local demo source, no external
  connectivity.

## Implementation notes

Files touched:
- `tests/ui/empty-demo.test.js` (new) — the demo recording spec.

Video capture approach: video is scoped to **this spec only**, not the global
UI suite (cost). The spec opens its own Chromium browser/context in `beforeAll`
via `chromium.launch()` + `newContext({ recordVideo: { dir: 'test-results',
size: 1280x800 } })` and runs the whole arc serially in one page
(`test.describe.configure({ mode: 'serial' })`). `playwright.config.js` is left
untouched, so the other 144 UI tests record no video and stay fast. The shared
`webServer` (`node server/srv.js`, the canonical run command) is still started
by the Playwright runner, so the manually-created context hits the real running
product on `http://localhost:3000`.

Stable artifact path: in `afterAll`, the auto-named video path is resolved
(`page.video().path()`), the context is closed to flush the `.webm`, then the
file is renamed to the deterministic path **`test-results/e13-empty-state-demo.webm`**
so the terminal actor can commit it and write the PR `### Demo` clickable blob
link.

Arc coverage (all asserted, in order):
- boot — `page.goto` fresh load, `#player-idle` visible.
- prepare — fill `#f-url` with `demo`, click `#btn-conn`, 31 demo channels load.
- interact — empty search (`.ch-empty` "No matches" + Clear search restores grid),
  empty favourites ("No favourites yet" + Browse all channels restores 31),
  empty category ("Nothing in this category"), player idle ("NO SIGNAL"
  guidance), stream-error ("This channel won't play" + Retry).
- revert — in-app teardown: stopPlay, clear err/cur, `go('INIT')`, clear search,
  back to All Channels; asserts idle visible, err hidden, search empty, All
  Channels active, no `.ch-empty`.
- stop — context closed in `afterAll`; the `.webm` artifact is produced.

The empty-favourites and empty-category states are driven through the real
`rndGrid`/`getChs` render path (matching the validated TASK-0044 UI test), since
the Favourites sidebar button only renders once a favourite exists and the demo
source has channels in every category; the stream-error state is driven through
the real `setErr`/`go('ERR')`/`rndPhase` path (matching TASK-0045), since a live
stream failure is not reproducible in headless Playwright. All copy is asserted
against `specs/empty-states.md` §2–§3 so the recording is a real demonstration.
</content>
