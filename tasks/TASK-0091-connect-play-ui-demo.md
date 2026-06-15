---
id: TASK-0091
adr: ADR-0041
evolution: 24
status: pending
attempts: 0
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

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
