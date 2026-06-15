---
id: TASK-0091
adr: ADR-0041
evolution: 24
status: done
attempts: 1
depends_on: [TASK-0090]
---

# TASK-0091 — UI: connect to a single-connection Xtream-shaped portal and start a live channel without the fan-out starving playback (+ demo recording)

## Goal

A Playwright UI test proves the regression is fixed end-to-end: connecting to an
**Xtream-shaped, single-connection** portal (`user_info.max_connections: 1`)
lists channels, and clicking a live channel **successfully starts playback** —
the post-connect EPG/VOD fan-out does **not** fire and therefore does not starve
the single connection / 404 the live stream. The same task captures the run's
demo recording (this run changes user-interactable behavior).

## Acceptance criteria

- [ ] A Playwright spec drives the app against an Xtream-shaped portal by
      intercepting the `/api/xtream?url=<encoded>` proxy route in the browser:
      - the no-action `player_api.php` payload returns `user_info.auth: 1` and
        `user_info.max_connections: 1`;
      - `get_live_categories` and `get_live_streams` return a small Xtream-shaped
        channel list;
      - the live stream request (the proxied `.../live/<user>/<pass>/<id>.<ext>`)
        is served a real, playable response (e.g. the offline demo HLS source or
        a stubbed playable stream), **not** a 404.
- [ ] After connect, the app shows the connected channel list (channels render).
- [ ] **No `get_simple_data_table`, `get_vod_*`, or `get_series*` request is
      observed** during/after connect on this single-connection portal (asserted
      via intercepted request URLs / call counts) — the fan-out is gated off.
- [ ] Selecting a live channel reaches the playing state (the player video is
      shown / `is-play` on body, matching the existing live/player UI assertions)
      — playback is **not** starved by the fan-out.
- [ ] A control case (same spec or a sibling): with the intercept advertising
      `max_connections: 4`, the EPG/VOD fan-out **is** observed (so the test
      proves the gate is conditional, not a blanket disable).

## Demo recording (required — user-interactable change)

- [ ] The UI suite records the demo with the arc: **boot** (launch via the
      canonical run command) → **prepare** (open the connect form, enter the
      single-connection Xtream-shaped portal) → **interact** (connect, then
      select and play a live channel — the behavior this run fixes) → **revert
      runtime state** (in-app teardown back to the logged-out / idle player
      state) → **stop**.
- [ ] The recording is written to the known run-artifacts directory the other
      demo specs use, so validate-agent can commit it and reference it from the
      PR `### Demo` section. Repo is **private** → the reference is a clickable
      `blob` link on the run branch (never an inline player / raw URL).

## Test requirements

- **Unit:** n/a — this is the end-to-end browser proof; the logic units are
  covered by TASK-0089 / TASK-0090.
- **UI:** the connect → play-live-channel flow on a single-connection
  Xtream-shaped portal (above), plus the multi-connection control case, plus the
  demo recording. Reuse the existing route-interception / player-assertion and
  demo-recording patterns (`vod-recording.test.js`, `catchup-recording.test.js`,
  `live.test.js`).
- **Integration:** n/a — TASK-0092 covers the live-network assertion.

## Implementation notes

Files touched:

- `src/tests/ui/connect-play.spec.js` (new) — the hermetic Playwright proof of
  the ADR-0041 gate. Carries the `ADR: ADR-0041` comment; already listed in the
  ADR's `governs:` (no `governs:` edit needed).
- `test-results/e24-single-conn-fanout-demo.webm` (new run-artifact) — the demo
  recording validate-agent commits + references from the PR `### Demo`.

How it works (non-obvious for reviewers):

- **Hermetic, no live network.** `page.route('**/api/xtream*', …)` intercepts the
  app's proxy endpoint and answers every request from fixtures. The personal
  portal (used by `live.test.js`) is NEVER touched — running just this spec is
  safe while the real portal is in cooldown.
- **Request classification** decodes the inner `url=` proxy param (mirroring
  `api.js`'s URL builders): no-action `player_api.php` → auth/info with
  `max_connections`; `get_live_categories`/`get_live_streams` → the channel
  fixtures; `/live/<u>/<p>/<id>.ts` → a tiny static 200 (so the player's stream
  fetch is satisfied — the request being ISSUED is the proof, headless codec
  decode is not required); `get_simple_data_table` / `get_vod_*` / `get_series*`
  → RECORDED into a `seen` counter and answered 200-empty (so a slip-through
  never hangs the run; the asserted `seen.epg === 0` / `seen.vod === 0` is what
  proves the gate).
- **Three regression assertions** on the `max_connections:1` portal: (1) the grid
  populates (categories + 3 cards); (2) `seen.epg`/`seen.vod` stay 0 after a 2 s
  settle — the fan-out is gated off; (3) clicking a live card reaches
  `body.is-play` + `#fmt-chip` TS and the proxied stream request fires
  (`seen.stream > 0`) — playback is not starved.
- **Control case** (`max_connections:4`) asserts the EPG fan-out DOES fire
  (`seen.epg > 0`) — proving the gate is conditional, not a blanket disable.
- **Demo recording** is a serial `describe` with its own `recordVideo` context
  (scoped to this spec, like `vod-recording.test.js`/`catchup-recording.test.js`),
  driving boot → prepare (footer form) → interact (connect + play live channel)
  → revert (in-app `#btn-disc` Disconnect back to the idle NO SIGNAL state) →
  stop. Renamed in `afterAll` to `test-results/e24-single-conn-fanout-demo.webm`.

Verified green hermetically: `npx playwright test src/tests/ui/connect-play.spec.js`
→ 9 passed, recording produced (~250 KB webm). No unit code touched (the gate
logic units are covered by TASK-0089/TASK-0090), so the unit suite is unaffected.
