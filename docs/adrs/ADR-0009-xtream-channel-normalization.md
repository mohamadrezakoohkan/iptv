---
id: ADR-0009
title: Xtream path normalizes portal objects into the canonical Ch schema
date: 2026-06-12
evolution: 5
status: accepted
governs:
  - src/client/api.js
  - src/tests/int/xtream.test.js
---

# ADR-0009 — Xtream path normalizes portal objects into the canonical Ch schema

## Context

E5 prompt: the app cannot connect-and-play against the user's personal
Xtream portal (`http://mymax.top:8080`). Diagnosis shows the portal
authenticates fine, but `loadXtream()` in `client/api.js` returns the **raw**
`get_live_streams` objects (`num, name, stream_type, stream_id, stream_icon,
category_id, …`) with no `url` field, while the M3U and demo paths return
normalized `Ch` objects `{ id, name, grp, url, img, cat, num }`. The UI
(`client/ui.js`) plays `ch.url` and filters on `grp`/`cat` — so the Xtream
path has never been playable. Xtream live stream URLs follow
`<portal>/live/<user>/<pass>/<stream_id>.<ext>`, and the supported `<ext>`
comes from `user_info.allowed_output_formats` in the no-action
`player_api.php` response (this portal: `["ts"]` only).

## Decision

`loadXtream()` normalizes every portal stream object into the canonical `Ch`
schema before returning. It additionally calls the no-action
`player_api.php` endpoint to (a) verify `user_info.auth` and surface a
human-readable error Result on failure, and (b) read
`allowed_output_formats[0]` (fallback `"ts"`) as the stream URL extension.
Category names are resolved from `get_live_categories`
(`{category_id, category_name}`); unknown ids map to `"Uncategorized"`. The
constructed `url` is `<portal-base>/live/<user>/<pass>/<stream_id>.<ext>`.
Mapping table lives in `specs/iptv-player.md` §8.

## Consequences

- The Xtream path produces the same `Ch` contract as M3U/demo — UI, search,
  favourites, and persistence work unchanged.
- One extra portal round-trip at connect time (auth/info call).
- Raw `.ts` URLs now reach the player, which forces ADR-0010 (MPEG-TS
  playback) and ADR-0011 (proxy redirect-following) to make them playable.

## Tasks derived

- TASK-0021 — Normalize Xtream channels and build stream URLs

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0009` comment near the top.
