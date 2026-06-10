---
id: ADR-0000
title: <decision, stated as a choice>
date: YYYY-MM-DD
evolution: <N>
status: accepted   # proposed | accepted | superseded (by ADR-NNNN) | deleted (governed code removed, E<N>)
governs: []        # code files/dirs implementing this decision — seeded by
                   # spec-agent (planned paths), kept true by implement-agent.
                   # Empty / all paths gone ⇒ status: deleted
---

# ADR-0000 — <title>

## Context

What forces this decision? Reference the prompt, the spec(s), and any prior
ADRs that constrain it.

## Decision

The choice made, stated plainly and unambiguously. One decision per ADR.

## Consequences

What becomes easier, what becomes harder, what is now ruled out. Include
follow-up obligations if any.

## Tasks derived

- TASK-NNNN — <title>

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0000` comment near the top
(native comment syntax; comment-less formats like JSON are linked from this
side only). When a change removes the last governed code, this ADR is marked
`status: deleted` — the file itself is never removed; it is history.
