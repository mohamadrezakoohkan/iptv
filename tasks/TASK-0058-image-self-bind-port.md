---
id: TASK-0058
adr: ADR-0028
evolution: 18
status: pending
attempts: 0
depends_on: []
---

# TASK-0058 — Bake `ENV PORT=8080` into the image and prove self-bind

## Goal

When this task is done, the runtime Docker image binds **8080 by default with no
external env**: a bare `docker run` of the image (no `-e PORT`) serves `/` on
8080. This is achieved by baking `ENV PORT=8080` into the Dockerfile `base`
stage so the final runtime image (`FROM base`) inherits it. `src/server/*` is
unchanged (the app already reads `process.env.PORT`, ADR-0002, and `app.listen`
already binds all interfaces — only the image's default `PORT` was missing). The
config-consistency unit test is widened to a **4-way** port-coherence invariant
and the build-smoke test is changed to start the container **without** `-e PORT`,
proving the self-bind. This fixes the deployed-container failure where the app
logged "listening on port 3000" while Fly routed to 8080.

## Acceptance criteria

- [ ] `Dockerfile` `base` stage sets `ENV PORT=8080` (e.g. immediately after
      `ENV NODE_ENV="production"`), so the final image (`FROM base`) inherits it;
      `EXPOSE 8080` and `CMD ["npm","run","start"]` are unchanged.
- [ ] `Dockerfile` carries an `ADR:` marker referencing **both** ADR-0027 and
      ADR-0028 (comma-separated on one line per CORE_FLOW.md §3).
- [ ] `src/server/*` is **not** modified (no source change — the app stays
      env-driven; an explicit `PORT` still overrides the baked default).
- [ ] `src/tests/unit/deploy.test.js` port-coherence test asserts all **four**
      members agree and equal 8080: Dockerfile `ENV PORT` == Dockerfile `EXPOSE`
      == `fly.toml internal_port` == `fly.toml [env] PORT`. (Reads the Dockerfile
      `ENV PORT` value with an inline reader, no new dependency.)
- [ ] All existing `deploy.test.js` invariants still pass unchanged: `app ==
      'teeatr'`, exactly one `[[vm]]` memory directive, `CMD` ↔ package `start`,
      slim/secret-free `.dockerignore`, and the `/` health check.
- [ ] `src/tests/smoke/docker.test.js` runs the container **without** `-e PORT`
      (relying on the image's `ENV PORT=8080`), still `-p <ephemeral>:8080`, and
      asserts the container serves `/` with HTTP 200 and `<title` in the body.
- [ ] The build-smoke test keeps: the real `docker build`, the `ffmpeg-static`
      `FFMPEG_OK` resolution/executable check, the Docker-availability guard
      (whole suite skips cleanly when the daemon is down), and the container +
      image teardown in `afterAll`.
- [ ] Both `deploy.test.js` and `docker.test.js` carry an `ADR:` marker
      referencing both ADR-0027 and ADR-0028.
- [ ] ADR-0028 `governs:` paths all exist and each governed file references
      ADR-0028 (traceability holds).

## Test requirements

- **Unit:** `src/tests/unit/deploy.test.js` — extend the port-coherence
  invariant to the 4-way set including the Dockerfile `ENV PORT`; assert all
  four equal 8080. Keep every other existing invariant assertion. Runs in the
  standard `npx vitest run` gate.
- **UI:** n/a — not user-facing (deployment configuration only; demo-exempt per
  ADR-0028).
- **Integration:** n/a — no external connectivity. The Docker build-smoke
  (`npx vitest run --config vitest.smoke.config.js`) is the end-to-end proof of
  self-bind: it builds the image, runs it with no `-e PORT`, and asserts a 200
  on `/` over 8080. It is Docker-guarded and skips cleanly when the daemon is
  absent.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._

Hints for the implementer:
- The current Dockerfile `base` stage (lines ~6–14) ends with
  `ENV NODE_ENV="production"`. Add `ENV PORT=8080` right after it. Do not add a
  second `FROM base` `ENV` — `base` is inherited by both `build` and the final
  stage.
- In `deploy.test.js`, the existing `EXPOSE` value is read with
  `DOCKER.match(/(?:^|\n)\s*EXPOSE\s+([0-9]+)/)`. Read the `ENV PORT` similarly,
  e.g. `DOCKER.match(/(?:^|\n)\s*ENV\s+PORT[= ]['"]?([0-9]+)/)` — handle both
  `ENV PORT=8080` and `ENV PORT 8080` / quoted forms. Then assert the four
  numbers are mutually equal (and, since the invariant fixes the shipped value,
  equal to 8080).
- In `docker.test.js`, the `beforeAll` currently runs
  `docker run -d --name ${CTR} -e PORT=${PORT} -p ${hostPort}:${PORT} ${TAG}`.
  Drop the `-e PORT=${PORT}` so the container relies on the image's baked
  `ENV PORT`. The `-p ${hostPort}:${PORT}` mapping (8080 internal) stays. The
  `/` 200 + `<title>` assertion is unchanged but now proves self-bind. The
  ffmpeg `--rm` throwaway-container check and the teardown are unchanged.
- `vitest.smoke.config.js` is unchanged.
