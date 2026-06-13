---
id: TASK-0060
adr: ADR-0028
evolution: 17
status: done
attempts: 0
depends_on: [TASK-0058, TASK-0059]
---

# TASK-0060 — Demo recording of the playback-failure-log button + panel

## Goal

A Playwright video-capture spec exists that boots the running product, prepares
it (demo mode), induces a channel-playback failure so a log entry is captured,
opens the log panel from the button beside the account button to show the
recorded failure and the count badge, clears the log, reverts the in-app runtime
state to its starting condition, and stops — writing the video to the
run-artifacts dir so `validate-agent` can commit it and reference it from the
PR's `### Demo` section. This run changes user-interactable behavior (E17), so
it must carry a demo recording (`CORE_FLOW.md` §3 Demo recording).

## Acceptance criteria

- [ ] A dedicated Playwright spec (e.g. `src/tests/ui/log-demo.test.js`) records
      a video to the run-artifacts dir with a deterministic, discoverable path
      (e.g. `test-results/e17-failure-log-demo.webm`), scoped to this spec only
      (its own browser context with `recordVideo`), leaving
      `playwright.config.js` untouched.
- [ ] The recording follows the required arc in order: **boot** (app loaded from
      a clean start via the canonical run command in `docs/specs/project.md`) →
      **prepare** (enter demo mode / load the demo source) → **interact** (induce
      a playback failure through the real `onEngErr` capture path — e.g. drive
      `setErr`/`go('ERR')`/`onEngErr` or select a channel that cannot play in the
      harness — so a real `IptvErrLog` entry and badge appear; open the log panel
      from the button beside the account button; show the entry row and the count
      badge; click Clear and show the empty state) → **revert runtime state**
      (close the log panel, the log already cleared, stop any playback, return to
      the pre-interaction condition — an in-app teardown, never a git revert) →
      **stop**.
- [ ] The spec asserts the log button sits **beside** the account button, the
      panel shows the captured failure with its detail, the badge reflects the
      count, and Clear empties it — so the recording is a real demonstration, not
      a blind drive — reusing the copy/structure from
      `docs/specs/playback-failure-log.md` §2–§3.
- [ ] The produced video lands in the run-artifacts dir on the run branch so the
      terminal actor can commit it and write the PR `### Demo` reference
      (visibility-correct link per `CORE_FLOW.md` §3).

## Test requirements

- **Unit:** n/a — this task adds a UI recording spec only; no new product logic.
- **UI:** the demo spec itself is the UI test. It must run under
  `npx playwright test`, produce the video artifact, and assert the
  failure-log button/panel behavior during the arc. **DEMO RECORDING is a
  named, required output of this task** — validate-agent runs this spec, commits
  the produced video with the task, and references it from the PR `### Demo`
  section.
- **Integration:** n/a — runs against the local demo source and an
  induced (not live) playback failure, no external connectivity.

## Implementation notes

Files touched:
- `src/tests/ui/log-demo.test.js` — the dedicated demo-recording Playwright spec
  (carries `// ADR: ADR-0028`). Own browser context with `recordVideo`,
  `playwright.config.js` untouched. Writes to `test-results/e17-failure-log-demo.webm`
  (resolved from the auto-named `.webm` in `afterAll` then renamed to the stable
  path). Boots from the Playwright `webServer` (`node src/server/srv.js`).
- `docs/adrs/ADR-0028-playback-log-button-panel.md` — added
  `src/tests/ui/log-demo.test.js` to `governs:` (traceability true-up only; no
  decision content changed).

Arc driven (in order): **boot** (fresh load; asserts `#log-btn` sits immediately
before `#acct-btn` at the right edge of `.content-head`, badge hidden, panel
off-screen) → **prepare** (connect demo mode via the real footer login; 31
`.ch-card`s render) → **interact** (click the first demo channel "World News 24"
#001 — the genuine `onGridClick → loadPlay → runHls → onEngErr('HLS not
supported')` path records one real `IptvErrLog` entry; assert the badge shows 1;
open the panel from the button beside the account button; assert the one entry
row shows the channel name + `001` and detail `HLS not supported`, badge still 1;
click `#log-clear`; assert the empty state and hidden badge) → **revert runtime
state** (close the panel, in-app teardown: `stopPlay`, clear err/cur, ERR→INIT,
re-render to the idle condition) → **stop** (assert recorder active; video
flushed + renamed in `afterAll`).

Non-obvious — the induced trigger: the failure is produced by PRODUCTION code
(only the channel click is induced), but headless Chromium reports
`canPlayType('application/vnd.apple.mpegurl') === "maybe"` (truthy), which would
send `runHls` down its native-`<video>` branch (`loadNative`) whose load error
never funnels through `onEngErr`. Typical desktop Chrome (the product's real
target) reports `""` for that MIME. A `context.addInitScript` makes headless
Chromium report that same honest "no native HLS" capability, so with the hls.js
CDN unavailable offline the genuine `'HLS not supported'` dead-end into
`onEngErr` runs — no faked failure, no injected DOM, only the browser capability
the production code branches on is restored. Ran green locally:
`npx playwright test src/tests/ui/log-demo.test.js` → 7/7 passed,
`test-results/e17-failure-log-demo.webm` produced (~718 KB). Run together with
`src/tests/ui/log.test.js` → 20/20 (the init script is scoped to the demo spec's
own context only, no leakage).
