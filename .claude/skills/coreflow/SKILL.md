---
name: coreflow
description: >-
  Invokes coreflow-agent for harness-maintenance instructions — changes to
  CORE_FLOW.md, CLAUDE.md, agent definitions, skills, templates, settings,
  hooks, or the CI validation workflow. Use when the human explicitly requests
  a harness change. Do NOT use for build prompts (those run the full pipeline)
  or for questions (answer directly from files).
allowed-tools: Agent
---

# coreflow — harness-maintenance invocation interface

Full procedure: `.claude/agents/coreflow-agent.md`.

## When to invoke

An explicit **harness prompt** — the human is requesting a change to the
harness itself: `CORE_FLOW.md`, `CLAUDE.md`, agent definitions
(`.claude/agents/*.md`), skills (`.claude/skills/**`), templates (`adrs/`,
`tasks/`, `failures/TEMPLATE.md`), `.claude/settings.json`, hooks
(`.claude/hooks/**`), or `.github/workflows/validate-ai-instructions.yml`.

Do NOT invoke for:
- Build prompts — those run the full pipeline via `spec-agent`.
- Questions or status requests — answer directly from files.

## Input contract

| Field | Value |
|---|---|
| `instruction` | Human's harness instruction, **verbatim** |
| `rule_pack` | The `<!-- LEARNED-RULES:START -->…END` block from `CLAUDE.md`, verbatim |

## Output contract

On success the agent returns ONLY this JSON:

```json
{
  "instruction": "condensed to one line",
  "files_changed": ["..."],
  "consistency_check": "what was verified across layers, one or two lines",
  "branch": "harness/<slug>",
  "pr_url": "https://github.com/...",
  "restart_required": true | false,
  "proposals": ["out-of-scope improvements noticed, else empty list"],
  "artifact_validation": "<full scored report string, or 'N/A — no instruction artifacts changed'>"
}
```

## Failure signal

`PHASE-FAILURE: <reason>` — the instruction would break a harness invariant.
No changes are made. Report to the human; they decide next steps.

## Post-condition

`restart_required: true` means agent files, settings, or skill frontmatter
changed — those load only at next session start. Inform the human.

The agent self-publishes: it commits its changes on a `harness/<slug>` branch,
pushes, and opens a PR against `main` (it never commits/pushes/merges to `main`).
Relay the returned branch and PR URL; merging the harness PR is the human's
decision.
