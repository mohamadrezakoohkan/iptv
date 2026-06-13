<!-- ADR: ADR-0026 -->

# Implementation notes

This directory is the documented home for **implementation notes** — short,
durable engineering notes that accompany the product documentation but do not
belong in an ADR, a spec, or the root `README.md`.

## What belongs here

- Gotchas and non-obvious behaviours discovered while implementing a task.
- Manual procedures (e.g. one-off operational steps a future contributor must
  repeat by hand).
- Rationale that is too operational for an architecture decision record and too
  detailed for the product `README.md`.

## What does NOT belong here

- **Decisions** — those are architecture decision records under
  `docs/adrs/`.
- **Product behaviour / contracts** — those are living specifications under
  `docs/specs/`.
- **Setup and usage** — that is the root `README.md`.

## Convention

- One note per file, named for its subject in kebab-case (e.g.
  `ffmpeg-remux-tuning.md`).
- Each note states the date and the context it applies to, so a reader can tell
  whether it is still current.
- Notes are durable, not throwaway scratch: if a note stops being true, update
  or remove it rather than leaving it stale.

> This file establishes the convention and the home for notes. It intentionally
> contains no note content of its own — notes are added by the work that earns
> them.
