---
id: ADR-0026
title: Relocate product source under src/ and product documentation under docs/
date: 2026-06-13
evolution: 16
status: accepted
governs:
  - src/index.html
  - src/client/
  - src/server/
  - src/tests/
  - package.json
  - vitest.config.js
  - vitest.int.config.js
  - playwright.config.js
  - docs/specs/
  - docs/adrs/
  - docs/notes/
---

# ADR-0026 — Relocate product source under `src/` and product documentation under `docs/`

## Context

The prompt (E16, from a refined `BACKLOG.md` entry) asks to reorganize the
repository so that all runtime/application source and its tests live under a
top-level `src/` folder, and the generated product documentation (`specs/`
including `specs/project.md`, and `adrs/`) lives under a top-level `docs/`
folder, with a documented home for implementation notes. This must be a pure
relocation — behavior unchanged — that updates **every** path reference so the
app and tooling keep working, never a raw `git mv` that breaks references.

Constraints carried in from the project's current state:

- `server/srv.js` resolves the static client dir and HTML entry from
  `ROOT = path.join(__dirname, '..')` (see ADR-0002). Preserving the relative
  positions of `server/`, `client/`, and `index.html` under `src/` keeps that
  resolution correct with no code change.
- All 25 ADRs (+ the ADR `TEMPLATE.md`) carry `governs:` frontmatter listing
  code/test paths; ADR ↔ code traceability (CORE_FLOW.md §3) requires those
  paths to resolve to tracked files after the move.
- Unit/integration tests reference source via `../../client/...` /
  `../../server/...`; UI tests use HTTP `baseURL` and write artifacts to
  `process.cwd()/test-results`.
- The harness references the same `specs/`/`adrs/`/code paths but is owned by
  coreflow-agent and updated out of band (see "Cross-PR dependency").

## Decision

Adopt the following **locked target layout** (recorded verbatim so a parallel
agent can mirror it exactly). Relocations use `git mv` to preserve history, with
the dependent reference updates landed in the same task so no committed state is
ever broken mid-task.

```
src/
  index.html              (moved from ./index.html)
  client/**               (moved from ./client/)
  server/**               (moved from ./server/)
  tests/{unit,ui,int}/**  (moved from ./tests/)
docs/
  specs/**                (moved from ./specs/ — 6 files incl. project.md)
  adrs/**                 (moved from ./adrs/ — 26 files incl. TEMPLATE.md)
  notes/                  (NEW: implementation-notes home; notes/README.md
                           documents the convention — no note content fabricated)
ROOT — UNCHANGED location, references updated:
  package.json, package-lock.json
  vitest.config.js, vitest.int.config.js, playwright.config.js   (internal globs/paths updated)
ROOT — UNCHANGED entirely (do NOT move, do NOT alter):
  README.md, CHANGELOG.md, CONVENTIONS.md, BACKLOG.md
  tasks/, failures/, test-results/
  .claude/, .github/, CLAUDE.md, CORE_FLOW.md, .gitignore, .env.secrets.example
```

Reference updates required (the relocation is only correct when these all land):

- **`package.json`**: `"main"` and `"start"` → `src/server/srv.js`.
- **`vitest.config.js`**: `include` → `src/tests/unit/**/*.test.js`.
- **`vitest.int.config.js`**: `include` → `src/tests/int/**/*.test.js`.
- **`playwright.config.js`**: `testDir` → `./src/tests/ui`; `webServer.command`
  → `node src/server/srv.js`.
- **All ADR `governs:` lists**: every `client/…`, `server/…`, `tests/…`,
  `index.html` entry → its `src/…` location; ADR prose path references updated
  for accuracy.
- **`docs/specs/project.md`**: file-structure/path references and the
  server-start command (`node src/server/srv.js`) updated.

Reference updates **NOT** required (verified — the move preserves the offset):

- `src/server/srv.js` — `ROOT = __dirname/..` still resolves to `src/`.
- `src/index.html` — client assets are server-route-absolute URLs.
- Unit/int test `../../client|server/...` requires — relative offset preserved.
- `.gitignore` — ignored globs (`.playwright-out/`, `node_modules/`,
  `test-results` artifacts) are written relative to `process.cwd()` (root).

### Rationale for the "unchanged" calls

- **`CONVENTIONS.md`** is an authored code-governing contract, not generated
  product documentation, and was not named in scope → stays at root.
- **`README.md` / `CHANGELOG.md`** stay at root by explicit human instruction.
- **`test-results/`** is run-artifact output referenced from PRs and written via
  `process.cwd()` → stays at root.
- **Config files** stay at root per tooling convention, with internal paths
  updated.
- **`tasks/`, `failures/`, `BACKLOG.md`, `.claude/`, `.github/`, `CLAUDE.md`,
  `CORE_FLOW.md`** are harness/run-state, not product documentation → stay at
  root (harness references handled out of band).

## Consequences

- **Easier:** a clean separation between runnable product (`src/`) and product
  documentation (`docs/`); a defined home for implementation notes.
- **Harder / cost:** a large diff touching every source/test file path and every
  ADR; a temporarily-inconsistent harness on this branch until the companion
  harness PR merges.
- **Ruled out:** keeping product source and tests scattered at the root level.

### Cross-PR dependency (CRITICAL)

This build PR relocates product files + product references. A companion
`harness/…` PR (coreflow-agent) updates the **harness's** references to `docs/`
and `src/` (`CLAUDE.md`, `CORE_FLOW.md`, `.claude/agents/**`,
`.claude/skills/**`, `.claude/settings.json`, `.github/workflows/**`). The two
PRs are **interdependent** and must merge **together** (or the harness PR
first), or `main` breaks. Because the harness references move out of band, this
build branch carries a temporarily-inconsistent harness (e.g. `CLAUDE.md`'s
directory map still says `specs/`) — expected and acceptable on the branch,
reconciled when both PRs merge. This build run does NOT edit any harness-owned
file.

### Traceability after the move

ADR ↔ code traceability (CORE_FLOW.md §3) must still hold at the branch tip:
every accepted ADR's rewritten `governs:` paths must resolve to tracked files,
and in-file `ADR: ADR-NNNN` comments (which travel inside the moved files)
continue to point back. The move tasks verify this before concluding.

## Tasks derived

- TASK-0054 — Relocate product source tree under `src/` and rewire tooling
  (package.json, vitest/playwright configs); full suite green.
- TASK-0055 — Relocate `specs/` and `adrs/` under `docs/`, rewire all ADR
  `governs:` paths + prose, `project.md` references, and establish
  `docs/notes/` implementation-notes home; traceability holds.

## Traceability

Every file/dir in `governs:` must carry (or, for the moved code files, already
carries inside them) an `ADR: ADR-NNNN` comment in native comment syntax;
comment-less formats like JSON (`package.json`) and Markdown docs are linked
from this side only. When a change removes the last governed code, this ADR is
marked `status: deleted` — the file itself is never removed; it is history.
