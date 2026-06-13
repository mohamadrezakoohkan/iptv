---
id: TASK-0056
adr: ADR-0027
evolution: 17
status: pending
attempts: 0
depends_on: []
---

# TASK-0056 — Correct the Fly.io deployment bootstrap + config-consistency unit tests

## Goal

When this task is done, the `fly launch` bootstrap (`Dockerfile`, `fly.toml`,
`.dockerignore`) is corrected into a coherent, slim, deployable configuration
for the `teeatr` app, and a fast deterministic unit test
(`src/tests/unit/deploy.test.js`) parses those files plus `package.json` and
asserts the deployment invariants so drift can never ship silently. No product
source or behavior changes.

## Acceptance criteria

- [ ] **Port coherence.** `fly.toml` declares `http_service.internal_port = 8080`
      and an `[env]` table with `PORT = '8080'`; the `Dockerfile` declares
      `EXPOSE 8080`. All three agree, and the bound port (server reads
      `process.env.PORT || 3000`, so with `PORT=8080` it binds 8080) equals them.
- [ ] **App name preserved.** `fly.toml` keeps `app = 'teeatr'`.
- [ ] **Start command.** The Dockerfile `CMD` runs the `package.json` `start`
      script (`npm run start`, i.e. `node src/server/srv.js`) — unchanged from
      bootstrap; the test asserts it matches `package.json` `scripts.start`.
- [ ] **Single memory directive.** `fly.toml` `[[vm]]` declares exactly one of
      `memory` / `memory_mb`; the conflicting pair is resolved to
      `memory = '512mb'` (the `memory_mb = 256` line is removed).
- [ ] **Slim, secret-free `.dockerignore`.** Excludes at least `node_modules/`,
      `.env.secrets`, `.git`, `docs/`, `tasks/`, `failures/`, `test-results/`,
      `.playwright-out/`, `src/tests/`, `*.md`, and the test-runner configs
      (`vitest*.config.js`, `playwright.config.js`); does NOT exclude
      `src/client`, `src/server`, `src/index.html`, `package.json`, or
      `package-lock.json`. The Docker build must still succeed (proven by
      TASK-0057).
- [ ] **Health check.** `fly.toml` declares an `http_service` HTTP health check
      against path `/`.
- [ ] **Traceability.** `Dockerfile`, `fly.toml`, and `.dockerignore` each carry
      a `# ADR: ADR-0027` comment near the top; `src/tests/unit/deploy.test.js`
      carries `// ADR: ADR-0027`.
- [ ] `npx vitest run` passes, including the new `deploy.test.js`; the rest of
      the unit suite is unaffected.

## Test requirements

- **Unit:** `src/tests/unit/deploy.test.js` reads `fly.toml`, `Dockerfile`,
  `.dockerignore`, and `package.json` from the repo root and asserts every
  invariant above. Parse `fly.toml` with a tiny inline key/value reader or
  targeted regex — **do not add a TOML dependency** (ADR-0027). The assertions
  must be on the invariant (e.g. "the three ports are equal", "exactly one
  memory key present", "CMD == package start"), not hard-coded literals where a
  relationship is what matters, so the gate still protects future changes.
- **UI:** n/a — not user-facing (deployment configuration only).
- **Integration:** n/a here — the live build proof is TASK-0057's build-smoke
  tier. This task adds no external connectivity.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
