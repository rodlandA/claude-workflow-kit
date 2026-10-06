#!/usr/bin/env bash
# Event: PreToolUse (matcher: Edit|Write|MultiEdit|NotebookEdit). Layer: project.
# Problem: generated output (API clients, ORM types, protobuf, lockfile-like artefacts) gets
#   hand-edited, and the edit is silently lost on the next regeneration.
# Behaviour: denies Edit/Write under PROTECTED_PATH and says how to regenerate instead.
#   Regeneration itself runs through Bash, so it is never blocked.
# Assumes: jq. Fail-open.
# Adapt: the Config block.

set -u

# --- Config ------------------------------------------------------------------
PROTECTED_PATH="${PROTECTED_PATH-src/generated}"
REGEN_HINT="${REGEN_HINT-change the source contract and run the generator}"
# -----------------------------------------------------------------------------

command -v jq >/dev/null 2>&1 || exit 0
input=$(cat 2>/dev/null) || exit 0
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

case "$file" in
  */"$PROTECTED_PATH"/*|"$PROTECTED_PATH"/*) ;;
  *) exit 0 ;;
esac

jq -n --arg r "${PROTECTED_PATH}/ is generated and overwritten on regeneration. Do not edit it by hand: ${REGEN_HINT}." \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
exit 0
