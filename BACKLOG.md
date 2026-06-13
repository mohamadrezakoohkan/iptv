# Backlog

## 2026-06-13 — Reorganize repo into harness/ and src/ top-level folders

**user input:** move harness files and folders to harness/ folder where adrs specs and generated product and project docs can be found and src/ folder where actual coded project will be found

**assumptions:**
- "harness files and folders": the orchestration-process artifacts and the documentation/decision artifacts they produce — `CORE_FLOW.md`, `CLAUDE.md`, `.claude/` (agents, skills, hooks, settings), plus `specs/`, `adrs/`, `tasks/`, `failures/`, `BACKLOG.md`, `CHANGELOG.md`, and `README.md`; assumed to be consolidated under a top-level `harness/` folder.
- "adrs specs and generated product and project docs": the existing `adrs/`, `specs/` (including `specs/project.md`), and any generated product/project documentation (e.g. `README.md`, `CHANGELOG.md`) move under `harness/`; treated as relocation of existing artifacts, not authoring new docs.
- "src/ folder where actual coded project will be found": all runtime/application source and its tests move under a top-level `src/` folder; assumed this is purely a relocation of existing code, leaving behavior unchanged.
- "move": a structural relocation that updates every path reference (build/test commands in `specs/project.md`, ADR `governs:` paths, agent and skill instructions, settings deny-rules, CI workflow paths) so the harness and tooling keep working after the move — not a raw `git mv` that breaks references.
- scope/ownership: this restructure spans both harness-owned files (routed via coreflow-agent) and product-owned files (the pipeline), so the build run will need to coordinate both; left to the run to sequence — this is a parked idea only.
- ".claude/ location": left open whether `.claude/` (tool-specific config Claude Code expects at repo root) physically moves under `harness/` or stays at root with only the docs/process artifacts relocated, since moving it may break tool discovery — flagged for the build run to decide.
