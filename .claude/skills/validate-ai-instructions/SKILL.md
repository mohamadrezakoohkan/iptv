---
name: validate-ai-instructions
description: >-
  Validates AI instruction artifacts against a 15-point checklist —
  skills (SKILL.md), sub-agent definitions, slash commands, and rule
  files (CLAUDE.md, AGENTS.md, .cursor/rules). Use whenever creating,
  editing, or reviewing any of these files, even for small wording
  changes, and whenever asked to audit instruction quality, skill
  triggering, or overlap between skills or agents. Do NOT use for
  regular code changes or for documents that merely mention AI.
allowed-tools: Read, Glob, Grep
---

# Validate AI Instructions

Reviews instruction artifacts before they are merged. An artifact is one of:

- **S — Skill**: a `SKILL.md` (routed: something decides when to load it)
- **A — Sub-agent**: an agent definition under `.claude/agents/` (routed + fresh context)
- **R — Rule**: an always-loaded file (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/*`) or a line inside one

Slash commands count as **S** with a manual trigger: validator 6 is N/A for them, everything else applies.

Saved workflows (`.claude/workflows/*.md`) count as **S** with a manual trigger
(the orchestrator invokes them deliberately): like slash commands, validator 6
is N/A, everything else applies.

## Checklist

`Applies` column: which artifact types the validator scores. `✱` = all. Validators marked **B** are blockers.

| #  | Validator                  | Applies | B | Check                                                                                                          |
|----|----------------------------|---------|---|----------------------------------------------------------------------------------------------------------------|
| 1  | Overlap & conflict         | ✱       | B | No other artifact claims the same trigger (S/A) or states a contradicting rule (R). Grep sibling artifacts.     |
| 2  | Precision                  | ✱       |   | No vague terms ("appropriate", "good", "when needed") without an example or threshold next to them.             |
| 3  | Intent preservation        | A       | B | The agent's input contract carries the user's original goal, and its instructions say to restate it in output.  |
| 4  | Length & compliance decay  | ✱       |   | Every line earns its place: delete, merge, or demote to an example. Critical rules sit first or last.           |
| 5  | Identity distortion        | R, A    | B | No "act human", "never reveal you're an AI", "you are the world's best X". In an S, any identity text = 0.      |
| 6  | Negative triggers          | S, A    |   | Description says when NOT to fire, or redirects ("for X, see skill Y"). N/A for manually invoked commands.      |
| 7  | Testability                | ✱       |   | Each instruction maps to an observable behaviour you could write an eval for.                                   |
| 8  | Positive framing           | ✱       |   | Every "never/don't" states the replacement behaviour.                                                            |
| 9  | Example–rule consistency   | ✱       |   | Every example obeys the rule it illustrates; at least one edge case where examples exist.                       |
| 10 | Precedence                 | R, A    | B | Colliding rules state which wins. If a single S needs internal precedence, split the skill instead.             |
| 11 | Failure paths              | S, A    | B | Behaviour is defined for missing inputs, tool errors, and ambiguous requests — not only the happy path.         |
| 12 | Output contract            | S, A    |   | Exact format, schema, language, and length of the output are declared when something downstream consumes it.    |
| 13 | Redundancy with defaults   | ✱       |   | No rules the model already follows by default ("be helpful", "be accurate").                                     |
| 14 | Context budget             | ✱       |   | R: minimal. S: trigger info in frontmatter, detail in `references/`, body < 500 lines. A: prompt leaves room.   |
| 15 | Terminology consistency    | ✱       |   | One name per concept, identical across all artifacts that hand data to each other.                              |

## Scoring

Per applicable validator: **2** passes, **1** partial, **0** fails, **N/A** when the `Applies` column excludes the artifact type.

**FAIL** when any applicable blocker (1, 3, 5, 10, 11) scores 0. Everything else produces warnings only.

## Procedure

1. Identify every changed instruction file and classify each as S, A, or R.
   If no instruction files changed, or a listed file cannot be read, say so
   in the report body and still emit the verdict (`VERDICT: PASS` when there
   was nothing to score).
2. For validators 1 and 15, also read the unchanged sibling artifacts in the same directory or plugin — overlap is pairwise.
3. Score each file against each applicable validator. One-line finding per score below 2.
4. Emit the report below. Never skip the verdict line.

## Output contract

End every review with exactly this structure (the CI gate greps the last line):

```markdown
## AI instruction validation

### <file path> (<S|A|R>)
| # | Score | Finding |
|---|-------|---------|
| 1 | 2     | —       |
| 5 | 0     | "Embody the role of..." forces a persona; replace with a capability description. |
| 6 | N/A   | Slash command — manual trigger, validator 6 does not apply. |
...

Blockers failing: <list or none>

VERDICT: PASS
```

The final line is `VERDICT: PASS` or `VERDICT: FAIL` on its own line, nothing after it.
