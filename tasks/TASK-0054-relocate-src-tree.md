---
id: TASK-0054
adr: ADR-0026
evolution: 16
status: pending
attempts: 0
depends_on: []
---

# TASK-0054 — Relocate product source tree under `src/` and rewire tooling

## Goal

After this task, all runtime/application source and its tests live under a
top-level `src/` folder — `src/index.html`, `src/client/**`, `src/server/**`,
`src/tests/{unit,ui,int}/**` — and the tooling that references them
(`package.json` scripts, the three test-runner configs) points at the new
locations. The product runs and the **full** unit, UI, and integration suites
pass, with behavior unchanged. This is a pure relocation; no product logic or
test assertions change.

## Acceptance criteria

- [ ] `./index.html`, `./client/`, `./server/`, `./tests/` no longer exist at
      the repository root; their content is at `src/index.html`, `src/client/`,
      `src/server/`, `src/tests/` respectively, with git history preserved
      (relocate via `git mv`, not delete+recreate).
- [ ] The relative layout is preserved: `src/server/`, `src/client/`,
      `src/index.html` are siblings, and `src/tests/{unit,ui,int}/` sit two
      levels below the source they reference.
- [ ] `package.json` `"main"` and `"start"` both point at `src/server/srv.js`;
      `npm start` / `node src/server/srv.js` boots the server and serves the
      app (static client + `/` entry) correctly.
- [ ] `vitest.config.js` `include` is `src/tests/unit/**/*.test.js`;
      `npx vitest run` discovers and runs the unit suite, all green.
- [ ] `vitest.int.config.js` `include` is `src/tests/int/**/*.test.js`;
      `npx vitest run --config vitest.int.config.js` discovers and runs the
      integration suite (live network) and passes.
- [ ] `playwright.config.js` `testDir` is `./src/tests/ui` and
      `webServer.command` is `node src/server/srv.js`; `npx playwright test`
      discovers and runs the UI suite, all green.
- [ ] `src/server/srv.js` is **unchanged** (its `ROOT = __dirname/..` resolves
      to `src/`, so static-client and index.html still resolve) — verify, do not
      edit unless verification proves otherwise.
- [ ] No source/test file's internal `require`/`readFileSync` paths needed
      editing (the `../../client|server/...` offsets are preserved); confirm by
      the suites passing.

## Test requirements

- **Unit:** no new unit tests. The existing full unit suite
  (`npx vitest run`, now from `src/tests/unit/`) must pass unchanged — it is the
  regression gate proving the relocation kept client behavior intact.
- **UI:** no new UI tests. The existing full Playwright suite
  (`npx playwright test`, now from `src/tests/ui/`, booting `node
  src/server/srv.js`) must pass unchanged — it proves the server still serves
  the relocated client and entry point. This relocation changes no
  user-interactable behavior, so no demo recording is required (demo-exempt:
  pure structural relocation).
- **Integration:** no new integration tests. The existing full integration
  suite (`npx vitest run --config vitest.int.config.js`, now from
  `src/tests/int/`) must pass unchanged — it proves the server proxy + engine
  paths are intact after the move.

## Implementation notes

- Prefer `git mv` for every relocation so history follows the files. Land the
  config/script reference updates in the SAME task so the committed state is
  never broken mid-task (validate-agent runs the full suites).
- `package.json` is comment-less JSON — it is linked from ADR-0026's `governs:`
  only; do not add a comment to it.
- Update only `vitest.config.js` (`include`), `vitest.int.config.js`
  (`include`), `playwright.config.js` (`testDir` + `webServer.command`), and
  `package.json` (`main`, `start`). Their `ADR:` comments (configs already
  carry `// ADR: ADR-0002` / `// ADR: ADR-0006`) stay; ADR-0026 is linked from
  its `governs:` list — true up `governs:` as files actually land.
- Do NOT touch `.gitignore` unless a concrete ignored glob breaks (verified: the
  current globs are `process.cwd()`-relative and stay correct).
- Do NOT touch any harness-owned file (`CLAUDE.md`, `CORE_FLOW.md`,
  `.claude/**`, `.github/**`) — the harness's references move out of band.
