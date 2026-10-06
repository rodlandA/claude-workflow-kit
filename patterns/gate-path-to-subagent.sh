#!/usr/bin/env bash
# Event: PreToolUse (matcher: Edit|Write|MultiEdit|NotebookEdit). Layer: project.
# Problem: a rule says "all work in <dir> goes through the <name> subagent", which carries
#   the conventions for that part of the codebase. The main session forgets and edits directly.
# Behaviour: denies edits under GATED_PATH from the main session; subagents pass.
# Trap: relies on PreToolUse payloads carrying `agent_id` only inside a subagent. Verify it
#   on your Claude Code version with the payload test in patterns/README.md before trusting it.
# Assumes: jq. Fail-open.
# Adapt: the Config block.

set -u

# --- Config ------------------------------------------------------------------
GATED_PATH="${GATED_PATH-web}"
AGENT_NAME="${AGENT_NAME-frontend-developer}"
RULE_REF="${RULE_REF-.claude/rules/agent-delegation.md}"
# -----------------------------------------------------------------------------

command -v jq >/dev/null 2>&1 || exit 0
input=$(cat 2>/dev/null) || exit 0

tool=$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null)
agent_id=$(printf '%s' "$input" | jq -r '.agent_id // empty' 2>/dev/null)

case "$tool" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  *) exit 0 ;;
esac

# Match a path segment, so the gate also holds in worktrees and other clones.
case "$file" in
  */"$GATED_PATH"/*|"$GATED_PATH"/*) ;;
  *) exit 0 ;;
esac

[ -n "$agent_id" ] && exit 0

jq -n --arg r "Edits under ${GATED_PATH}/ go through the ${AGENT_NAME} subagent (${RULE_REF}). Re-issue this change via the Agent tool with subagent_type ${AGENT_NAME}." \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
exit 0
