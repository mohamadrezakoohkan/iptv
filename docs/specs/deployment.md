---
status: current
---

# Deployment — Fly.io Docker container ("teeatr")

> Maintained by spec-agent. Describes HOW the product is deployed and the
> invariants the deployment artifacts must hold. Behavior of the product itself
> is unchanged by deployment; see `iptv-player.md` for product behavior.

## Intent

The IPTV Broadcast Console ships as a **Docker container on Fly.io**, app name
**`teeatr`**. The container runs the same Node.js + Express server that runs
locally (`node src/server/srv.js`), so production and local start identically
and both the **CORS proxy** (ADR-0002 / ADR-0011) and the **server-side TS→HLS
ffmpeg remux** (ADR-0012) work in production.

Fly/Docker is the deployment target precisely because those two features need a
long-running, stateful process with a writable filesystem and a spawnable native
`ffmpeg` binary — neither is possible on static hosting (GitHub Pages) or
edge/serverless platforms. See ADR-0027 for the full rationale.

## Deployment artifacts (the contract)

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage Node image: build stage runs `npm ci` (installs deps incl. `ffmpeg-static`); runtime stage copies the app, `EXPOSE`s the bound port, `CMD`s `npm run start`. |
| `fly.toml` | Fly app config: `app = 'teeatr'`, `http_service.internal_port` matching the bound port, `[env] PORT` setting the bound port, exactly one `[[vm]]` memory directive, and an HTTP health check on `/`. |
| `.dockerignore` | Excludes everything the runtime does not need (and all secrets) from the build context. |

## Invariants

These are enforced by the config-consistency unit test (permanent gate) and
proved end-to-end by the Docker build-smoke test.

1. **Port coherence.** The server binds `process.env.PORT || 3000`
   (`src/server/cfg.js`). The bound port (from `fly.toml` `[env] PORT`, falling
   back to 3000), the Dockerfile `EXPOSE`, and `fly.toml`
   `http_service.internal_port` must all be the same number. The shipped
   configuration binds **8080** (`[env] PORT = '8080'`, `EXPOSE 8080`,
   `internal_port = 8080`).
2. **App name.** `fly.toml` `app == 'teeatr'`.
3. **Start command.** The Dockerfile `CMD` runs the `package.json` `start`
   script (`node src/server/srv.js`) — not an ad-hoc command.
4. **Single memory directive.** `fly.toml` `[[vm]]` declares exactly one of
   `memory` / `memory_mb` (not both). The shipped value is `memory = '512mb'`
   (ffmpeg remux headroom; justified in ADR-0027).
5. **ffmpeg present.** `npm ci` in the build produces a resolvable
   `ffmpeg-static` binary inside the runtime image.
6. **Slim, secret-free image.** `.dockerignore` excludes `node_modules/`,
   `.env.secrets`, `.git`, `docs/`, `tasks/`, `failures/`, `test-results/`,
   `.playwright-out/`, `src/tests/`, `*.md`, and the test-runner configs, while
   keeping `src/client`, `src/server`, `src/index.html`, `package.json`, and
   `package-lock.json`.
7. **Health check.** `fly.toml` declares an `http_service` HTTP health check
   against `/`.

## Validation

Validation does **not** require deploying to Fly (no `fly` CLI in the build
environment; Docker is available).

| Tier | Command | What it proves |
|---|---|---|
| Unit (permanent gate) | `npx vitest run` (includes `src/tests/unit/deploy.test.js`) | All invariants 1–4, 6, 7 hold by parsing `fly.toml` / `Dockerfile` / `.dockerignore` / `package.json`. Fast, deterministic, no new dependency, no Docker. |
| Build-smoke (this-run proof) | `npx vitest run --config vitest.smoke.config.js` (runs `src/tests/smoke/docker.test.js`) | `docker build` succeeds; the container serves `/` (HTTP 200 + `<title>`); `ffmpeg-static` resolves inside the image (invariant 5). Skips cleanly when Docker is absent. |

The build-smoke tier is **isolated** to its own runner config so it never slows
or flakes the normal unit (`npx vitest run`) or integration
(`npx vitest run --config vitest.int.config.js`) suites. Validate-agent runs the
unit gate for every task and additionally runs the build-smoke command for the
build-smoke task (TASK-0057).

## Operating notes (for the human)

- Live deploy is the human's action: `fly deploy` (with the Fly CLI and an
  authenticated Fly account). The build environment performs no live deploy.
- Secrets (e.g. `PL_URL`, `EPG_URL` if used) are set via `fly secrets set …`,
  never baked into the image — `.dockerignore` keeps `.env.secrets` out of the
  build context.

## Demo

`No demo — deployment configuration, no user-facing change.` This run changes
deployment artifacts and tests only; product behavior is unchanged, so there is
no user-interactable behavior to record (CORE_FLOW.md §3, Demo recording scope
cutoff).

## Stacking note

This work is stacked on the `flyio-new-files` branch, which already contains the
merged E16 source/docs restructure (PRs #27 / #28) plus the human's `fly launch`
bootstrap. It depends on that lineage merging first (or together).
