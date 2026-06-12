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
the background and in parallel with the pipeline or other work.

Do NOT invoke for:
- Build prompts — those run the full pipeline via `spec-agent`.
- Harness changes — use `/coreflow`.
- Questions or status requests — answer directly from files.

## Input contract

| Field | Value |
|---|---|
| `idea` | The human's idea, **verbatim** |
| `rule_pack` | The `<!-- LEARNED-RULES:START -->…END` block from `CLAUDE.md`, verbatim |

## Output contract

On success the agent returns ONLY this JSON:

```json
{
  "title": "the entry's short title",
  "user_input": "the human's idea, verbatim",
  "assumptions": ["term: assumption", "..."],
  "backlog_path": "BACKLOG.md",
  "branch": "backlog/<slug>",
  "pr_url": "the opened PR URL"
}
```

## Failure signal

`PHASE-FAILURE: <reason>` — the capture could not complete: `BACKLOG.md` not
writable, or `git` / an authenticated `gh` CLI unavailable so the worktree,
commit, push, or PR could not be created. No entry is published. Report to the
human.

## Post-condition

The new entry is appended to `BACKLOG.md` in a dedicated git worktree on a
`backlog/<slug>` branch, committed, pushed, and opened as a PR against `main`
whose description contains only the verbatim idea and the resolved assumptions.
No evolution number is consumed and no pipeline phase runs. Nothing is ever
committed, pushed, or merged to `main` — merging the backlog PR is the human's
decision.
