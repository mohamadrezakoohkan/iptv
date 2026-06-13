# Backlog

## 2026-06-13 — Reorganize repo into docs/ and src/ top-level folders

**user input:** move generated product documentation (specs, implementation notes, adrs) into a `docs/` folder, and the actual coded project into a `src/` folder. `docs/` is for product documentation only — NOT the harness engine, which stays where it is. `README.md` and `CHANGELOG.md` stay at the repo root.

**assumptions:**
- "docs/": holds the generated **product documentation** — `specs/` (including `specs/project.md`), `adrs/`, and implementation notes — consolidated under a top-level `docs/` folder. Treated as relocation of existing artifacts, not authoring new docs (an "implementation notes" home may be new if no such doc exists yet).
- "README.md and CHANGELOG.md stay at root": these remain at the repo root at their current level, NOT moved into `docs/`.
- "NOT the harness engine": the orchestration engine and its operational state stay at the repo root, unmoved — `CORE_FLOW.md`, `CLAUDE.md`, `.claude/` (agents, skills, hooks, settings), plus `tasks/`, `failures/`, and `BACKLOG.md`. These are process/engine artifacts, not product documentation.
- "src/ folder where actual coded project will be found": all runtime/application source and its tests move under a top-level `src/` folder; assumed this is purely a relocation of existing code, leaving behavior unchanged.
- "move": a structural relocation that updates every path reference (build/test commands in `specs/project.md`, ADR `governs:` paths, agent and skill instructions, settings deny-rules, CI workflow paths) so the harness and tooling keep working after the move — not a raw `git mv` that breaks references.
- scope/ownership: this restructure spans both harness-owned files that *reference* the moved paths (routed via coreflow-agent) and product-owned files (the pipeline), so the build run will need to coordinate both; left to the run to sequence — this is a parked idea only.
- ".claude/ location": `.claude/` stays at the repo root (tool-specific config Claude Code expects there) — it is part of the harness engine, not product docs, and moving it risks breaking tool discovery.
