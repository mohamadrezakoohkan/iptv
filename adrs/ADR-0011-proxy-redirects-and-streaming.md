---
id: ADR-0011
title: Proxy follows validated redirects and pipes long-lived streams
date: 2026-06-12
evolution: 5
status: accepted
governs:
  - server/rtr.js
  - tests/unit/redir.test.js
  - tests/int/redir.test.js
---

# ADR-0011 — Proxy follows validated redirects and pipes long-lived streams

## Context

The E5 target portal 302-redirects `/live/<user>/<pass>/<id>.ts` to a
tokenized URL on another host (e.g. `http://185.66.88.8:8080/...?token=…`).
`runProxy` in `server/rtr.js` (ADR-0002) does not follow redirects, so the
browser's player engines — which must use the proxy because stream hosts
lack CORS headers — receive the 302 and fail. Live TS streams are also
unbounded and long-lived, and an abandoned playback must not leave the
upstream connection open.

## Decision

Extend the `/api/xtream` proxy in `server/rtr.js` to:

1. **Follow redirects** (301/302/303/307/308) up to **5 hops**, resolving
   relative `Location` headers against the current URL and re-validating
   every redirect target with the existing `isValidUrl` validation/blocklist
   before following; an invalid target → 400, more than 5 hops → 502.
2. **Pipe long-lived streams**: no response-size limit, no idle/total
   timeout on the piped body — bytes flow to the client as they arrive.
3. **Abort upstream on client disconnect**: when the client response
   closes, destroy the upstream request/response immediately.

ADR-0002 stays `accepted`; this decision extends its proxy behavior.

## Consequences

- Tokenized/redirected Xtream streams work through the proxy; existing API
  and M3U proxying is unchanged (non-redirecting responses take the same
  pipe path as today).
- The blocklist now also protects redirect targets (no SSRF via redirect).
- Slightly more complex proxy code; needs unit tests for hop counting,
  validation of targets, and disconnect cleanup, plus live integration
  proof against the real portal.

## Tasks derived

- TASK-0022 — Proxy redirect-following and stream piping

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0011` comment near the top.
