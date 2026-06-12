---
id: TASK-0025
adr: ADR-0012
evolution: 6
status: pending
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

_Filled by implement-agent._
