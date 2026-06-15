---
id: TASK-0083
adr: ADR-0038
evolution: 22
status: pending
attempts: 0
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

_Filled by implement-agent._
