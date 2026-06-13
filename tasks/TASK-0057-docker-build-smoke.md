---
id: TASK-0057
adr: ADR-0027
evolution: 17
status: pending
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

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
