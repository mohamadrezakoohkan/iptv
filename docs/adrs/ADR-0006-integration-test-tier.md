---
id: ADR-0006
title: Integration-test tier — Vitest separate config, in-process server, live network required
date: 2026-06-11
evolution: 3
status: accepted
governs:
  - vitest.int.config.js
  - src/tests/int/proxy.test.js
---

# ADR-0006 — Integration-test tier — Vitest separate config, in-process server, live network required

## Context

The harness defines three test tiers (CORE_FLOW.md §3 Canonical commands):
unit, UI, and integration. Evolution 1 established the unit command
(`npx vitest run`) and the UI command (`npx playwright test`) in
`specs/project.md`, but no integration command existed — `specs/project.md`
had no integration row, and `validate-agent` has been skipping that tier.

The E3 prompt — validate the engine can connect to and load
`https://iptv-org.github.io/iptv/index.m3u` streams — is the first work that
requires real-network tests, so this run must establish the tier: runner,
file layout, isolation from the unit suite, server-boot strategy, and the
canonical command.

Constraints:

- The unit suite must stay network-free and fast; integration tests must
  not leak into `npx vitest run` (its config includes only
  `tests/unit/**/*.test.js`, which already provides isolation — the
  integration tier needs its own include glob and its own config).
- CONVENTIONS.md §13 forbids utility libraries; Node ≥ 18 ships native
  `fetch`. No new dependencies (no supertest) are justified for booting and
  querying an Express app.
- `server/srv.js` exports `{ app, ST }` but calls `app.listen(CFG.port)` at
  require time — requiring it in a test would bind the fixed port 3000.
  `server/rtr.js` exports the bare router, mountable on a fresh app.
- The reference playlist is ~20 MB; concurrent test files would each
  download it, hammering the endpoint and slowing the suite.

## Decision

The integration tier is **Vitest with a dedicated config file**, no new
dependencies:

1. **Config**: `vitest.int.config.js` at the repo root (CommonJS, mirroring
   `vitest.config.js`), with `include: ['tests/int/**/*.test.js']`,
   `testTimeout: 120000`, `hookTimeout: 120000`, and `fileParallelism:
   false` (sequential files — one live download at a time).
2. **Layout**: integration tests live in `tests/int/`, sibling to
   `tests/unit/` and `tests/ui/`.
3. **Server boot**: each integration test file builds an in-process Express
   app — `require('../../server/rtr')`, mount on `express()`, `listen(0)`
   for an ephemeral port — and tears it down in `afterAll`. No child
   processes, no fixed ports, no supertest; requests go through Node's
   native `fetch` against `http://127.0.0.1:<port>`.
4. **Canonical command**: `npx vitest run --config vitest.int.config.js`,
   recorded in `specs/project.md`. An npm script alias `test:int` is added
   to `package.json` for humans; the canonical command remains the one in
   `specs/project.md`.
5. **Network policy**: the suite requires live outbound network and fails
   loudly when it is absent. No mocks, no conditional skips — a
   network-dead environment must produce a red suite, because detecting
   broken real-world connectivity is this tier's entire purpose.

## Consequences

**Easier:**
- `validate-agent` gains a real third tier to execute; regressions in proxy
  or M3U connectivity become visible per task from now on.
- Zero new dependencies; the config mirrors the existing unit config, so
  there is nothing new to learn.
- Ephemeral ports mean the integration suite can run while a dev server
  occupies port 3000.

**Harder:**
- The suite's verdict now depends on the public internet: an iptv-org or
  network outage fails validation runs even when the code is correct. This
  is accepted — the tier exists to measure exactly that path. (Per-channel
  stream churn is handled separately by ADR-0007's sampling policy.)
- Full-suite validation gets slower (multi-megabyte live downloads,
  sequential files).

**Ruled out:**
- supertest or any HTTP test library (native fetch suffices; §13 forbids
  utility libs).
- Spawning `node server/srv.js` as a child process (fixed port, slower,
  harder teardown).
- Mock-fallback or auto-skip on network failure (defeats the tier's
  purpose).
- A separate test runner (Jest, node:test) — one runner family keeps the
  toolchain small.

## Tasks derived

- TASK-0014 — Integration-test harness scaffolding + live proxy
  connectivity test

## Traceability

Every file listed in `governs:` must carry `// ADR: ADR-0006` near the top.
`package.json` (script alias) cannot carry comments and is linked from this
side only.
