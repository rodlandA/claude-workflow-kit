#!/usr/bin/env bash
# Event: PostToolUse (matcher: Edit|Write|MultiEdit). Layer: project.
# Problem: editing X makes Y stale (API surface → generated client, schema → migration,
#   strings → translations), and nobody remembers Y.
# Behaviour: when an edited file matches WATCH_GLOB, injects REMINDER into the agent's
#   context. Non-blocking.
# Assumes: jq.
# Adapt: the Config block. For several pairs, copy the script once per pair.

set -u

# --- Config ------------------------------------------------------------------
# A case glob; `*` spans '/', so */api/* matches nested directories too.
WATCH_GLOB="${WATCH_GLOB-*/api/*}"
REMINDER="${REMINDER-You changed the API surface. The generated client is now stale — regenerate it before relying on this change.}"
# -----------------------------------------------------------------------------

command -v jq >/dev/null 2>&1 || exit 0
input=$(cat 2>/dev/null) || exit 0
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$file" ] || exit 0

# shellcheck disable=SC2254
case "$file" in
  $WATCH_GLOB) ;;
  *) exit 0 ;;
esac

jq -n --arg m "$REMINDER" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$m}}'
exit 0
