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
| `Dockerfile` | Multi-stage Node image: build stage runs `npm ci` (installs deps incl. `ffmpeg-static`); runtime stage copies the app, sets `ENV PORT` so the image self-binds the port with no external env (ADR-0028), `EXPOSE`s the bound port, `CMD`s `npm run start`. |
| `fly.toml` | Fly app config: `app = 'teeatr'`, `http_service.internal_port` matching the bound port, `[env] PORT` setting the bound port, exactly one `[[vm]]` memory directive, and an HTTP health check on `/`. |
| `.dockerignore` | Excludes everything the runtime does not need (and all secrets) from the build context. |

## Invariants

These are enforced by the config-consistency unit test (permanent gate) and
proved end-to-end by the Docker build-smoke test.

1. **Port coherence (4-way).** The server binds `process.env.PORT || 3000`
   (`src/server/cfg.js`). Four declarations must all be the same number:
   the Dockerfile `ENV PORT` (baked into the image — ADR-0028), the Dockerfile
   `EXPOSE`, `fly.toml` `http_service.internal_port`, and `fly.toml` `[env]
   PORT`. The shipped configuration binds **8080** in all four
   (`ENV PORT=8080`, `EXPOSE 8080`, `internal_port = 8080`, `[env] PORT =
   '8080'`). See the PORT binding subsection below for why the Dockerfile `ENV`
   is the load-bearing member.
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

## PORT binding — the image self-binds 8080 (ADR-0028)

The server reads `Number(process.env.PORT) || 3000` (`src/server/cfg.js`,
ADR-0002). The original Fly deploy failed health checks because the image had no
`PORT` set: the container bound the 3000 default while Fly routed to 8080
(`internal_port`), so every request got "connection refused." ADR-0027 fixed the
bind on Fly via `[env] PORT = '8080'`, but that made a correct bind depend
entirely on `fly.toml` — a bare `docker run` (no `-e PORT`), another platform, or
a lost `[env]` block would silently revert to 3000.

ADR-0028 hardens the **image itself**: `ENV PORT=8080` is baked into the
Dockerfile `base` stage, so the final runtime image (`FROM base`) inherits it
and `node src/server/srv.js` binds 8080 with **no external env**. The app stays
env-driven — an explicit `PORT` at run time (Fly's `[env] PORT`, or
`docker run -e PORT=…`) still overrides the baked default — but the image's
*default* is now correct out of the box. `src/server/*` is unchanged; only the
default value supplied to the env was wrong, and it now lives in the image
environment rather than relying on the platform.

This is why port coherence is a **4-way** invariant (invariant 1): the Dockerfile
`ENV PORT` joins `EXPOSE`, `fly.toml internal_port`, and `fly.toml [env] PORT`,
all four equal to 8080. The Dockerfile `ENV` is the load-bearing member — it is
what makes the image self-sufficient; the Fly env agrees with it but is no longer
the only thing keeping the bind correct.

## Validation

Validation does **not** require deploying to Fly (no `fly` CLI in the build
environment; Docker is available).

| Tier | Command | What it proves |
|---|---|---|
| Unit (permanent gate) | `npx vitest run` (includes `src/tests/unit/deploy.test.js`) | All invariants 1–4, 6, 7 hold by parsing `fly.toml` / `Dockerfile` / `.dockerignore` / `package.json` — including the **4-way** port coherence (Dockerfile `ENV PORT` ⇔ `EXPOSE` ⇔ `internal_port` ⇔ `[env] PORT`, ADR-0028). Fast, deterministic, no new dependency, no Docker. |
| Build-smoke (this-run proof) | `npx vitest run --config vitest.smoke.config.js` (runs `src/tests/smoke/docker.test.js`) | `docker build` succeeds; the container — started **with no `-e PORT`**, relying on the image's `ENV PORT=8080` (ADR-0028) — serves `/` (HTTP 200 + `<title>`) on 8080, proving the image self-binds; `ffmpeg-static` resolves inside the image (invariant 5). Skips cleanly when Docker is absent. |

The build-smoke tier is **isolated** to its own runner config so it never slows
or flakes the normal unit (`npx vitest run`) or integration
(`npx vitest run --config vitest.int.config.js`) suites. Validate-agent runs the
unit gate for every task and additionally runs the build-smoke command for the
build-smoke / self-bind task (TASK-0058 this run; first established in
TASK-0057).

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

The E17 work (ADR-0027, the deployment artifacts + tests) is stacked on the
`flyio-new-files` lineage, which already contains the merged E16 source/docs
restructure (PRs #27 / #28) plus the human's `fly launch` bootstrap. The E18
image self-bind refinement (ADR-0028) is in turn stacked on the E17 branch
(`ai/e17-flyio-deploy`, PR #30). The whole stack — E16 → flyio bootstrap → E17 →
E18 — merges together, in order.
