#!/usr/bin/env bash
# Event: Stop. Layer: project.
# Problem: the agent says "done" with lint or type errors still in the files it touched.
# Behaviour: when uncommitted files matching FILE_PATTERN exist, runs CHECK_BIN on exactly
#   those files and blocks the stop with the output if it fails. Scope is the working tree
#   vs HEAD, not just this turn's edits.
# Trap: keep the check fast and file-scoped — it runs at the end of every turn. A full test
#   suite does not belong here.
# Assumes: git, jq. Fail-open when CHECK_BIN is missing. Lets the second stop through, so a
#   check the agent cannot satisfy never traps it in a loop.
# Adapt: the Config block.

set -u

# --- Config ------------------------------------------------------------------
FILE_PATTERN="${FILE_PATTERN-\.(ts|tsx|js|jsx)$}"
# Paths to leave out even when they match, e.g. generated output: '^src/generated/'. Empty = none.
EXCLUDE_PATTERN="${EXCLUDE_PATTERN-}"
# Directory the check runs in, relative to the repo root; changed paths are made relative to it.
CHECK_DIR="${CHECK_DIR-.}"
CHECK_BIN="${CHECK_BIN-node_modules/.bin/eslint}"
CHECK_ARGS="${CHECK_ARGS---quiet}"
# -----------------------------------------------------------------------------

input=$(cat 2>/dev/null) || exit 0
command -v jq >/dev/null 2>&1 || exit 0
command -v git >/dev/null 2>&1 || exit 0

active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$active" = "true" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-}"
[ -z "$root" ] && root=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
[ -z "$root" ] && root=$(pwd)
cd "$root/$CHECK_DIR" 2>/dev/null || exit 0
[ -x "$CHECK_BIN" ] || exit 0

prefix="${CHECK_DIR#./}"
[ "$prefix" = "." ] && prefix=""
[ -n "$prefix" ] && prefix="${prefix%/}/"

changed=$(cd "$root" && { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } \
  | grep -E "^${prefix}" \
  | grep -E "$FILE_PATTERN" \
  | { if [ -n "$EXCLUDE_PATTERN" ]; then grep -vE "$EXCLUDE_PATTERN"; else cat; fi; } \
  | sed "s#^${prefix}##" \
  | sort -u \
  | while IFS= read -r f; do if [ -f "$root/$prefix$f" ]; then printf '%s\n' "$f"; fi; done)
[ -z "$changed" ] && exit 0

# shellcheck disable=SC2086
out=$(printf '%s\n' "$changed" | xargs "$CHECK_BIN" $CHECK_ARGS 2>&1)
status=$?
[ "$status" -eq 0 ] && exit 0

jq -n --arg r "The check still fails on files changed in the working tree — fix it before finishing:
${out}" '{decision:"block",reason:$r}'
exit 0
