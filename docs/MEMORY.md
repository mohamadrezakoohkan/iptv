# Product project memory

This file is the **durable, authoritative memory of the IPTV Broadcast Console
product project**. It records the cross-cutting facts, identities, and rationale
that stay true across sessions and are **not derivable from the source code or
the git history**. Anyone working on the product — human contributor or AI agent
— should consult this file as durable project memory when working on the
product, so that context which would otherwise be re-discovered every session is
captured once and read again.

It is product-side memory. It is distinct from, and does not duplicate, the
orchestration harness's own memory (`CLAUDE.md`, `CORE_FLOW.md`, the
orchestrator's user-level auto-memory), which are harness-owned and out of scope
here.

## What belongs here vs. elsewhere

Keep entries durable and de-duplicated against the structured artifacts. A fact
belongs in this file only when no other artifact already owns it:

| Put it here | Put it elsewhere |
|---|---|
| Durable product facts not recoverable from code or git (domain vocabulary, product codename / deployment identity, long-standing project posture) | — |
| — | **Decisions and their rationale** → architecture decision records in `docs/adrs/` |
| — | **Product behaviour and contracts** → living specifications in `docs/specs/` |
| — | **Setup and usage** → the root `README.md` |
| — | **What-changed-when history** → the Evolution Log, `CHANGELOG.md` |
| — | **Operational gotchas tied to one task** → implementation notes in `docs/notes/` |
| — | **How the project is built** → harness-owned `CLAUDE.md` / `CORE_FLOW.md` (never copied here) |

When a remembered fact stops being true, update or remove it rather than leaving
it stale. This file holds durable memory, not throwaway notes.

## Durable facts

### Product identity

- **Product / UI name:** the product is the **IPTV Broadcast Console** — the
  name shown in the UI and used in the product documentation.
- **Product codename / deployment identity:** the product's codename is
  **`teeatr`**. This is also its **Fly.io deployment app name** (the `app` value
  a `fly.toml` would carry). There is no `fly.toml` checked into the repository,
  so this identifier is **not recoverable from the source tree** — it is recorded
  here precisely so it is not re-lost between sessions.

## Maintenance

`docs/MEMORY.md` is product-owned and maintained through the build pipeline like
any other product artifact. It is not owned by the backlog or harness paths.
When a run produces a new durable, code-non-derivable fact worth remembering, add
it here under the appropriate topical heading. The full contract for this file
lives in `docs/specs/product-memory.md`.
