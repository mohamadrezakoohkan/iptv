---
id: TASK-0022
adr: ADR-0011
evolution: 5
status: done
attempts: 0
depends_on: []
---

# TASK-0022 — Proxy redirect-following and stream piping

## Goal

`/api/xtream` in `server/rtr.js` follows validated redirects (the live
portal 302-redirects `.ts` streams to a tokenized URL on another host) and
pipes long-lived MPEG-TS streams without size/timeout cutoffs, aborting
upstream when the client disconnects.

## Acceptance criteria

- [ ] 301/302/303/307/308 responses with a `Location` header are followed
      up to 5 hops; relative `Location` values resolve against the current
      URL; the final response is piped to the client.
- [ ] Every redirect target is re-validated with `isValidUrl`
      (protocol + blocklist); invalid target → HTTP 400, >5 hops → 502.
- [ ] No response-size cap or idle timeout interrupts a continuous piped
      body.
- [ ] When the client response closes mid-stream, the upstream
      request/response is destroyed.
- [ ] Non-redirect proxying (API JSON, M3U text) behaves exactly as before.

## Test requirements

- **Unit:** local in-process HTTP fixtures covering: single redirect
  followed; relative Location; redirect chain of 6 → 502; redirect to
  blocked host → 400; client disconnect destroys upstream; plain 200 pipe
  unchanged.
- **UI:** n/a — not user-facing.
- **Integration:** through the in-process proxy against the live portal
  (`specs/integration-testing.md` Xtream tier): fetch a live channel's
  `.ts` stream URL → HTTP 200 with TS sync byte `0x47` in the first bytes;
  read bounded (~64 KB) then abort.

## Implementation notes

- `server/rtr.js`: `runProxy` now validates and delegates to `runHop`
  (one upstream request per hop). 301/302/303/307/308 + `Location` →
  `goRedir`, which 502s past `MAX_HOPS = 5`, resolves relative Locations
  via `new URL(loc, cur)`, and re-validates with `isValidUrl` (400 on
  invalid/blocked target). Non-redirect responses go to `runPipe`:
  `writeHead` + `pipe`, with `res.on('close')` destroying both the
  upstream response and request. No size cap or idle/total timeout is set
  anywhere on the upstream request, so continuous TS bodies flow
  indefinitely. Exported `rtr._blocked` (the `BLOCKED_HOSTS` array) so
  unit fixtures on 127.0.0.1 can temporarily lift that single entry.
  ADR comment updated to `ADR-0002, ADR-0011`.
- `tests/unit/redir.test.js`: in-process fixture server covering single
  redirect, relative Location, 6-hop loop → 502, redirect to blocked host
  (`localhost`) → 400, plain 200 pipe unchanged, and client-abort →
  upstream connection close (polled flag).
- `tests/int/redir.test.js`: live Xtream tier — lists live streams via
  the proxy, samples up to 5 channels, fetches each `.ts` URL through the
  proxy expecting HTTP 200 (redirects followed server-side) with first
  byte `0x47`, bounded ~64 KB read then abort; passes if at least one
  sample yields valid TS bytes. Verified green against the live portal.
- Existing `tests/unit/rtr.test.js` headersSent guard still passes
  (`runProxy` public behavior unchanged for non-redirect paths).
