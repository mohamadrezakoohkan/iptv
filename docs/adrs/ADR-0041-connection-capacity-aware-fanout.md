---
id: ADR-0041
title: The post-connect EPG/VOD fan-out is gated on the portal's advertised connection capacity so single-connection portals never starve live playback
date: 2026-06-15
evolution: 24
status: accepted
governs:
  - src/client/api.js
  - src/client/ui.js
  - src/client/main.js
  - src/tests/unit/api.test.js
  - src/tests/unit/epgfetch.test.js
  - src/tests/unit/vodfetch.test.js
  - src/tests/ui/connect-play.spec.js
  - src/tests/int/fanout-gate.test.js
---

# ADR-0041 — The post-connect EPG/VOD fan-out is gated on the portal's advertised connection capacity so single-connection portals never starve live playback

## Context

E24 prompt: fix a connect-time portal-flood regression introduced by the EPG
(E19, ADR-0030) and VOD (E22, ADR-0037) features.

Reproduced symptom (real browser, real single-connection Xtream portal):
connecting succeeds and lists all channels ("Connected … 9132 channels · 120
categories"), but clicking any live channel shows the player error "This channel
won't play — The stream could not be loaded." The failing request is the live
`.ts` stream through the local proxy returning **404**. The same account plays
fine on the pre-EPG/VOD build (`final-non-autonoumous-release` tag).

Root cause: the post-connect best-effort fan-out in `src/client/api.js`, fired
immediately after a successful connect from `onOk` / `onSwOk` / `onConnRes`
(`src/client/ui.js`, `src/client/main.js`):

- `loadEpg` → `runXtEpg` issues up to `EPG_CAP = 120` `get_simple_data_table`
  requests, batched `EPG_BATCH = 6` concurrently;
- `loadVod` → `runXtVod` issues `get_vod_categories`, `get_vod_streams`,
  `get_series_categories`, `get_series` (and a per-series `get_series_info` on
  drill-down).

That burst of ~130 requests, against a portal whose
`user_info.max_connections` is `1`, (a) contends for and exhausts the single
allowed connection so the subsequent live-stream request is refused with 404,
and (b) trips the panel's anti-flood protection, which then returns account-wide
404 for a cooldown period. In isolation `auth:1` and a single live stream return
302; after the fan-out every endpoint returns 404 until cooldown.

Constraints from the prompt (these are the boundaries, not the design):

- The post-connect EPG/VOD fetch must respect single-connection portals so live
  playback is never starved.
- `user_info.max_connections` is available from the **no-action**
  `player_api.php` auth payload the connect path already fetches (`loadXtream`
  reads `user_info` for `auth` and `allowed_output_formats`) — thread it through
  so the decision is data-driven, not heuristic.
- Must NOT regress EPG/VOD on multi-connection portals, nor the demo path
  (synthetic in-memory EPG/VOD, ADR-0030/ADR-0037 §6), nor the M3U path
  (single XMLTV guide fetch).
- Live playback must work on a `max_connections: 1` portal exactly as it did on
  the tag.

## Decision

Gate the **bulk Xtream EPG/VOD fan-out on the portal's advertised connection
capacity**, threaded from the no-action auth payload through the connect Result.

1. **Thread `maxConns` through the connect Result.** `loadXtream`
   (`src/client/api.js`) reads `Number(user_info.max_connections)` from the
   no-action `player_api.php` payload it already fetches, coerces it to a
   non-negative integer (`0` / missing / NaN → treat as unknown), and adds it to
   the returned Xtream connect value as `maxConns`. The connect value shape is
   otherwise unchanged; the M3U and demo Results carry no `maxConns` (absent =
   unknown). This is the single data-driven input for the gate.

2. **Gate the Xtream bulk fan-out on `maxConns`.** A portal is treated as
   **single-connection** when its advertised `maxConns` is exactly `1`. On a
   single-connection Xtream portal the app **skips the bulk EPG/VOD fan-out
   entirely** — `runXtEpg` (the per-channel `get_simple_data_table` burst, up to
   `EPG_CAP`) and `runXtVod` (the movies + series bulk calls) do not run — so the
   single allowed connection stays free for live playback. When `maxConns > 1`
   (multi-connection) **or unknown** (absent / `0` / unparseable — the
   conservative-but-non-regressing default that preserves pre-E24 behavior for
   portals that do not advertise the field), the existing bulk fan-out runs
   unchanged, bounded exactly as today (`EPG_BATCH` concurrency, `EPG_CAP`
   cap).

   The gate lives at the fan-out entry points (`loadEpg` → `runEpg` Xtream
   branch, `loadVod` → `runXtVod` branch), keyed on a `maxConns` field passed in
   `opts`. The demo branch (`runDemoEpg` / `runDemoVod`) and the M3U branch
   (`runM3uEpg`; M3U VOD is already empty) are **never** gated — they issue no
   per-channel Xtream burst, so they are not the regression and must keep
   working offline.

3. **On-demand series-info stays allowed.** `loadSerInfo` (the single
   per-series `get_series_info` fetched only when the user opens a series) is an
   explicit user action, not part of the connect-time burst, and is unaffected
   by the gate. On a single-connection portal the Series surface is simply empty
   (no bulk series fetch ran), so the drill-down is not reachable anyway.

4. **Thread `maxConns` from connect to the fan-out kickoffs.** `onOk` /
   `onSwOk` (`src/client/ui.js`) and `onConnRes` (`src/client/main.js`) read
   `val.maxConns` from the connect Result and pass it into `goEpg` / `goVod`,
   which forward it into `loadEpg` / `loadVod`. Absent on M3U/demo Results, so
   those paths see `undefined` (unknown) and remain ungated — but they have no
   Xtream burst to gate, so behavior is unchanged.

This keeps the fix **data-driven** (the portal tells us its capacity), **minimal**
(no new playback engine, no new server route, no new state-machine phase, no new
localStorage key), and **non-regressing** (multi-connection / unknown portals,
demo, and M3U are byte-for-byte unchanged in behavior).

### Single-connection trade-off (explicit)

On a single-connection portal the user gets **no EPG now/next line and no
Movies/Series tabs** for that source — exactly the pre-E19/E22 behavior, which
is the state the regression must restore. Restoring live playback on these
portals is the prompt's hard requirement; richer EPG/VOD on a 1-connection
portal (e.g. lazy per-viewed-channel EPG) is out of scope for this fix and is a
candidate for a later evolution, noted but not built here.

## Consequences

**Easier:**
- Live playback works on `max_connections: 1` portals again, matching the tag.
- The decision is data-driven from a field the connect path already fetches — no
  probing, no heuristics, no new request.
- Demo, M3U, and multi-connection Xtream paths are untouched, so the existing
  EPG/VOD specs and tests for those paths stay valid.

**Harder / trade-offs:**
- Single-connection portals lose EPG/VOD for that source (the explicit trade-off
  above). This is the correct degradation: never starve playback.
- The connect Result gains one field (`maxConns`) the EPG and VOD specs must now
  document as the gate input.

**Ruled out:**
- Running the bulk fan-out on every portal and racing it against playback (the
  regression itself).
- A server-side rate limiter / connection pool (unrequested scope; the proxy is
  a generic passthrough, ADR-0011).
- Lazy per-viewed-channel EPG as part of this fix (a larger redesign; deferred —
  the gate fully satisfies the prompt's must-not-starve requirement).

## Tasks derived

- TASK-0089 — Thread `maxConns` from the no-action auth payload through the
  Xtream connect Result (`loadXtream`), with coercion + unit tests.
- TASK-0090 — Gate the bulk Xtream EPG/VOD fan-out on `maxConns` in `loadEpg` /
  `loadVod`, and forward `maxConns` from `onOk` / `onSwOk` / `onConnRes` →
  `goEpg` / `goVod`; unit tests for gated vs. ungated.
- TASK-0091 — UI: connect to an Xtream-shaped single-connection portal and
  successfully start a live channel without the fan-out starving playback
  (Playwright); captures the connect → play live channel → revert → stop demo
  recording.
- TASK-0092 — Integration: against the live Xtream tier, assert the connect
  payload's `max_connections` is read and the gate decision is data-driven (the
  fan-out is suppressed for a single-connection portal, run for a
  multi-connection one).

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0041` comment near the top
(native comment syntax). When a change removes the last governed code, this ADR
is marked `status: deleted` — the file itself is never removed; it is history.
