---
id: TASK-0057
adr: ADR-0027
evolution: 17
status: done
attempts: 0
depends_on: [TASK-0056]
---

# TASK-0057 — Docker build-smoke verification (isolated, Docker-guarded)

## Goal

When this task is done, an isolated build-smoke test
(`src/tests/smoke/docker.test.js`, run via its own `vitest.smoke.config.js`)
proves the corrected deployment artifacts actually produce a working runtime
image: it builds the Docker image, runs the container, confirms the product
serves `/` over HTTP, and confirms the `ffmpeg-static` binary resolves inside
the image. The test skips cleanly when Docker is unavailable, so the suite stays
portable, and it is isolated from the unit and integration runners so it never
slows or flakes them.

## Acceptance criteria

- [ ] `vitest.smoke.config.js` exists at the repo root,
      `include: ['src/tests/smoke/**/*.test.js']`, with timeouts generous enough
      for a real `docker build` + container run (e.g. `testTimeout` and
      `hookTimeout` ≥ 300000, `fileParallelism: false`), and carries
      `// ADR: ADR-0027`.
- [ ] `src/tests/smoke/docker.test.js` (carries `// ADR: ADR-0027`):
      - Detects Docker (`docker --version` / daemon reachable); if absent, the
        suite **skips** (e.g. `describe.skip` / `it.skip`) with a clear message
        — it must not fail when Docker is missing.
      - Builds the image from the repo `Dockerfile`
        (`docker build -t teeatr-smoke .`).
      - Runs the container mapping the bound port, then `curl`s / fetches `/`
        and asserts **HTTP 200** and that the body contains `<title>`.
      - Asserts the ffmpeg binary resolves inside the image by running, inside
        the container, `node -e "const p=require('ffmpeg-static');
        require('fs').accessSync(p)"` and expecting exit code 0.
      - Tears down: stops/removes the container (and ideally the image) in an
        `afterAll`/`finally` so repeated runs stay clean.
- [ ] Running `npx vitest run --config vitest.smoke.config.js` in this
      Docker-available environment **passes** (build succeeds, `/` returns 200 +
      `<title>`, ffmpeg resolves).
- [ ] The normal `npx vitest run` (unit) and
      `npx vitest run --config vitest.int.config.js` (integration) suites do NOT
      pick up `src/tests/smoke/**` — confirmed by their `include` globs.
- [ ] ADR-0027 `governs:` lists `src/tests/smoke/docker.test.js` and
      `vitest.smoke.config.js` (already seeded; implement-agent trues it up).

## Test requirements

- **Unit:** n/a — this task *is* the smoke verification; its logic is the test.
  (The config invariants are unit-tested in TASK-0056.)
- **UI:** n/a — not user-facing.
- **Integration:** the build-smoke test itself is the live proof (it exercises a
  real Docker build + running container + HTTP fetch). It is kept in its own
  `src/tests/smoke/` tier with its own config so the standard integration
  regression gate (`vitest.int.config.js`) stays fast and network-only.
  Validate-agent runs `npx vitest run --config vitest.smoke.config.js` for this
  task in addition to the standard unit/UI/integration suites.

## Validation commands (exact, for validate-agent)

- Permanent gate (all tasks): `npx vitest run`
- UI gate (all tasks): `npx playwright test`
- Integration gate (all tasks): `npx vitest run --config vitest.int.config.js`
- Build-smoke (this task only): `npx vitest run --config vitest.smoke.config.js`

## Implementation notes

**Files created (both carry `ADR: ADR-0027`):**

- `vitest.smoke.config.js` (repo root, sibling of `vitest.int.config.js`) —
  CommonJS `defineConfig`, `include: ['src/tests/smoke/**/*.test.js']` ONLY,
  `testTimeout`/`hookTimeout` = 600000, `fileParallelism: false`. Not referenced
  by `vitest.config.js` (unit, include `src/tests/unit/**`) or
  `vitest.int.config.js` (integration, include `src/tests/int/**`), so the smoke
  tier is fully isolated.
- `src/tests/smoke/docker.test.js` — the build-smoke proof. ESM `import` test
  body (matches the `src/tests/int/**` convention; configs stay CommonJS).
  Node built-ins only (`child_process`, `http`, `net`) — no new dependency.

**Test structure:**

- **Docker guard.** Module-level `execSync('docker info', …)` in a try/catch
  sets `dockerOk`; on failure it logs `Docker unavailable — skipping
  build-smoke: …` and `itDocker = it.skip`, and the `beforeAll`/`afterAll`
  early-return. The suite therefore skips cleanly (never fails) when the daemon
  is unreachable. `docker info` returns a non-zero exit when the daemon is down,
  so it is a correct guard.
- **Build (`beforeAll`).** `docker build -t teeatr-smoke:test .` from the repo
  root (respects `.dockerignore`); then an ephemeral free host port is picked
  via `net.createServer().listen(0)` and the container is started detached with
  `-e PORT=8080 -p <ephemeral>:8080` (mirrors `fly.toml` `[env] PORT=8080` /
  `internal_port=8080`).
- **ffmpeg proof.** A throwaway `docker run --rm` runs `node -e` that
  `require('ffmpeg-static')` + `fs.accessSync(p, fs.constants.X_OK)` and prints
  `FFMPEG_OK:<path>`; the test asserts the output contains `FFMPEG_OK:` — proof
  the postinstall binary landed and is executable, i.e. the ADR-0012 remux
  fallback will work on Fly.
- **HTTP smoke.** Polls `http://127.0.0.1:<port>/` until ready (30s budget),
  asserts HTTP 200 and the body contains `<title`.
- **Router-mounted proof.** Same-origin `GET /api/xtream` (a real mounted route)
  with no `url` query returns `400 { err }` *before* any outbound request,
  proving `rtr.js` is mounted ahead of the `index.html` catch-all (no live
  external network involved).
- **Cleanup (`afterAll`).** `docker rm -f` the container and `docker rmi -f` the
  image, each in its own try/catch so teardown runs even on failure. Verified:
  no `teeatr-smoke` container or image remains after a run.

**Self-verification (Docker available):**

- The environment had Docker Desktop installed but the daemon was not running
  (socket absent → `docker info`/`docker version` exit 1). Started it with
  `open -a Docker` and polled until the daemon was reachable, then ran the
  suite for real.
- `npx vitest run --config vitest.smoke.config.js` → 3 passed (image built,
  `FFMPEG_OK`, HTTP 200 + `<title`, `/api/xtream` 400 `{ err }`), container +
  image cleaned up.
- `npx vitest run` (unit gate) → 602 passed / 27 files, unaffected — the smoke
  file is not in its `include`.

**Scope:** only `vitest.smoke.config.js` and `src/tests/smoke/docker.test.js`
created. `fly.toml`/`Dockerfile`/`.dockerignore` (TASK-0056) and application
`src/` source untouched. ADR-0027 `governs:` already lists both new files — no
ADR edit needed; the in-file `ADR: ADR-0027` markers are present.

**Note for reviewers:** the Dockerfile's `apt-get install build-essential …`
step pulls Debian's Node 18 as a node-gyp dependency in the build stage, but the
runtime base remains `node:22.21.1-slim` (the `CMD` runs under Node 22). This is
TASK-0056's Dockerfile (out of scope here) and the smoke test passes against it.
