#!/usr/bin/env bash
# PostToolUse hook — fires after Edit/Write/MultiEdit.
# If the edited file is an AI instruction artifact, inject a reminder so
# Claude runs the validate-ai-instructions skill before finishing the turn.
set -euo pipefail

# Hook input arrives as JSON on stdin. Never break the edit: exit 0 on any gap.
command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
[ -n "$file_path" ] || exit 0

pattern='SKILL\.md$|\.claude/agents/|\.claude/commands/|\.agents/skills/|\.cursor/rules/|CLAUDE\.md$|AGENTS\.md$|CORE_FLOW\.md$|\.claude/skills/|\.claude/workflows/|\.claude/hooks/'

if printf '%s' "$file_path" | grep -qE "$pattern"; then
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"An AI instruction file was just modified. Before ending this turn, apply the validate-ai-instructions skill to it and include the full report ending with the VERDICT line."}}
JSON
fi

exit 0
