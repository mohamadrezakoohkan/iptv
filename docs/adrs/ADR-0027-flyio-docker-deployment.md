---
id: ADR-0027
title: Deploy on Fly.io as a Docker container (app "teeatr"), keeping CORS proxy + ffmpeg remux
date: 2026-06-13
evolution: 17
status: accepted
governs:
  - Dockerfile
  - fly.toml
  - .dockerignore
  - src/tests/unit/deploy.test.js
  - src/tests/smoke/docker.test.js
  - vitest.smoke.config.js
---

# ADR-0027 — Deploy on Fly.io as a Docker container (app "teeatr"), keeping CORS proxy + ffmpeg remux

## Context

The product is a Node.js + Express server (ADR-0002) that does two things a
static host or an edge-serverless platform cannot do:

1. **A CORS proxy** (`/api/xtream`, ADR-0002) that follows validated redirects
   and **pipes unbounded, long-lived live streams** with no size or timeout cap,
   aborting upstream on client disconnect (ADR-0011). This needs a real,
   stateful, long-running process — not a per-request serverless function with
   an execution-time cap.
2. **A server-side TS→HLS remux fallback** (ADR-0012) that spawns **ffmpeg**
   (from the `ffmpeg-static` npm package) per source URL, holds per-session temp
   directories, reaps idle sessions, and serves the produced HLS segments. This
   needs a writable filesystem, a native binary in the runtime image, and a
   persistent process that outlives a single request.

Neither requirement is satisfiable on static hosting (GitHub Pages) or on
edge/serverless platforms whose functions are short-lived, lack a spawnable
ffmpeg binary, and cap response duration. A long-running container is the
correct shape, which is why **Fly.io running a Docker image** was chosen.

The human ran `fly launch`, which auto-generated a `Dockerfile`, a `fly.toml`
(app already named **`teeatr`**), and a `.dockerignore`. That bootstrap is a
starting point with several defects that would break or bloat a real deploy.
This ADR records the platform decision and the corrections, and defines how the
deployment is validated **without** a live Fly deploy (no `fly` CLI is available
in the build environment; Docker is).

## Decision

**Deploy `teeatr` as a Docker container on Fly.io.** Keep the Fly-generated
multi-stage `Dockerfile`, `fly.toml`, and `.dockerignore` as the basis, and
correct them so the running container serves the product with both the CORS
proxy and the ffmpeg remux working. The Fly app name stays **`teeatr`**.

The deployment artifacts are made internally consistent on these invariants:

1. **One coherent port.** The server binds `process.env.PORT || 3000`
   (`src/server/cfg.js`, ADR-0002). The bound port, the Dockerfile `EXPOSE`, and
   the Fly `http_service.internal_port` must all agree. **Chosen approach: keep
   `internal_port = 8080` and set `[env] PORT = '8080'` in `fly.toml`** so the
   server binds 8080, and set Dockerfile `EXPOSE 8080`. (8080 is Fly's
   conventional internal port; binding it via the documented `PORT` knob needs
   no code change.) The unit gate asserts these three agree regardless of which
   number is chosen, so the invariant — not the literal — is what is enforced.
2. **Exactly one memory directive.** The bootstrap `[[vm]]` declares both
   `memory = '1gb'` and `memory_mb = 256` — contradictory. Keep **one**:
   `memory = '512mb'`. ffmpeg stream-copy remux (ADR-0012, `-c copy`, near-zero
   CPU but real buffer/temp footprint with concurrent sessions) plus Node's
   baseline needs headroom; 256 MB is too tight, a full 1 GB is more than a
   stream-copy workload needs. 512 MB is the justified middle.
3. **A working ffmpeg binary in the image.** `npm ci` in the Docker build must
   produce a resolvable `ffmpeg-static` binary (its postinstall fetches the
   binary; `package.json` already whitelists it via `allowScripts`). The build
   smoke verification proves the binary resolves *inside the image*.
4. **A slim runtime image.** `.dockerignore` must exclude everything the runtime
   does not need (`.git`, `docs/`, `tasks/`, `failures/`, `test-results/`,
   `.playwright-out/`, `src/tests/`, harness files, `*.md`, test-runner configs,
   secrets) while keeping what it does (`src/client`, `src/server`,
   `src/index.html`, `package.json`, `package-lock.json`). `node_modules/` and
   `.env.secrets` must be excluded (secrets never enter the image; modules are
   installed fresh by `npm ci`).
5. **An HTTP health check.** Add a Fly `http_service` health check against `/`
   (the server serves `index.html` at `/`, ADR-0002), so Fly only routes to a
   machine once the app is actually serving.

The Dockerfile `CMD` runs the `package.json` `start` script
(`node src/server/srv.js`) — the same canonical run command as
`docs/specs/project.md`, so production and local start identically.

**Validation strategy (no Fly deploy required):**

- **Unit tier (permanent gate).** A config-consistency test
  (`src/tests/unit/deploy.test.js`) parses `fly.toml`, `Dockerfile`,
  `.dockerignore`, and `package.json` and asserts every invariant above:
  bound-port ⇔ `internal_port` ⇔ `EXPOSE` agree; `app == 'teeatr'`; the
  Dockerfile `CMD` runs the package `start`; exactly one memory directive;
  `.dockerignore` excludes secrets + `node_modules` and keeps the runtime dirs;
  the health check targets `/`. It runs in the normal `npx vitest run` gate,
  is fast and deterministic, and adds **no new dependency** — `fly.toml` is
  parsed with a tiny inline key/value reader, not a TOML library.
- **Build-smoke tier (this-run proof, Docker available).** A guarded smoke test
  (`src/tests/smoke/docker.test.js`) does a real `docker build`, runs the
  container, `curl`s `/` (expects HTTP 200 and a `<title>` in the body), and
  asserts the `ffmpeg-static` binary resolves *inside* the image
  (`node -e "const p=require('ffmpeg-static'); require('fs').accessSync(p)"`).
  It is **isolated to its own runner** (`vitest.smoke.config.js`,
  `include: src/tests/smoke/**`) so it does not slow or flake the normal unit or
  integration suites, and it **skips cleanly when Docker is absent** so the suite
  stays portable. Validate-agent runs it explicitly for the build-smoke task via
  `npx vitest run --config vitest.smoke.config.js`.

This run is **demo-exempt**: it changes deployment configuration only, with no
user-interactable product behavior change. The PR's `### Demo` section reads
`No demo — deployment configuration, no user-facing change`.

ADR-0002, ADR-0011, and ADR-0012 stay `accepted`; this decision packages the
existing server (proxy + remux) for a Fly.io container and adds no product
behavior.

## Consequences

**Easier:**
- One command (`fly deploy`, by the human) ships the full product — proxy and
  remux included — on a real long-running host.
- `internal_port` / `EXPOSE` / bound-port drift can no longer ship silently:
  the unit gate fails the build if they disagree.
- A slim image builds and ships faster and excludes secrets and harness files.

**Harder:**
- A native ffmpeg binary must be present in the runtime image; the build smoke
  test is the guard that it actually resolves there.
- The image and Fly config now have invariants that future changes must keep
  (the unit gate enforces them).

**Ruled out:**
- Static hosting (GitHub Pages) and edge/serverless deployment — neither can run
  the long-lived CORS proxy (ADR-0011) or spawn ffmpeg for the remux (ADR-0012).
- Adding a TOML-parsing dependency just to read `fly.toml` in a test — a tiny
  inline reader covers the few keys asserted.
- Requiring the `fly` CLI in the build/validation environment — validation is
  Docker-only and deterministic; the live deploy is the human's action.

## Tasks derived

- TASK-0056 — Correct the Fly.io deployment bootstrap + config-consistency unit
  tests
- TASK-0057 — Docker build-smoke verification (isolated, Docker-guarded)

## Traceability

Every file in `governs:` carries an `ADR: ADR-0027` reference near the top in
its native comment syntax (`#` for `Dockerfile` / `fly.toml` / `.dockerignore`,
`//` for the test and config files). `.dockerignore`, `Dockerfile`, and
`fly.toml` are also linked from this side.
