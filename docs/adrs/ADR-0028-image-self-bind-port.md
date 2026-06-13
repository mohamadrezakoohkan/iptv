---
id: ADR-0028
title: Harden the image to self-bind PORT 8080 by default (refines ADR-0027 port coherence)
date: 2026-06-13
evolution: 18
status: accepted
governs:
  - Dockerfile
  - src/tests/unit/deploy.test.js
  - src/tests/smoke/docker.test.js
---

# ADR-0028 — Harden the image to self-bind PORT 8080 by default (refines ADR-0027)

## Context

ADR-0027 made `teeatr`'s Fly.io deployment artifacts internally consistent and
chose **8080** as the one coherent port (server bind ⇔ `EXPOSE` ⇔
`internal_port` ⇔ `[env] PORT`). But the actual deploy still failed Fly health
checks: the running container logged `iptv srv listening on port 3000` while Fly
routed to `internal_port = 8080`, so every request got "connection refused."

Root cause: the server reads `Number(process.env.PORT) || 3000`
(`src/server/cfg.js`, ADR-0002), and the **image had no `PORT` set**. ADR-0027's
fix put `PORT = '8080'` in `fly.toml` `[env]`, which is correct *on Fly* — but it
makes the bound port depend entirely on the platform config. The image as built
still binds 3000 by default: any plain `docker run …` (no `-e PORT`), any other
platform, or a `fly.toml` that loses or mistypes the `[env]` block silently
reverts to 3000 and breaks again.

ADR-0027 left the bind correct **only because** `fly.toml` supplies `PORT`. The
defect is that the runtime image is not self-sufficient. This ADR refines the
port-coherence decision so the **image itself** binds 8080 out of the box,
independent of `fly.toml`, Fly secrets, or the host — the app stays env-driven
(any explicit `PORT` still overrides), but the *default* baked into the image is
now correct.

ADR-0027 stays `accepted` and continues to own the broader Fly deployment
decision (app name, memory, ffmpeg, slim image, health check, validation
strategy). This ADR refines only its port invariant; the two are read together.

## Decision

**Bake `ENV PORT=8080` into the Dockerfile `base` stage** so the final runtime
image (`FROM base`) inherits it and `node src/server/srv.js` binds 8080 with no
external env supplied. `EXPOSE 8080` and `CMD ["npm","run","start"]` are kept
unchanged.

No change to `src/server/*`: the app already reads `process.env.PORT` (ADR-0002)
and `app.listen(port)` already binds all interfaces — only the *default value*
in the image was wrong, and it is now supplied by the image's own environment
rather than relying on the platform. An explicit `PORT` at run time (e.g. Fly's
`[env] PORT`, or `docker run -e PORT=…`) still overrides the baked default, so
the app remains fully env-driven.

**The port-coherence invariant is widened from 3 members to 4.** ADR-0027
asserted `internal_port` ⇔ `[env] PORT` ⇔ Dockerfile `EXPOSE` agree. This ADR
adds the Dockerfile `ENV PORT` to that set, so the config-consistency unit test
now asserts **all four agree**:

```
Dockerfile ENV PORT  ==  Dockerfile EXPOSE  ==  fly.toml internal_port  ==  fly.toml [env] PORT  ==  8080
```

The invariant — not the literal `8080` — is what is enforced: change the number
in one place without the others and the gate fails. With the image self-binding,
the bound port no longer depends on `fly.toml` to be correct.

**The build-smoke test is changed to prove self-bind.** ADR-0027's smoke test
ran the container *with* `-e PORT=8080`, which only proved the app honours an
externally supplied `PORT` — it could not have caught the original 3000 defect.
This ADR runs the container **without** `-e PORT` (relying solely on the image's
`ENV PORT=8080`), still mapping an ephemeral host port to `8080`, and asserts
HTTP 200 + `<title>` on `/`. That is the real proof the hardening works: a bare
`docker run` of the image serves on 8080. The `docker build`, the
`ffmpeg-static` `FFMPEG_OK` resolution check, the Docker-availability skip guard,
and the container + image teardown are all kept.

`vitest.smoke.config.js` is unchanged.

This run is **demo-exempt**: it changes deployment configuration and tests only,
with no user-interactable product behavior change. The PR's `### Demo` section
reads `No demo — deployment configuration, no user-facing change`.

## Consequences

**Easier:**
- A bare `docker run teeatr` (or any platform deploy) binds 8080 correctly with
  no external env — the image is self-sufficient and the original
  "listening on 3000 / routed to 8080" failure cannot recur.
- The port invariant is now anchored in the image, not only in `fly.toml`: even
  if the `[env] PORT` block is lost, the image still binds 8080.
- The smoke test now actually proves the thing that broke in production (default
  self-bind), instead of only proving env-override works.

**Harder:**
- One more member in the port-coherence set: changing the deployment port now
  means updating four places (Dockerfile `ENV PORT`, Dockerfile `EXPOSE`,
  `fly.toml internal_port`, `fly.toml [env] PORT`). The unit gate enforces this,
  so drift fails fast rather than shipping silently.

**Ruled out:**
- Hardcoding the port in `src/server/*` — the app stays env-driven (ADR-0002);
  the correct default belongs in the image environment, not the source.
- Relying on `fly.toml [env] PORT` alone for a correct bind (the ADR-0027 state)
  — it is platform-coupled and was the proximate cause of the failed deploy.
- Removing `fly.toml [env] PORT` — it is kept as the explicit, documented Fly
  knob and as a member of the coherence set; the image default and the Fly env
  agree on 8080.

## Relationship to ADR-0027

This ADR **refines** ADR-0027's port-coherence invariant (its invariant #1).
ADR-0027 remains `accepted` and continues to own the rest of the Fly.io Docker
deployment decision. ADR-0027 chose the coherent port (8080) across the Fly
config and the Dockerfile `EXPOSE`; this ADR adds the Dockerfile `ENV PORT` to
that coherent set so the image self-binds, and updates the two deploy tests
accordingly. Read both together; neither supersedes the other.

## Tasks derived

- TASK-0058 — Bake `ENV PORT=8080` into the image and widen the port-coherence
  invariant to prove self-bind (Dockerfile `ENV`, 4-way unit invariant,
  no-`-e PORT` build-smoke).

## Traceability

Every file in `governs:` carries an `ADR: ADR-NNNN` reference near the top in
its native comment syntax. `Dockerfile` (`#`) and the two test files (`//`)
already carry `ADR: ADR-0027`; implement-agent adds `ADR-0028` to those markers
(comma-separated on one line per CORE_FLOW.md §3) so each file references both
the deployment decision and this refinement.
