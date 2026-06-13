---
id: TASK-0055
adr: ADR-0026
evolution: 16
status: pending
attempts: 0
depends_on: [TASK-0054]
---

# TASK-0055 — Relocate `specs/` and `adrs/` under `docs/`, rewire references, establish notes home

## Goal

After this task, the generated product documentation lives under a top-level
`docs/` folder — `docs/specs/**` (6 files incl. `project.md`) and `docs/adrs/**`
(26 files incl. `TEMPLATE.md`) — and every documentation reference to the moved
product source/test paths reflects the `src/...` layout established in
TASK-0054. A `docs/notes/` directory exists as the documented home for
implementation notes. ADR ↔ code traceability holds: every accepted ADR's
`governs:` paths resolve to tracked files at the branch tip.

## Acceptance criteria

- [ ] `./specs/` and `./adrs/` no longer exist at the repository root; their
      content is at `docs/specs/` and `docs/adrs/` respectively, with git
      history preserved (relocate via `git mv`). The two new files authored this
      run (`docs/specs/repo-structure.md`, `docs/adrs/ADR-0026-…`) already sit
      under `docs/` and are not moved.
- [ ] Every ADR's `governs:` frontmatter that listed `client/…`, `server/…`,
      `tests/…`, or `index.html` now lists the corresponding `src/…` path
      (e.g. `client/ui.js` → `src/client/ui.js`, `tests/unit/api.test.js` →
      `src/tests/unit/api.test.js`, `index.html` → `src/index.html`). No
      `governs:` entry still points at a root-level moved path.
- [ ] ADR prose path references (e.g. "`client/app.css`", "`server/rtr.js`",
      "`tests/int/m3u.test.js`", "`index.html`") are updated to their `src/…`
      forms for accuracy.
- [ ] `docs/specs/project.md` file-structure/where-code-lives references reflect
      the `src/...` layout, and its server-start command reads
      `node src/server/srv.js`. The canonical unit/UI/integration test commands
      are unchanged (configs remain at root). `project.md`'s "Feature specs"
      list points at `specs/...`-relative entries that still resolve under
      `docs/specs/`.
- [ ] `docs/notes/` exists with a `docs/notes/README.md` documenting the
      implementation-notes convention. No note content is fabricated.
- [ ] ADR ↔ code traceability holds at the branch tip (CORE_FLOW.md §3): every
      non-deleted ADR's `governs:` paths resolve to tracked files under `src/…`
      (or root, for configs/`package.json`), and those code files carry their
      `ADR:` comments (which travelled inside the moved files).
- [ ] The full unit, UI, and integration suites still pass (regression gate —
      relocating docs must not affect runtime, but validate-agent runs them).

## Test requirements

- **Unit:** no new unit tests; this task moves documentation only. The existing
  full unit suite must remain green (proves nothing in `src/` regressed).
- **UI:** no new UI tests; no user-facing behavior changes. The existing full UI
  suite must remain green. Demo-exempt: pure documentation relocation, no
  user-interactable behavior.
- **Integration:** no new integration tests; the existing full integration suite
  must remain green.

## Implementation notes

- Prefer `git mv` for the `specs/` and `adrs/` relocations. Land the
  reference-rewiring (ADR `governs:` + prose, `project.md`) in the SAME task so
  the committed state is coherent.
- Mechanically rewrite `governs:` entries: prefix `client/`, `server/`,
  `tests/` with `src/`, and rewrite the bare `index.html` entry to
  `src/index.html`. Leave non-path entries and already-`src/`/root entries (e.g.
  `package.json` if present) alone.
- This is bookkeeping/relocation of product documentation — do not change any
  ADR's decision content, only its path references.
- Do NOT touch any harness-owned file (`CLAUDE.md`, `CORE_FLOW.md`,
  `.claude/**`, `.github/**`) — the harness's references to `docs/`/`src/` move
  out of band via a companion `harness/…` PR (coreflow-agent). The branch will
  be temporarily harness-inconsistent; that is expected (ADR-0026).
- `tasks/`, `failures/`, `README.md`, `CHANGELOG.md`, `CONVENTIONS.md`,
  `BACKLOG.md` stay at root and are not edited by this task.
- Depends on TASK-0054 so the `src/...` paths the rewired references point at
  already exist.
