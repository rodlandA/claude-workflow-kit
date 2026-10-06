#!/usr/bin/env bash
# Event: SessionStart. Layer: global or project.
# Problem: work started directly on the default branch in the main checkout, and a
#   default branch that has silently fallen behind origin.
# Behaviour: read-only (no fetch), silent unless there is something to act on.
# Assumes: git, jq. Default branch from origin/HEAD, falling back to main/master/develop/trunk.
# Adapt: WORKTREE_HINT, if worktrees do not live as siblings of the repo.

set -u

# --- Config ------------------------------------------------------------------
WORKTREE_HINT="${WORKTREE_HINT-create a worktree before making changes, as a sibling: ../<repo>-<slug>/}"
# -----------------------------------------------------------------------------

proj_copy="${CLAUDE_PROJECT_DIR:-}/.claude/hooks/$(basename "$0")"
if [ -f "$proj_copy" ] && [ "$(cd "$(dirname "$proj_copy")" && pwd -P)" != "$(cd "$(dirname "$0")" && pwd -P)" ]; then
  exit 0
fi

command -v jq >/dev/null 2>&1 || exit 0
command -v git >/dev/null 2>&1 || exit 0

root="${CLAUDE_PROJECT_DIR:-}"
[ -z "$root" ] && root=$(pwd)
cd "$root" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

default_branch=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
default_branch=${default_branch#origin/}
if [ -z "$default_branch" ]; then
  for cand in main master develop trunk; do
    if git rev-parse --verify --quiet "refs/heads/${cand}" >/dev/null 2>&1; then
      default_branch=$cand
      break
    fi
  done
fi
[ -z "$default_branch" ] && exit 0

msgs=""

# git-dir == git-common-dir only in the main checkout, never in a linked worktree.
gitdir=$(cd "$(git rev-parse --git-dir 2>/dev/null)" 2>/dev/null && pwd -P)
commondir=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)
branch=$(git branch --show-current 2>/dev/null)
if [ -n "$gitdir" ] && [ "$gitdir" = "$commondir" ] && [ "$branch" = "$default_branch" ]; then
  repo=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)")
  msgs="You're on \`${default_branch}\` in the main checkout of ${repo} — ${WORKTREE_HINT//<repo>/$repo}. "
fi

if git rev-parse --verify --quiet "refs/remotes/origin/${default_branch}" >/dev/null 2>&1 \
   && git rev-parse --verify --quiet "refs/heads/${default_branch}" >/dev/null 2>&1; then
  behind=$(git rev-list --count "${default_branch}..origin/${default_branch}" 2>/dev/null || echo 0)
  case "$behind" in
    ''|*[!0-9]*) behind=0 ;;
  esac
  if [ "$behind" -gt 0 ]; then
    msgs="${msgs}\`${default_branch}\` is ${behind} commit(s) behind origin (as of last fetch) — update it in the main checkout. "
  fi
fi

msgs="${msgs% }"
[ -z "$msgs" ] && exit 0

jq -n --arg m "$msgs" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$m}}'
exit 0
