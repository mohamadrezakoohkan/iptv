---
id: TASK-0055
adr: ADR-0026
evolution: 16
status: done
attempts: 1
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

### Implementation record (attempt 1)

- **Relocations (`git mv`, history preserved):** all 6 specs moved
  `specs/* → docs/specs/*` (`empty-states.md`, `integration-testing.md`,
  `iptv-player.md`, `project.md`, `spacing-sizing.md`, `theme.md`); all 26 ADRs
  moved `adrs/* → docs/adrs/*` (ADR-0001…ADR-0025 + `TEMPLATE.md`). Empty root
  `specs/` and `adrs/` directories removed (`rmdir`); both gone from root.
  `docs/specs/repo-structure.md` and `docs/adrs/ADR-0026-…` (this run's new
  files) were left in place, not moved or clobbered.
- **ADR `governs:` rewrite:** 24 ADRs had path prefixes rewritten
  (`client/→src/client/`, `server/→src/server/`, `tests/→src/tests/`,
  `index.html→src/index.html`). Config/package entries (`vitest.int.config.js`,
  `package.json`) and the empty `governs: []` (ADR-0018) were left unchanged.
  `TEMPLATE.md` placeholder and ADR-0026 untouched. Verified: no `governs:`
  entry still points at a root-level moved path, and all 144 accepted-ADR
  `governs:` entries resolve to tracked files at the branch tip.
- **`docs/specs/project.md`:** build/run command → `node src/server/srv.js`;
  added a "Where the code lives" section describing the `src/`+`docs/` layout;
  added a note that config/`package.json` stay at root; rewrote the Feature
  specs list from `specs/<file>.md` to bare sibling filenames so the links
  resolve within `docs/specs/`. Canonical test commands left unchanged.
- **Cross-references in moved specs:** rewrote 10 filesystem-relative
  `` `specs/<file>.md` `` references to `` `docs/specs/<file>.md` `` across
  `empty-states.md`, `theme.md`, `integration-testing.md`, `iptv-player.md` so
  they resolve under the new layout. The two `` `specs/` `` / `` `adrs/` ``
  mentions in `repo-structure.md` are deliberate harness-state narrative (the
  cross-PR-dependency note) and were left as-is.
- **`docs/notes/`:** created `docs/notes/README.md` documenting the
  implementation-notes convention (what belongs / what does not / naming). No
  note content fabricated. Carries an `ADR: ADR-0026` comment.
- **`CONVENTIONS.md` (stays at root):** updated the directory-layout
  illustration to nest `server/`+`client/` under `src/` and to point
  `specs/`→`docs/specs/`, `adrs/`→`docs/adrs/`; updated the sibling-layer import
  rule to `src/server/* cannot import src/client/*`. All token/conceptual
  content left intact.
- **Regression checks:** `node src/server/srv.js` boots ("iptv srv listening on
  port 3000"); full unit suite collects and passes (`npx vitest run` → 26 files,
  592 tests, all green). Doc relocation did not touch any `src/` code/test or
  config file.
- **Scope held:** no edits to `README.md`, `CHANGELOG.md`, `tasks/` content
  (besides this status/record), `failures/`, `test-results/`, `src/**`, config
  files, `package.json`, or any harness-owned file (`.claude/**`, `CLAUDE.md`,
  `CORE_FLOW.md`, `.github/**`). The out-of-scope `test-results/*.webm|*.png`
  byte-regenerations from a prior UI run were left unstaged and untouched.
- **Prose path mentions in historical ADR bodies left as narrative:** per the
  task's functional-gate scope, source-path mentions inside the historical ADR
  bodies (`docs/adrs/*` prose) are point-in-time history and were not rewritten
  — the functional gate is `governs:` resolution, which is satisfied.

### Implementation record (attempt 1 follow-up — living-spec prose accuracy)

Closed the prose-accuracy gap flagged above, but ONLY for LIVING feature specs
(historical ADR bodies remain as written — point-in-time history, `governs:`
already trued up). Substituted filesystem-style backticked prose path
references to the new `src/...` layout:

- `docs/specs/iptv-player.md` (6 mentions): L249 `` `client/api.js` `` →
  `` `src/client/api.js` ``; L250 `` `server/rtr.js` `` → `` `src/server/rtr.js` ``;
  L354 `` `client/play.js` `` → `` `src/client/play.js` ``; L360 `` `index.html` ``
  → `` `src/index.html` ``; L389 `` `server/hls.js` `` + `` `server/rtr.js` `` →
  `` `src/server/hls.js` `` + `` `src/server/rtr.js` ``; L410 `` `client/st.js` ``
  → `` `src/client/st.js` ``.
- `docs/specs/theme.md` (5 mentions): L41 `` `client/app.css` ``, L44
  `` `index.html` ``, L50 `` `client/cfg.js` ``, L54 `` `client/st.js` ``, L82
  `` `client/main.js` `` → their `src/…` forms.
- `docs/specs/spacing-sizing.md` (3 mentions): L26 `` `client/app.css` `` + L27
  `` `index.html` ``, L31 `` `client/app.css` `` → their `src/…` forms.
- `docs/specs/integration-testing.md` (1 mention): L108
  `` `tests/int/**/*.test.js` `` → `` `src/tests/int/**/*.test.js` ``.
- `docs/specs/empty-states.md` and `docs/specs/project.md`: no filesystem-style
  `client/`/`server/`/`tests/`/`index.html` prose mentions (project.md's
  "where the code lives" was already on the `src/` layout from attempt 1).

`docs/specs/repo-structure.md` — the NEW spec describing the restructure — was
read mention-by-mention and left UNCHANGED: every `client/`/`server/`/`tests/`/
`index.html` mention there is either ROOT-relative resolution mechanics
("`express.static(ROOT/client)`", "`../../client/...`"), a description of the
directory entries that sit under `src/` ("`server/`, `client/`, and
`index.html` all under `src/`"), or explicit before→after migration narrative
("rewritten from `client/…`, `server/…`, `tests/…`, `index.html` to its
`src/…` location"). None wrongly describes the current/target repo-root layout,
so the before→after narrative was preserved intact.

Out of scope and untouched: historical ADR bodies, `governs:` frontmatter
(already done), config/package files, `src/` files, README, CHANGELOG, harness
files. `test-results/` byte-noise left unstaged. Unit suite re-run after the
edits: `npx vitest run` → 26 files, 592 tests, all green (documentation-only
change, no runtime impact). No commit; task stays `validating`.
