#!/usr/bin/env bash
# Event: PostToolUse (matcher: Bash). Layer: global.
# Problem: after the agent creates a worktree, you still have to open it yourself.
# Behaviour: when `git worktree add` succeeds, opens the new worktree in your editor.
# Assumes: jq and an editor CLI (VS Code `code` or Cursor `cursor`). No-op otherwise.
#   Only fires for `git worktree add` run through Bash, not a native worktree tool.
# Adapt: EDITOR_CANDIDATES.

set -u

# --- Config ------------------------------------------------------------------
EDITOR_CANDIDATES="${EDITOR_CANDIDATES-code cursor}"
# 1 = print "would open <path>" instead of opening, for testing.
EDITOR_DRY_RUN="${EDITOR_DRY_RUN-0}"
# -----------------------------------------------------------------------------

proj_copy="${CLAUDE_PROJECT_DIR:-}/.claude/hooks/$(basename "$0")"
if [ -f "$proj_copy" ] && [ "$(cd "$(dirname "$proj_copy")" && pwd -P)" != "$(cd "$(dirname "$0")" && pwd -P)" ]; then
  exit 0
fi

command -v jq >/dev/null 2>&1 || exit 0

# Hooks may run with a minimal PATH when Claude Code is launched from a GUI.
editor_bin=""
for name in $EDITOR_CANDIDATES; do
  for cand in "$(command -v "$name" 2>/dev/null)" "/usr/local/bin/$name" "/opt/homebrew/bin/$name" "$HOME/.local/bin/$name"; do
    if [ -n "$cand" ] && [ -x "$cand" ]; then
      editor_bin=$cand
      break 2
    fi
  done
done
if [ -z "$editor_bin" ] && [ -x "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" ]; then
  editor_bin="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
fi
if [ -z "$editor_bin" ] && [ "$EDITOR_DRY_RUN" != "1" ]; then
  exit 0
fi

input=$(cat 2>/dev/null) || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
case "$cmd" in
  *"git worktree add"*) ;;
  *) exit 0 ;;
esac

cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
if [ -n "$cwd" ]; then
  cd "$cwd" 2>/dev/null || true
fi

# The worktree path is the first bare token after "worktree add", skipping flags and their values.
path=""
# shellcheck disable=SC2086
set -- $cmd
seen_add=0
while [ $# -gt 0 ]; do
  tok=$1
  shift
  if [ "$seen_add" = 0 ]; then
    if [ "$tok" = "worktree" ] && [ "${1:-}" = "add" ]; then
      seen_add=1
      shift
    fi
    continue
  fi
  case "$tok" in
    -b|-B|--branch|--reason) shift ;;
    -*|--) ;;
    *) path=$tok; break ;;
  esac
done

[ -n "$path" ] || exit 0
abs=$(cd "$path" 2>/dev/null && pwd -P) || exit 0
git -C "$abs" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

if [ "$EDITOR_DRY_RUN" = "1" ]; then
  echo "would open $abs with ${editor_bin:-<no editor found>}"
  exit 0
fi

"$editor_bin" "$abs" >/dev/null 2>&1 &
exit 0
