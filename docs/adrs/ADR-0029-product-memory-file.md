---
id: ADR-0029
title: Keep a durable product-project memory file at docs/MEMORY.md, referenced from product docs
date: 2026-06-15
evolution: 18
status: accepted
governs:
  - docs/MEMORY.md
  - docs/specs/product-memory.md
  - docs/specs/project.md
  - src/tests/unit/memory.test.js
---

# ADR-0029 — Keep a durable product-project memory file at `docs/MEMORY.md`, referenced from product docs

## Context

The E18 prompt (consumed from the top `BACKLOG.md` item) asks to "keep a
Memory.md of the product project in the docs folder and use it as memory that
Claude references." The backlog entry resolved the ambiguous terms: a single
uppercase file `docs/MEMORY.md` at the `docs/` root; product-project memory
distinct from the orchestrator's user-level auto-memory and from the harness
`CLAUDE.md` / `CORE_FLOW.md`; capturing durable facts NOT derivable from source
or git history; referenced as authoritative project memory to consult.

Constraints carried in from the project's current state and the harness:

- The repository already separates product source (`src/`) from product
  documentation (`docs/`) per ADR-0026; `docs/` holds `specs/`, `adrs/`, and
  `notes/`. A memory file at the `docs/` root fits that layout.
- `docs/notes/` (ADR-0026) is for **per-task operational implementation notes**;
  it is not durable cross-cutting project memory, so memory is a distinct file.
- **Separation of powers (CORE_FLOW.md §2):** `CLAUDE.md` and `CORE_FLOW.md` are
  harness-owned — only coreflow-agent may edit them. The "wiring" by which the
  reference is established therefore cannot edit those files in this product
  build run; it must live on the product side.
- The project already has durable, code-non-derivable facts worth remembering
  (e.g. the product codename / Fly.io app name), confirming the file is useful
  from day one rather than an empty placeholder.

## Decision

Adopt a single durable product-project memory file at **`docs/MEMORY.md`** and
wire its reference entirely on the product side.

1. **The file.** Create `docs/MEMORY.md` at the `docs/` root (uppercase, matching
   `README.md` / `CHANGELOG.md` casing). It is a Markdown document with a header
   explaining what it is and how to use it (durable product-project memory to be
   consulted by any contributor, human or AI), an explicit boundary section
   (what belongs here vs. in specs / ADRs / `README.md` / `CHANGELOG.md` /
   `docs/notes/`), and topical entries seeded with the durable, code-non-derivable
   facts already known to be true. The full file contract is in
   `docs/specs/product-memory.md`.

2. **Product-side reference mechanism.** The "Claude references it" requirement
   is satisfied without touching any harness file:
   - `docs/specs/project.md` (the single source of truth for what the product is,
     spec-agent-owned) gains a **Product memory** section pointing at
     `docs/MEMORY.md`.
   - `README.md` (review-agent-owned) names `docs/MEMORY.md` as the product's
     durable project memory in its pointers section. review-agent makes that edit
     at REVIEW (the README is not edited by spec- or implement-agent).

3. **Harness-side reference is explicitly out of scope.** This run does NOT edit
   `CLAUDE.md` or `CORE_FLOW.md`. A harness-side pointer (e.g. instructing agents
   to read `docs/MEMORY.md` at the start of product work) is captured as a future
   harness change for coreflow-agent, not done here.

4. **Ownership.** `docs/MEMORY.md` is product-owned and maintained through the
   pipeline. It is not owned by backlog-agent or coreflow-agent.

## Consequences

- **Easier:** durable, code-non-derivable project context is captured once and
  consulted again; contributors are pointed at one authoritative place for it;
  the separation between memory, specs, ADRs, notes, and changelog is explicit.
- **Harder / cost:** another product-doc surface to keep truthful; the
  product-side reference cannot be a hard automatic load (that would require a
  harness edit), so the reference is documentation pointers, not enforced wiring.
- **Ruled out:** lowercase `Memory.md`; nesting under a new `docs/notes/`-style
  subfolder; editing `CLAUDE.md` / `CORE_FLOW.md` from a product build run;
  duplicating spec/ADR/changelog content into the memory file.

## Tasks derived

- TASK-0061 — Create `docs/MEMORY.md` with the header, boundary section, and
  seeded durable facts; add the product-side reference from
  `docs/specs/project.md`; cover the file contract with a unit test.

## Traceability

`docs/MEMORY.md`, `docs/specs/product-memory.md`, and `docs/specs/project.md`
are Markdown and are linked from this ADR's `governs:` side only (Markdown
carries no native ADR comment in the way code does, per CORE_FLOW.md §3). The
unit test `src/tests/unit/memory.test.js` carries an `// ADR: ADR-0029` comment.
The `README.md` pointer is written by review-agent at REVIEW and is not listed in
`governs:` (review-agent-owned). When a change removes the last governed code,
this ADR is marked `status: deleted` — the file itself is never removed.
