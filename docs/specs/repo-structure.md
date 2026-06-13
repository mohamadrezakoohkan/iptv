---
status: current
---

# Repository structure — product source & documentation layout

> Maintained by spec-agent. Describes WHERE product-owned artifacts live in the
> tree and the conventions that keep that layout coherent. It does not describe
> the orchestration harness layout — that is harness-owned (see `CLAUDE.md` /
> `CORE_FLOW.md`), out of scope for this spec.

## Intent

The repository separates **runtime/application source** from **generated
product documentation** under two dedicated top-level folders, while leaving the
orchestration harness, run-state directories, root product docs, run artifacts,
and tooling config where standard conventions and the harness expect them.

- `src/` holds everything the running product is made of — the HTML entry
  point, the client, the server, and **all of the product's tests**.
- `docs/` holds the product's generated documentation — the living
  specifications and the architecture decision records — plus a documented home
  for implementation notes.

This is a **pure structural relocation**: product behavior is unchanged. The
move preserves the relative positions of source files so server path resolution
and test relative-path references continue to work, and it updates every
tooling path reference (config globs, package scripts) and every documentation
path reference (ADR `governs:` lists and prose, `project.md`) so the app and
the full test suite keep working.

## Layout (the contract)

```
src/
  index.html              — product HTML entry point (served at "/")
  client/**               — vanilla-JS client modules + app.css
  server/**               — Express server (srv.js, rtr.js, cfg.js, hls.js)
  tests/
    unit/**               — Vitest unit suite
    ui/**                 — Playwright UI/e2e suite
    int/**                — Vitest integration suite (live network)
docs/
  specs/**                — living specifications, incl. specs/project.md
  adrs/**                 — architecture decision records (incl. TEMPLATE.md)
  notes/                  — implementation-notes home (see "Implementation notes")
```

Files that stay at the repository root (with internal path references updated
where needed):

- `package.json`, `package-lock.json` — Node manifest (tooling convention;
  `main` + `start` scripts updated to `src/server/srv.js`).
- `vitest.config.js`, `vitest.int.config.js`, `playwright.config.js` — test
  runner config (tooling convention; internal `include`/`testDir`/`webServer`
  paths updated to the `src/...` layout).
- `README.md`, `CHANGELOG.md` — root product docs (kept at root by explicit
  project decision; review-agent maintains them).
- `CONVENTIONS.md` — authored code-governing contract (not generated product
  documentation), kept at root.
- `test-results/` — run-artifact output (committed UI recordings/screenshots
  referenced from PRs); the UI suite writes here via `process.cwd()`.

Harness-owned files (`CLAUDE.md`, `CORE_FLOW.md`, `.claude/**`, `.github/**`),
together with the run-state directories `tasks/` and `failures/` and the parked
ideas in `BACKLOG.md`, are **not** product documentation and stay at the root.
Their references to the moved paths are updated out of band by the harness path
(coreflow-agent) — see "Harness coordination".

## Path-resolution invariants the move must preserve

1. **Server static + entry resolution.** `src/server/srv.js` computes
   `ROOT = path.join(__dirname, '..')`. With `server/`, `client/`, and
   `index.html` all under `src/`, `__dirname` is `src/server`, so `ROOT` is
   `src/`, and `express.static(ROOT/client)` + `sendFile(ROOT/index.html)`
   resolve to `src/client` and `src/index.html` with **no change to srv.js**.
2. **Client script URLs.** `src/index.html` loads client scripts and styles as
   server-route-absolute URLs (`/cfg.js`, `/app.css`, …) served off the static
   `client/` mount — not filesystem paths — so they remain correct after the
   move with no edit.
3. **Test relative references.** Unit and integration tests reach client/server
   source via `../../client/...` / `../../server/...` from `tests/{unit,int}/`.
   Moving `tests/` and `client/`/`server/` together under `src/` preserves those
   relative offsets, so the `require`/`readFileSync` paths stay correct with no
   edit. UI tests reach the product over HTTP (`baseURL`), and demo/screenshot
   artifacts are written to `process.cwd()/test-results` (root) — both unaffected.
4. **ADR ↔ code traceability.** Every accepted ADR's `governs:` paths must
   resolve to tracked files at the branch tip after the move. Each `governs:`
   entry is rewritten from `client/…`, `server/…`, `tests/…`, `index.html` to its
   `src/…` location. In-file `// ADR: ADR-NNNN` comments live inside the moved
   files and travel with them unchanged.

## Implementation notes

Implementation notes — short, durable engineering notes that accompany the
product documentation (e.g. gotchas, manual procedures, non-obvious rationale
that is too operational for an ADR and too detailed for the README) — live under
`docs/notes/`. A `docs/notes/README.md` documents the convention. No note
content is fabricated by this relocation; the directory is established as the
home so future notes have a defined place.

## Canonical commands (unchanged surface)

The canonical build/test commands in `docs/specs/project.md` keep working
because the config files stay at root. The only command-string change is the
server start path: `node src/server/srv.js` (was `node server/srv.js`),
reflected in `package.json` scripts, `playwright.config.js` `webServer.command`,
and `docs/specs/project.md`.

## Harness coordination (cross-PR dependency)

This relocation moves product files AND the product references to them. The
harness also references `specs/`, `adrs/`, and code paths (in `CLAUDE.md`,
`CORE_FLOW.md`, `.claude/agents/**`, `.claude/skills/**`,
`.claude/settings.json`, `.github/workflows/**`). Those harness references are
updated **out of band** by a companion `harness/…` PR (coreflow-agent), not by
this build run.

Consequence: on this build branch the harness is temporarily inconsistent
(e.g. `CLAUDE.md`'s directory map still says `specs/`). That is expected and
acceptable on the branch. The two PRs are **interdependent** and must merge
together, or the harness PR first; merging this build PR alone — or `main`
without the harness PR — would leave dangling harness references.
