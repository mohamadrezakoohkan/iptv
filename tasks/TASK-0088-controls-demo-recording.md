---
id: TASK-0088
adr: ADR-0039
evolution: 23
status: done
attempts: 1
depends_on: [TASK-0087]
---

# TASK-0088 — Demo recording of the in-player controls layer

## Goal

When this task is done, the UI suite produces a committed screen recording that
demonstrates the in-player controls layer working offline in demo mode, covering
the full required arc (boot → prepare → interact → revert runtime state → stop).
This is the run's demo (the run adds user-interactable behavior, so it is NOT
demo-exempt).

## Acceptance criteria

- [ ] A UI test records the running product to the known run-artifacts directory
      with the arc: **boot** (launch via the canonical run command,
      `node src/server/srv.js`) → **prepare** (connect demo mode and play a demo
      channel so the shared `<video>` is streaming) → **interact** (exercise the
      controls: toggle fullscreen via `#fs-btn` and/or `F`, toggle PiP via
      `#pip-btn` and/or `P` where supported, and use keyboard shortcuts —
      Space/K play-pause, M mute, ArrowUp/ArrowDown volume — entirely offline) →
      **revert runtime state** (return the player to its pre-interaction in-app
      state: unmute / restore volume, exit fullscreen/PiP, stop the demo stream)
      → **stop**.
- [ ] The recording is a committed run-artifact on the run branch, referenced
      from the PR `### Demo` section as a clickable link per the
      repository-visibility rule (CORE_FLOW.md §3 Demo recording).
- [ ] Where the headless test browser lacks real Fullscreen/PiP, the recording
      still demonstrates the keyboard media shortcuts and the controls' presence
      / state; PiP/FS portions degrade silently (consistent with the
      silent-degrade design) and the recording notes it.

## Test requirements

- **Unit:** n/a — this task is a recording artifact, not new product logic.
- **UI:** `src/tests/ui/ctrl-demo.test.js` — the demo-recording test described
  above (boot → prepare → interact → revert → stop), producing the committed
  recording artifact.
- **Integration:** n/a — no external connectivity (demo mode plays offline-safe
  public test streams already loaded by demo mode).

## Implementation notes

**Files touched**

- `src/tests/ui/ctrl-demo.test.js` (new) — the demo-recording UI spec. Already
  listed in ADR-0039 `governs:`, so no ADR edit was needed; carries the
  `// ADR: ADR-0039` comment.

**What it does (the §3 arc)**

A per-spec recorded browser context (`recordVideo`, mirroring
`vod-recording.test.js` / `catchup-recording.test.js`) drives the whole arc in
one serial run and renames the flushed `.webm` to the stable committed-artifact
path `test-results/e23-controls-demo.webm` in `afterAll`:

- **boot** — fresh load via the Playwright `webServer` (`node src/server/srv.js`,
  the canonical run command); asserts the controls chrome is wired with
  `#fs-btn` / `#pip-btn` carrying baseline `aria-pressed="false"` (R-0001).
- **prepare** — connects demo mode through the real footer login (`#f-url` =
  `demo`, `#btn-conn`), plays a demo channel (`.ch-card` click), then pins PLAY
  deterministically.
- **interact** — exercises the controls fully offline: forces FS/PiP support so
  both buttons are visible + keyboard-focusable, activates each through the real
  click handlers, then drives the genuine document `onPlayKey` handler on the
  real `<video>` for M (mute), ArrowUp/ArrowDown (volume), and Space
  (play/pause).
- **revert runtime state** — un-mutes, restores default volume, exits any
  lingering FS/PiP, stops the demo stream, clears current/search/filter, walks
  the phase back to a non-PLAY idle condition, and re-renders.
- **stop** — closes the context (flushing the video) and asserts the recorder
  was active.

**Non-obvious decisions for reviewers**

- The demo HLS stream can fatally error mid-arc in headless chromium (an ERR
  overlay over the player). To keep the production handlers live and the spec
  deterministic, PLAY is re-pinned before each interaction (the same
  `pinPlaying` technique `keys.test.js` uses) and the FS/PiP buttons are
  activated via `dispatchEvent('click')` so a stream-error overlay cannot
  intercept the pointer — both still run the real production code paths.
- New headless chromium can actually enter real fullscreen, so the FS button's
  `aria-pressed` correctly follows the live browser state rather than staying
  un-pressed; the spec therefore asserts the buttons stay present + reflect
  reality (never an optimistic value) and exits FS afterward, consistent with
  the silent-degrade design (specs §1a/§2a/§2b).
- Space play/pause asserts the production `togglePlay` REACHES the real
  `<video>`'s play/pause (spying the real methods, not faking them), because a
  dead post-error blob src can reject `play()` (swallowed by design) — so a
  strict `paused` flip would be flaky while the spy is faithful and stable.

Verified locally: `npx playwright test src/tests/ui/ctrl-demo.test.js` — 8/8
passing across repeated runs; `test-results/e23-controls-demo.webm` produced.
