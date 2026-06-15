---
id: TASK-0083
adr: ADR-0038
evolution: 22
status: done
attempts: 1
depends_on: [TASK-0082]
---

# TASK-0083 — Demo recording of VOD browse + play

## Goal

Capture the run's demo recording: a screen recording of the actually-running
product exercising the VOD feature end-to-end on the synthesized offline demo
movie (no live network), following the required boot → prepare → interact →
revert → stop arc. After this task the PR's `### Demo` section references a
committed recording showing the Live | Movies | Series toggle and on-demand
playback working.

## Acceptance criteria

- [ ] A UI test (`src/tests/ui/vod-recording.test.js`) drives the demo arc and
      produces a committed screen recording: **boot** (launch via the canonical
      run command, `node src/server/srv.js`) → **prepare** (connect in demo mode)
      → **interact** (switch the content toggle to **Movies**, then select and
      play the synthesized demo movie so the recording shows VOD playback working)
      → **revert** (stop playback / switch back to Live — in-app runtime reset,
      not a git revert) → **stop**.
- [ ] The recording is written to the known run-artifacts directory used by the
      existing demo recordings (e.g. `src/tests/ui/__recordings__/` per the
      catch-up/epg/reminder demo recordings) so validate-agent can commit it and
      reference it from the PR `### Demo` section.
- [ ] A companion demo UI test (`src/tests/ui/vod-demo.test.js`) asserts the demo
      Movies tab is present and the demo movie plays offline (no live network), so
      the demonstrable behavior is regression-guarded independent of the recording.
- [ ] The flow runs entirely on the demo path's synthesized offline movie — no
      live Xtream portal required.

## Test requirements

- **Unit:** n/a — this task is a UI recording/flow; its logic is covered by
      TASK-0077–0082 unit tests.
- **UI:** `src/tests/ui/vod-recording.test.js` (the recording arc) +
      `src/tests/ui/vod-demo.test.js` (offline demo Movies + playback assertions),
      following the existing `catchup-recording.test.js` / `catchup-demo.test.js`
      patterns. Honor R-0001 for any attribute assertions.
- **Integration:** n/a — offline demo path, no external connectivity.

## Implementation notes

Files created (both already listed in ADR-0038 `governs:`, both carry the
`// ADR: ADR-0038` comment near the top — traceability already true):

- `src/tests/ui/vod-recording.test.js` — the demo recording arc. A per-spec
  Chromium context with `recordVideo` (mirroring `catchup-recording.test.js` /
  `epg-demo.test.js` / `reminders-demo.test.js`), run serially. Arc: **boot**
  (fresh load of the running product via the Playwright `webServer`, i.e. the
  canonical `node src/server/srv.js`; only the Live toggle option shows) →
  **prepare** (connect demo mode through the real footer login so the demo
  connect synthesizes the one offline VOD movie and `rndToggle` reveals the
  Movies tab) → **interact** (click the content toggle's `data-mode="movies"`
  option — production `onToggle`/`goMode`/`rndMode2` re-render the sidebar/grid
  from the movie set — assert the one synthesized movie poster card "Demo Movie"
  / `demo-vod-1`, then click it to play through the existing select+play path:
  `body.is-play`, `#now-info` = "Demo Movie", `#player-video` shown) → **revert
  runtime state** (in-app teardown: `stopPlay`, clear cur/search/filter, walk the
  phase back to READY, switch the toggle back to Live via `setCMode('live')` +
  `rndToggle`, re-render the live grid) → **stop** (the `.webm` is flushed on
  context close in `afterAll` and renamed to the stable artifact path).
  Writes the recording to `test-results/e22-vod-demo.webm` (the path the task
  specifies, matching the prior E21 catch-up recording's `test-results/`
  location) for validate-agent to commit and reference from the PR `### Demo`.

- `src/tests/ui/vod-demo.test.js` — companion offline regression test (mirrors
  `catchup-demo.test.js`): boots demo mode (offline, no live network) and asserts
  the same demonstrated behavior independently of the recording — the Movies tab
  surfaces (Series hidden), switching to Movies browses exactly the one
  synthesized movie card, selecting it plays through the existing select+play path
  with the movie's on-demand url handed to `loadPlay` unchanged (a `loadPlay` spy
  records the url so the headless run makes no real media load), and switching
  back to Live restores the live grid.

Non-obvious points:
- The demo movie is `demo-vod-1` / "Demo Movie", url
  `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` — already synthesized by the
  demo connect path (TASK-0077–0082); this task only records/regression-guards it.
- No production source changed — this is purely the recording arc plus an offline
  regression test. The whole arc drives production handlers only.
- R-0001: the only attribute assertions are on `aria-pressed`, which `mkToggleOpt`
  emits present in the baseline markup and only flips between `'true'`/`'false'`
  (per ADR-0038 §8 and the existing `vod.test.js`) — never asserts an attribute
  added where the source had none.

Other test-results byte regenerations (if any) are left unstaged per the task.
