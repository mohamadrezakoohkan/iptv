---
id: TASK-0022
adr: ADR-0011
evolution: 5
status: pending
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

_Filled by implement-agent._
