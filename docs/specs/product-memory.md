---
status: current
---

# Product memory — `docs/MEMORY.md`

> Maintained by spec-agent. Describes WHAT the product-project memory file is,
> what it captures, and how it is referenced. It does not describe the
> orchestration harness's own memory (`CLAUDE.md`, `CORE_FLOW.md`, the
> orchestrator's user-level auto-memory) — that is harness-owned and out of
> scope for this product spec.

## Intent

The product project keeps a single durable memory file, `docs/MEMORY.md`, that
records the **product-project facts, decisions context, and conventions that are
NOT derivable from the source code or git history** — the "why / what to
remember" that the structured artifacts (`docs/specs/`, `docs/adrs/`, the
Evolution Log) do not by themselves make obvious. Anyone (human or AI) working
on the product treats `docs/MEMORY.md` as authoritative, durable project memory
to consult, so that context which would otherwise be re-discovered each session
is captured once and read again.

This is **product-side** memory. It is distinct from, and complementary to:

- the orchestrator's user-level auto-memory (harness-owned, lives outside the
  product tree),
- the harness contract in `CLAUDE.md` / `CORE_FLOW.md` (harness-owned, defines
  *how* work happens),
- the living specs (`docs/specs/`, *what* the product does),
- the architecture decision records (`docs/adrs/`, the decisions and their
  rationale),
- the Evolution Log (`CHANGELOG.md`, *what changed when*).

`docs/MEMORY.md` does not replace any of those; it captures the durable
cross-cutting facts they do not.

## Location & naming

- The file lives at **`docs/MEMORY.md`** — directly at the `docs/` root,
  alongside `docs/specs/` and `docs/adrs/`, not nested under a subfolder.
- The filename is uppercase `MEMORY.md`, matching the repository's existing
  root-doc casing convention (`README.md`, `CHANGELOG.md`).

## What it captures

Durable product-project memory — facts that stay true across sessions and that
are not obvious from reading the code or the git log. For example:

- **Domain vocabulary** — terms and acronyms specific to this product's domain
  whose meaning is not self-evident from the code.
- **Product codename / identity facts** — names and identifiers that are not
  re-derivable from the source (e.g. a deployment app name).
- **Cross-cutting conventions** — durable project conventions that span the
  whole tree and would otherwise be re-learned each session.
- **Durable rationale** — the "why" behind a long-standing project posture that
  is too cross-cutting for a single ADR and too durable for an implementation
  note, and that future contributors would otherwise re-discover.

## What does NOT belong in it

- **Decisions** — those are architecture decision records under `docs/adrs/`.
- **Product behaviour / contracts** — those are living specifications under
  `docs/specs/`.
- **Setup and usage** — that is the root `README.md`.
- **What-changed-when history** — that is the Evolution Log, `CHANGELOG.md`.
- **Operational gotchas tied to one task** — those are implementation notes
  under `docs/notes/`.
- **Harness facts** — how the project is built is harness-owned
  (`CLAUDE.md` / `CORE_FLOW.md`); it is never copied into product memory.

## How it is referenced ("memory Claude references")

`docs/MEMORY.md` is wired into the product documentation so that a contributor
or an AI working on the product is pointed at it as durable, authoritative
project memory to consult:

- The root **`README.md`** Architecture/pointers section names `docs/MEMORY.md`
  as the product's durable project memory (review-agent owns `README.md`).
- **`docs/specs/project.md`** — the single source of truth for what the product
  is — points to `docs/MEMORY.md` so that any reader grounding themselves in the
  product is directed to the durable memory (spec-agent owns `project.md`).

### Harness-side reference is out of scope here

`CLAUDE.md` and `CORE_FLOW.md` are **harness-owned** artifacts — only
coreflow-agent may edit them — so this product build run does **not** wire any
reference from those files. If a harness-side pointer to `docs/MEMORY.md`
(e.g. an instruction that agents read it at the start of product work) is later
desired, that is a separate harness change captured for a future
coreflow-agent run, not implemented here.

## File shape (the contract)

`docs/MEMORY.md` is a Markdown file with a short header explaining what it is
and how to use it, followed by topical entries. The contract the file must meet:

1. It exists at `docs/MEMORY.md`.
2. It is a non-empty Markdown document with a top-level `# ` heading.
3. Its header states, in prose, that it is the product project's durable
   memory and that contributors (human or AI) should consult it when working on
   the product.
4. It states the boundary: what belongs here vs. what belongs in specs, ADRs,
   `README.md`, `CHANGELOG.md`, and `docs/notes/`.
5. It is seeded with the durable product facts already known to be true and not
   code-derivable (e.g. the product codename and deployment identity), so the
   file is useful from day one rather than an empty placeholder.
6. Entries are durable, not throwaway: when a remembered fact stops being true,
   it is updated or removed rather than left stale.

## Maintenance & ownership

`docs/MEMORY.md` is product-owned and maintained through the pipeline (it lives
on the product side under `docs/`). It is **not** owned by backlog-agent or
coreflow-agent. Like every product artifact, it is updated by the pipeline when
a run produces a new durable, code-non-derivable fact worth remembering.
