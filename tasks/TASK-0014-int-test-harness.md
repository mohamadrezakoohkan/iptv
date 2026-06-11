---
id: TASK-0014
adr: ADR-0006
evolution: 3
status: pending
attempts: 0
depends_on: []
---

# TASK-0014 — Integration-test harness scaffolding + live proxy connectivity test

## Goal

The repository gains a runnable integration-test tier: `vitest.int.config.js`
(include `tests/int/**/*.test.js`, `testTimeout: 120000`, `hookTimeout:
120000`, `fileParallelism: false`), an npm script `test:int` in
`package.json`, and a first integration test `tests/int/proxy.test.js` that
boots the Express proxy in-process and proves it can fetch the live
`https://iptv-org.github.io/iptv/index.m3u` playlist. After this task,
`npx vitest run --config vitest.int.config.js` (the canonical command
already recorded in `specs/project.md`) executes a green suite when the
network is up.

## Acceptance criteria

- [ ] `vitest.int.config.js` exists at the repo root, CommonJS, includes
      only `tests/int/**/*.test.js`, sets `testTimeout` and `hookTimeout`
      to 120000 and `fileParallelism` to `false`, and carries
      `// ADR: ADR-0006` near the top.
- [ ] `npx vitest run` (the unit command) does NOT pick up any test under
      `tests/int/` — the unit suite remains network-free.
- [ ] `package.json` has a `test:int` script equal to
      `vitest run --config vitest.int.config.js`.
- [ ] `tests/int/proxy.test.js` builds a fresh `express()` app, mounts
      `server/rtr.js`, listens on port 0 (ephemeral), and closes the server
      in `afterAll` — no fixed ports, no child processes, no supertest.
- [ ] The test fetches
      `http://127.0.0.1:<port>/api/xtream?url=<encodeURIComponent(LIVE_URL)>`
      with native `fetch`, where `LIVE_URL` is the file-level constant
      `https://iptv-org.github.io/iptv/index.m3u`, and asserts: HTTP status
      200, and the response body's first non-empty line starts with
      `#EXTM3U`.
- [ ] The test also asserts the proxy still rejects invalid targets live:
      `GET /api/xtream?url=not-a-url` returns 400 with JSON `{ err }`
      (CONVENTIONS.md §8 error shape).
- [ ] `npx vitest run --config vitest.int.config.js` passes with live
      network, and the full unit (`npx vitest run`) and UI
      (`npx playwright test`) suites still pass.
- [ ] All new code follows CONVENTIONS.md (named functions, no `var`, `===`,
      no new dependencies, SCREAMING_SNAKE file-global constants).

## Test requirements

- **Unit:** none required beyond keeping the existing unit suite green —
  this task creates test infrastructure, not product logic. The acceptance
  criterion that `tests/int/` is excluded from the unit config is checked
  by running the unit suite and confirming no `tests/int` file executes.
- **UI:** n/a — not user-facing.
- **Integration:** `tests/int/proxy.test.js` as specified above — live
  fetch of the iptv-org playlist through the in-process proxy, plus the
  live invalid-URL rejection check.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
