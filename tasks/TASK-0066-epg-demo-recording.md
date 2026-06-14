---
id: TASK-0066
adr: ADR-0031
evolution: 19
status: pending
attempts: 0
depends_on: [TASK-0064, TASK-0065]
---

# TASK-0066 — Demo recording of the EPG now/next + expandable schedule

## Goal

A Playwright video-capture spec boots the running product, prepares it (demo mode
with its synthetic guide), shows the now/next line on channel cards, expands a
channel to reveal its schedule, collapses it, reverts the in-app runtime state to
the starting condition, and stops — writing the video to the run-artifacts dir so
`validate-agent` can commit it and reference it from the PR's `### Demo` section.
E19 adds user-interactable behavior, so the run must carry a demo recording
(`CORE_FLOW.md` §3 Demo recording).

## Acceptance criteria

- [ ] A dedicated Playwright spec `src/tests/ui/epg-demo.test.js` records a video
      to the run-artifacts dir with a deterministic path
      (e.g. `test-results/e19-epg-demo.webm`), scoped to its own browser context
      via `recordVideo`, leaving `playwright.config.js` untouched (mirroring
      `src/tests/ui/log-demo.test.js`).
- [ ] The recording follows the required arc in order: **boot** (app loaded from a
      clean start via the canonical run command in `docs/specs/project.md`) →
      **prepare** (connect demo mode through the real footer login so the
      synthetic guide loads and channel cards render) → **interact** (show the
      NOW/NEXT line on a card; activate the card's expand control to reveal the
      schedule list — and assert this did **not** start playback; show a couple of
      schedule rows; collapse it again) → **revert runtime state** (collapse any
      open schedule, disconnect/return to the pre-interaction idle condition — an
      in-app teardown, never a git revert) → **stop**.
- [ ] The spec **asserts** the demonstrated behavior (now/next line present with
      titles, expand reveals schedule rows, expand did not trigger playback) so
      the recording is a real demonstration, not a blind drive — reusing copy /
      structure from `docs/specs/epg.md` §4–§5.
- [ ] The produced video lands in the run-artifacts dir on the run branch so the
      terminal actor can commit it and write the PR `### Demo` reference (the repo
      is **private**, so the reference must be a `blob`-URL clickable link per
      `CORE_FLOW.md` §3, not an inline raw image).

## Test requirements

- **Unit:** n/a — this task adds a UI recording spec only; no new product logic.
- **UI:** the demo spec itself is the UI test. It must run under
  `npx playwright test`, produce the video artifact, and assert the EPG now/next
  + expandable-schedule behavior during the arc. **DEMO RECORDING is a named,
  required output of this task** — validate-agent runs this spec, commits the
  produced video with the task, and references it from the PR `### Demo` section.
- **Integration:** n/a — runs against the local demo source (synthetic guide),
  no external connectivity.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks. `src/tests/ui/epg-demo.test.js` carries `// ADR: ADR-0031`._
