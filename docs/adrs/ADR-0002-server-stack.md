---
id: ADR-0002
title: Server stack — Node.js + Express, static serving, Xtream CORS proxy
date: 2026-06-11
evolution: 1
status: accepted
governs:
  - src/server/srv.js
  - src/server/rtr.js
  - src/server/cfg.js
---

# ADR-0002 — Server stack — Node.js + Express, static serving, Xtream CORS proxy

## Context

The client-side `IptvApi.connect()` implementation in the design makes direct
`fetch()` calls from the browser to third-party Xtream portal URLs. Most
real-world IPTV portals do not emit CORS headers, so browser fetch calls will
be blocked by the same-origin policy. The design acknowledges this in its
error messages: "many portals block browser requests (CORS). Type 'demo' to
try a sample playlist."

A server-side proxy solves this without any changes to the client API
contract: the client sends its Xtream requests to `/api/xtream/*` on the same
origin, and the server re-issues them to the third-party URL on the client's
behalf.

The project also needs a static file server to deliver `index.html`,
`client/*.js`, `client/app.css`, and the Google Fonts / hls.js CDN assets.

CONVENTIONS.md §3 already defines the server module map:
`cfg.js → rtr.js → srv.js` with `srv.js` as the Express entry point.

Node.js + Express 4 is the conventional, minimal choice for this workload.
No ORM, no templating, no heavy framework is needed: the server is purely a
static file host + thin HTTP proxy. CommonJS `require()` is used (not ESM)
because CONVENTIONS.md does not mention ESM and the project targets Node ≥ 18
without a build step.

## Decision

The server is **Node.js + Express 4 + CommonJS** with two responsibilities:

1. **Static files**: serve `index.html` (project root) and `client/` directory
   via `express.static`.
2. **Xtream proxy** (`/api/xtream?url=<encoded>&…`): decode the target URL from
   the query string, forward the request with `node-fetch` (or built-in
   `fetch` on Node ≥ 18), stream the response back to the browser. This
   removes the CORS restriction from the client entirely.

`server/cfg.js` holds the single `CFG` object (port, timeout, maxChs, etc.)
and reads from `process.env`. No other server file reads `process.env`.

`server/rtr.js` mounts all HTTP routes. `server/srv.js` creates the Express
app, mounts `rtr`, and starts listening.

No authentication, session management, or database is needed at this
evolution.

## Consequences

**Easier:**
- Browser CORS errors are eliminated for real Xtream portals.
- A single `node server/srv.js` command starts the complete product.
- Server is trivially testable with `supertest` + Vitest.

**Harder:**
- The proxy endpoint must validate and sanitize the target URL to prevent
  open-proxy abuse (only allow URLs matching the `http(s)://` scheme with a
  non-localhost host). This is an acceptance criterion for TASK-0001.
- Streaming large M3U playlist files through the proxy requires piping
  response bodies, not buffering (use `pipe()` or stream passthrough).

**Ruled out:**
- ESM (`import`/`export`) on the server — CommonJS only.
- Any database or persistent server-side state beyond the in-memory `ST`.
- Authentication on the proxy endpoint (the proxy is localhost-only in
  practice; CORS protection is the browser's job on public deployments).

## Tasks derived

- TASK-0001 — Project scaffolding (package.json, server/cfg.js, server/srv.js,
  server/rtr.js, static file serving, proxy route)

## Traceability

Every file listed in `governs:` must carry `// ADR: ADR-0002` near the top.
