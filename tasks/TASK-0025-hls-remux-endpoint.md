---
id: TASK-0025
adr: ADR-0012
evolution: 6
status: done
attempts: 0
depends_on: []
---

# TASK-0025 — Server TS→HLS live remux endpoint (/api/hls)

## Goal

A new server module `server/hls.js` (mounted from `server/rtr.js`) that
turns a raw MPEG-TS stream URL into a live HLS playlist on demand, using
ffmpeg stream copy from the `ffmpeg-static` npm package. After this task,
`GET /api/hls?url=<encoded-ts-url>` returns a playable `.m3u8` whose
segments are served at `GET /api/hls/<session>/<segment>.ts`, with sessions
reaped after idle and temp directories cleaned up.

## Acceptance criteria

- [ ] `ffmpeg-static` is a dependency in `package.json`; no system ffmpeg
      is required — `npm install` is the only setup step.
- [ ] `GET /api/hls?url=<encoded>` rejects URLs failing the existing
      `/api/xtream` validation/blocklist with 400 (same SSRF protection,
      including no bypass via the remux path).
- [ ] For a valid TS source, the endpoint spawns ffmpeg with stream copy
      (`-c copy`, no transcode) writing HLS (short segments, small sliding
      window, `+delete_segments`) into a per-session temp directory, and
      responds with the playlist once produced; ffmpeg failure or startup
      timeout returns 502.
- [ ] Playlist segment URIs resolve to `GET /api/hls/<session>/<seg>.ts`,
      which serves the segment bytes; unknown session or segment → 404,
      and path traversal in `<session>`/`<segment>` is rejected.
- [ ] Repeated/concurrent requests for the same source URL reuse one
      session (one ffmpeg process per source).
- [ ] A session unrequested for the idle window is reaped: ffmpeg process
      killed and temp directory removed.
- [ ] Existing `/api/xtream` behavior and all prior suites are unchanged.

## Test requirements

- **Unit:** URL validation/blocklist on `/api/hls`; session keying and
  reuse; idle reaping (kill + temp cleanup, fake timers); segment route
  404s and path-traversal rejection; ffmpeg arg construction (stream copy,
  HLS flags) and 502 on spawn failure/startup timeout — ffmpeg spawn
  mocked throughout.
- **UI:** n/a — not user-facing (client wiring is TASK-0026).
- **Integration:** against the live portal (`http://mymax.top:8080`,
  credentials per specs/integration-testing.md), request `/api/hls` for a
  sampled live channel's `.ts` URL through the in-process server: response
  is 200 with a body starting `#EXTM3U`, and at least one listed segment
  fetches with 200 and TS sync byte `0x47` at offset 0; bounded reads,
  session torn down at test end. Flake policy per
  specs/integration-testing.md (at least one of a sample of channels).

## Implementation notes

- `server/hls.js` (new): session registry (`SESS` by sid, `KEYS` by source
  URL), ffmpeg spawn via `ffmpeg-static` with `-c copy -f hls -hls_time 2
  -hls_list_size 6 -hls_flags delete_segments` into a `mkdtemp` per-session
  dir; playlist polled (250 ms, 15 s bound) and segment URIs rewritten to
  `/api/hls/<sid>/segNNNNN.ts`; 502 + session teardown on ffmpeg exit/error
  or startup timeout; `runReap` interval (unref'd) kills + removes sessions
  idle past 60 s or dead. Segment route validates names against
  `^seg\d+\.ts$` (blocks traversal) and unknown sid/seg → 404.
- `server/rtr.js`: mounts `GET /api/hls` behind the existing `isValidUrl`
  SSRF gate (same 400 as `/api/xtream`) and `GET /api/hls/:sid/:seg`;
  exports `_runHls` for unit tests.
- `package.json` / `package-lock.json`: added `ffmpeg-static` dependency
  (binary verified runnable; npm install is the only setup step).
- Tests: `tests/unit/hls.test.js` (18 tests — validation, args, reuse, 502
  paths, segment 404/traversal, reaping with fake-timer system time; spawn
  mocked by patching `child_process.spawn`, which works because hls.js calls
  `cp.spawn(...)` through the module object). `tests/int/remux.test.js`
  (live portal: connect, SSRF 400, sampled-channel remux → `#EXTM3U`
  playlist + segment with sync byte 0x47, bounded 64 KB read, full session
  teardown). Verified locally: unit 287/287, UI 83/83, remux int 4/4
  (live channel "IR: Iran international SD" remuxed OK).
- Non-obvious: the idle-reap unit tests drive `Date.now` with Vitest fake
  timers and invoke `_runReap` directly rather than waiting on the module's
  real 15 s sweep interval (registered at require time).
