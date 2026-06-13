---
id: TASK-0056
adr: ADR-0027
evolution: 17
status: done
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

**Files touched:**
- `fly.toml` — added `# ADR: ADR-0027`; added `[env]` table with `PORT = '8080'`
  so `src/server/cfg.js` (`Number(process.env.PORT) || 3000`) binds 8080 to
  match `internal_port = 8080`; resolved the conflicting memory pair by keeping
  `memory = '512mb'` and removing `memory_mb = 256` (kept `cpu_kind`/`cpus`);
  added an `[[http_service.checks]]` HTTP health check (`method = 'get'`,
  `path = '/'`, `interval = '15s'`, `timeout = '5s'`, `grace_period = '10s'`).
- `Dockerfile` — added `# ADR: ADR-0027`; changed `EXPOSE 3000` → `EXPOSE 8080`.
  Multi-stage build, plain `npm ci` (no `--ignore-scripts`, so `ffmpeg-static`'s
  postinstall runs and the binary lands in the image), and
  `CMD [ "npm", "run", "start" ]` are unchanged — TASK-0057 proves the binary
  resolves inside the image.
- `.dockerignore` — added `# ADR: ADR-0027` header; kept the original exclusions
  (`node_modules/`, `.env.secrets`, `.DS_Store`, `.claude/settings.local.json`,
  `.claude/worktrees/`, `.playwright-out/`) and added the slimming exclusions
  (`.git`, `.github/`, `.claude/`, `docs/`, `tasks/`, `failures/`, `src/tests/`,
  `test-results/`, the root `*.md` docs, and the test-runner configs incl.
  `vitest.smoke.config.js`). Does NOT exclude `src/client`/`src/server`/
  `src/index.html`/`package.json`/`package-lock.json`.
- `src/tests/unit/deploy.test.js` (new, `// ADR: ADR-0027`) — config-consistency
  unit test. Parses `fly.toml`/`Dockerfile`/`.dockerignore` with small inline
  regex helpers (no TOML dependency) and `package.json` with `JSON.parse`, all
  read from the repo root via `import.meta.url`. Asserts the invariants:
  `app == 'teeatr'`; port coherence (`internal_port` == `[env] PORT` == Dockerfile
  `EXPOSE`, and the bound port equals them); exactly one `[[vm]]` memory directive
  (`memory` present, `memory_mb` absent); Dockerfile `CMD` runs the package `start`
  script and `scripts.start === 'node src/server/srv.js'`; `.dockerignore` excludes
  `node_modules` and `.env.secrets` and does NOT exclude the runtime files; a
  health check with `path = '/'` exists.

**Non-obvious:** the port-coherence test asserts the *relationship* (the three
values are equal and the bound port equals them) rather than the literal 8080,
so the gate keeps protecting future port changes. ADR-0027 `governs:` already
listed all four files (`deploy.test.js` was a planned path, now created) — no
`governs:` change needed. TASK-0057's two planned paths
(`src/tests/smoke/docker.test.js`, `vitest.smoke.config.js`) are intentionally
left for that task.

**Verification:** `npx vitest run` passes — 27 files, 602 tests, including the
10 new `deploy.test.js` tests; rest of the unit suite unaffected.
