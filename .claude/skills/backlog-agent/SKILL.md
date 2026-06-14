---
name: backlog-agent
description: >-
  Invokes backlog-agent to park a human's idea as one entry in BACKLOG.md,
  outside the build pipeline. Use when the human wants to note or save an idea
  for later instead of building it now. Runs non-blocking, in the background and
  in parallel with other work. Do NOT use for build prompts (those run the full
  pipeline via spec-agent), harness changes (use /coreflow), or questions
  (answer directly from files).
allowed-tools: Agent
---

# backlog-agent — backlog-capture invocation interface

Full procedure: `.claude/agents/backlog-agent.md`.

## When to invoke

The human wants to **park an idea for later** rather than build it now — "add
this to the backlog", "note this down", "keep this for later". One invocation
= one appended entry in `BACKLOG.md`. The call is non-blocking and may run in
the background and in parallel with the pipeline or other work. The orchestrator
also invokes it in the **research-handoff variant** (CORE_FLOW.md §4.6): after
Phase 4 RESEARCH returns a scored winner, the orchestrator parks that winner and
commits its report — see the research-handoff input shape below.

Do NOT invoke for:
- Build prompts — those run the full pipeline via `spec-agent`.
- Harness changes — use `/coreflow`.
- Questions or status requests — answer directly from files.

## Input contract

Two spawn shapes (CORE_FLOW.md §4.5, §4.6):

**Ordinary backlog prompt:**

| Field | Value |
|---|---|
| `idea` | The human's idea, **verbatim** |
| `rule_pack` | The `<!-- LEARNED-RULES:START -->…END` block from `CLAUDE.md`, verbatim |

**Research-handoff variant** (orchestrator hands over a Phase 4 RESEARCH winner):

| Field | Value |
|---|---|
| `idea` | The winning feature, **verbatim** (this is the parked idea) |
| `E` | Evolution number — names the report file `docs/research/E<N>-<slug>.md` |
| `research_report` | The full report markdown from `research-agent`, to commit verbatim |
| `winner_score` | The winner's total (N/15), for the PR `research:` block |
| `rule_pack` | The `<!-- LEARNED-RULES:START -->…END` block from `CLAUDE.md`, verbatim |

## Output contract

On success the agent returns ONLY this JSON:

```json
{
  "title": "the entry's short title",
  "user_input": "the human's idea (or research winner), verbatim",
  "assumptions": ["term: assumption", "..."],
  "backlog_path": "BACKLOG.md",
  "research_report_path": "docs/research/E<N>-<slug>.md (research-handoff variant) | null",
  "branch": "backlog/<slug>",
  "pr_url": "the opened PR URL"
}
```

In the research-handoff variant the agent commits the report at
`research_report_path` **in the same commit** as its `BACKLOG.md` entry; for an
ordinary backlog prompt `research_report_path` is `null`.

## Failure signal

`PHASE-FAILURE: <reason>` — the capture could not complete: `BACKLOG.md` not
writable, `git fetch origin main` failed, or `git` / an authenticated `gh` CLI
unavailable so the worktree, commit, push, or PR could not be created. No entry
is published. Report to the human.

## Post-condition

The new entry is appended to `BACKLOG.md` in a dedicated git worktree on a
`backlog/<slug>` branch, committed, pushed, and opened as a PR against `main`
whose description contains only the verbatim idea and the resolved assumptions.
In the research-handoff variant the same commit also carries
`docs/research/E<N>-<slug>.md`, and the PR description adds the winner score +
report pointer (the `research:` block). No evolution number is consumed and no
pipeline phase runs. Nothing is ever committed, pushed, or merged to `main` —
merging the backlog PR is the human's decision.
