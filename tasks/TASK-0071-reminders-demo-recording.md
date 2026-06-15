---
id: TASK-0071
adr: ADR-0034
evolution: 20
status: done
attempts: 1
depends_on: [TASK-0068, TASK-0069, TASK-0070]
---

# TASK-0071 — Demo recording of the reminder set → fire → notify → clear arc

## Goal

A screen recording of the running product exercising the program-reminder flow
end-to-end on the demo fixture, committed as a run-artifact on the run branch
and referenced from the PR `### Demo` section (CORE_FLOW.md §3 Demo recording).
This run adds user-interactable behavior, so it is **not** demo-exempt.

## Acceptance criteria

- [ ] The UI suite produces a screen recording following the required arc
      (CORE_FLOW.md §3): **boot** (launch via `node src/server/srv.js`) →
      **prepare** (enter `demo` to load the demo playlist + synthetic guide;
      expand a channel's schedule) → **interact** (set a Remind toggle on an
      upcoming/NEXT program — `aria-pressed` flips; let the timer fire it so the
      in-app toast appears; the best-effort Notification path runs
      mocked-granted; use the toast's Watch/Jump to switch to the channel) →
      **revert runtime state** (clear the reminder via the toggle and dismiss
      the toast, returning the in-app state to its pre-interaction condition) →
      **stop**.
- [ ] The recording runs entirely on the demo fixture — no live network, no
      real credentials, notification prompt mocked/granted in the harness.
- [ ] The recording is written to the run-artifacts directory the UI suite uses
      and committed on the run branch by validate-agent, which writes the PR
      `### Demo` reference as a clickable link per the repo's visibility
      (CORE_FLOW.md §3).

## Test requirements

- **Unit:** n/a — this task produces a demo recording, not new product logic.
- **UI:** `src/tests/ui/reminders.test.js` (or a dedicated
  `reminders-demo` spec) drives the full set → fire → notify (mocked) → watch →
  clear arc on the demo fixture and captures the recording across that arc.
- **Integration:** n/a — demo fixture only, no external connectivity.

## Implementation notes

Files touched:

- `src/tests/ui/reminders-demo.test.js` — rewritten to capture the full
  set → fire → notify → watch/jump → clear-individually arc this task owns. The
  prior version (from TASK-0068) only set + cleared the toggle and never
  exercised the firing surface; it now drives the complete arc and records the
  webm. Its ADR comment was corrected from `ADR-0033` to `ADR-0034` (this task's
  owning ADR).
- `docs/adrs/ADR-0034-…md` — `governs:` trued up: added
  `src/tests/ui/reminders-demo.test.js`.
- `docs/adrs/ADR-0033-…md` — `governs:` trued up: removed
  `src/tests/ui/reminders-demo.test.js` (it now belongs to ADR-0034).

Non-obvious notes for reviewers / validate-agent:

- The recording is written to `test-results/e20-reminders-demo.webm` (the known
  run-artifacts dir). validate-agent commits it and writes the PR `### Demo`
  reference as a clickable link per repo visibility (CORE_FLOW.md §3).
- Capture is scoped to THIS spec only: a per-spec `chromium.newContext` with
  `recordVideo` on, the .webm resolved before context close and renamed to the
  stable path in `afterAll` — same pattern as `epg-demo.test.js` /
  `log-demo.test.js`. The global UI suite records nothing.
- The arc drives PRODUCTION code only and asserts along the way (real footer
  demo connect, real Remind toggle handler, real `window.IptvUi.fireRem` firing
  surface the timer calls, real toast Watch select+play path). FIRING is driven
  through `fireRem` (exactly what the `main.js` timer calls per due reminder) so
  the demo is deterministic without waiting for the coarse ~20s tick or
  fabricating a past `start`.
- A granted `Notification` is stubbed via `context.addInitScript` before page
  scripts load (capturing constructions on `window.__notes`), so the
  best-effort permission-gated branch is exercised mocked-granted with no real
  OS prompt — demo fixture only, no live network, no real credentials.
- After a direct `fireRem`, the toggle DOM is not re-rendered, so the reminder
  set in INTERACT 1 is still stored and the toggle still reads `aria-pressed`
  "true"; the clear-individually step therefore presses it once (true → false),
  faithfully showing individual clearing.
