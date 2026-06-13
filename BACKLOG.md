# Backlog

## 2026-06-13 — Product-project memory file under docs/ that Claude references

**user input:** Add to backlog a new feature to keep Memory.md of the product project on the docs folder and use it as memory for claude that references

**assumptions:**
- "Memory.md" (exact filename/casing): a single file named `docs/MEMORY.md` (uppercase, matching the repo's existing `README.md`/`CHANGELOG.md` casing convention), not lowercase `Memory.md`.
- location within `docs/`: directly at the `docs/` root as `docs/MEMORY.md`, alongside `docs/specs/` and `docs/adrs/`, rather than nested under a new subfolder such as `docs/notes/`.
- scope of "product project" memory: this is product-project memory, distinct from the orchestrator's user-level auto-memory and from the harness `CLAUDE.md`/`CORE_FLOW.md`; it lives on the product side and is owned/maintained through the pipeline, not by backlog- or coreflow-agent.
- what it captures: durable product-project facts, decisions, and context that are NOT derivable from the source code or git history (e.g. domain vocabulary, product codename, cross-cutting conventions, rationale that would otherwise be re-discovered each session).
- how Claude "references" it: Claude reads `docs/MEMORY.md` as durable, authoritative project memory when working on the product, treating it as a context source to consult — leaving the exact wiring (e.g. a pointer from `CLAUDE.md`, automatic load, or an explicit read step) to be decided at build time.
- relationship to existing files: it complements rather than replaces `docs/specs/project.md`, ADRs, and the Evolution Log — capturing the "why/what-to-remember" that those structured artifacts do not.
