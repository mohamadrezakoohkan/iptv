---
id: TASK-0001
adr: ADR-0002
evolution: 1
status: done
attempts: 1
depends_on: []
---

# TASK-0001 — Project scaffolding

## Goal

A runnable Node.js + Express project exists: `package.json` declares all
runtime and dev dependencies; `server/cfg.js` holds the `CFG` object;
`server/srv.js` starts Express; `server/rtr.js` mounts static file serving
and the Xtream proxy route. Running `npm install && node server/srv.js`
serves `index.html` at `http://localhost:3000`. Unit and UI test commands
(`npx vitest run`, `npx playwright test`) execute (even if there are no tests
yet — suites can be empty at this point).

## Acceptance criteria

- [ ] `package.json` exists at project root with `name`, `version`, `main`,
      `scripts.start`, `scripts.test`, and dependency entries for `express`,
      `vitest`, and `@playwright/test`.
- [ ] `server/cfg.js` exports `CFG` with at minimum `port`, `timeout`,
      `maxChs` properties; reads from `process.env` where applicable; carries
      `// ADR: ADR-0002` comment.
- [ ] `server/srv.js` requires `express`, requires `rtr`, mounts static
      serving from `client/` and serves `index.html` at `/`; starts listening
      on `CFG.port`; carries `// ADR: ADR-0002` comment.
- [ ] `server/rtr.js` exports an Express router; mounts `GET /api/xtream`
      proxy route; validates that the `url` query param is a non-empty
      `http(s)://` URL with a non-localhost host (returns 400 otherwise);
      pipes the proxied response back; carries `// ADR: ADR-0002` comment.
- [ ] Proxy route rejects requests where the target host is `localhost` or
      `127.0.0.1` or `::1` (returns HTTP 400).
- [ ] `npx vitest run` exits 0 (empty suite is acceptable).
- [ ] `npx playwright test` exits 0 (empty suite is acceptable).
- [ ] `node server/srv.js` starts without error and responds to
      `GET /` with a non-empty body.

## Test requirements

- **Unit:** `server/rtr.js` proxy URL validation logic — test valid URLs pass,
  localhost URLs are rejected, missing `url` param returns 400, non-http
  scheme returns 400.
- **UI:** n/a — server scaffolding only, no user-facing rendering at this task.

## Implementation notes

Files created:
- `package.json` — declares express, vitest, @playwright/test; scripts.start and scripts.test present.
- `server/cfg.js` — CFG object with port, timeout, maxChs, maxPrgs, cacheMs, plUrl, epgUrl; reads from process.env.
- `server/rtr.js` — Express router; GET /api/xtream proxy with isValidUrl() validation; uses native http/https modules; exposes _isValidUrl for unit testing.
- `server/srv.js` — Express app; mounts rtr; serves client/ static + index.html catch-all at /; exports { app, ST }.
- `index.html` — placeholder HTML at project root.
- `client/` — directory created (empty; static assets land in later tasks).
- `vitest.config.js` — points test runner at tests/unit/.
- `playwright.config.js` — points Playwright at tests/ui/.
- `tests/unit/rtr.test.js` — 10 unit tests covering isValidUrl: valid http, valid https, undefined, empty string, ftp scheme, file scheme, localhost, 127.0.0.1, ::1 (IPv6), non-URL string.
- `tests/ui/placeholder.test.js` — single always-passing Playwright test to keep suite non-empty.

Non-obvious:
- `new URL('http://[::1]/api').hostname` returns `[::1]` (with brackets) in Node.js, not `::1`. BLOCKED_HOSTS includes both forms.
- The placeholder UI test exists because `npx playwright test` exits 1 with "No tests found"; a trivially-passing test keeps the command exit 0 per the acceptance criteria.

## Hot-fix notes (E2 branch, applied on top of original implementation)

**Bug 1 fixed — ERR_HTTP_HEADERS_SENT crash in server/rtr.js:**
- `onProxyErr` now checks `res.headersSent` before calling `res.status(502).json()`. When headers are already sent it calls `res.destroy()` and returns immediately, preventing the crash.
- Added `upstream.on('error', onUpErr)` inside `onProxyRes` to handle socket errors that surface after the upstream pipe has started. Guard is the same: only calls `res.destroy()` when headers are not yet sent.
- Exposed `runProxy` as `rtr._runProxy` to allow direct unit testing of the error-path callback.

**Bug 2 — no bug found in client/ui.js:**
- `onFail(msg)` at line 336 sets `EL.ferr.textContent = msg` verbatim; `runConn` calls `onFail(res.err)` which passes the raw error string. No duplication. No change made.

**New unit test added — tests/unit/rtr.test.js:**
- `describe('runProxy — headersSent guard')`: monkey-patches `http.request` in `beforeEach` to return a fake proxy object whose `.on('error', cb)` captures the callback. The test sets `mockRes.headersSent = true`, calls `runProxy`, triggers the captured error callback, then asserts `res.destroy` was called once and `res.status` was never called. Restored in `afterEach`.
