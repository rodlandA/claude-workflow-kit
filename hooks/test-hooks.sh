#!/usr/bin/env bash
# Feeds constructed payloads to each hook and checks the verdict.
#
#   hooks/test-hooks.sh                                  # the kit's own hooks/ and patterns/
#   hooks/test-hooks.sh ~/.claude/hooks .claude/hooks    # installed copies, every layer
#
# Every copy of every known hook in the given directories is tested, so a hook installed in
# both layers is tested twice. Config is forced through environment overrides: an adapted
# copy is tested on its mechanism, not on the values chosen for it. Exits non-zero on failure.

set -u

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ $# -eq 0 ]; then
  set -- "$KIT/hooks" "$KIT/patterns"
fi
DIRS=()
for d in "$@"; do
  if [ -d "$d" ]; then
    DIRS+=("$(cd "$d" && pwd)")
  fi
done
if [ "${#DIRS[@]}" -eq 0 ]; then
  echo "No hook directories found among: $*"
  exit 1
fi

command -v jq >/dev/null 2>&1 || { echo "SKIP: jq is not installed"; exit 0; }

FAILS=0
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

result() {
  if [ "$1" = "$2" ]; then
    printf '  ok    %s\n' "$3"
  else
    printf '  FAIL  %s -> got %s, expected %s\n' "$3" "$1" "$2"
    FAILS=$((FAILS + 1))
  fi
}

# classify <hook output> -> ALLOW | DENY | BLOCK | CONTEXT
classify() {
  if [ -z "$1" ]; then
    echo ALLOW
  elif printf '%s' "$1" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null 2>&1; then
    echo DENY
  elif printf '%s' "$1" | jq -e '.decision == "block"' >/dev/null 2>&1; then
    echo BLOCK
  elif printf '%s' "$1" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
    echo CONTEXT
  else
    echo "UNKNOWN($1)"
  fi
}

# run <hook> <stdin> [env args...] — executes the hook as settings.json would, in $RUN_CWD.
# A non-executable hook, a non-zero exit or anything on stderr is an ERROR, never a pass.
run() {
  local hook=$1 stdin=$2 out status
  shift 2
  if [ ! -x "$hook" ]; then
    echo "ERROR(not executable)"
    return
  fi
  out=$(cd "${RUN_CWD:-.}" && printf '%s' "$stdin" | env "$@" "$hook" 2>"$TMP/stderr")
  status=$?
  if [ "$status" -ne 0 ] || [ -s "$TMP/stderr" ]; then
    echo "ERROR(exit $status: $(head -c 200 "$TMP/stderr"))"
    return
  fi
  classify "$out"
}

verdict() {
  local hook=$1 payload=$2
  shift 2
  run "$hook" "$payload" CLAUDE_PROJECT_DIR="$TMP/none" "$@"
}

bash_payload() { jq -n --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}'; }
edit_payload() { jq -n --arg f "$1" --arg a "${2:-}" '{tool_name:"Edit",tool_input:{file_path:$f}} + (if $a == "" then {} else {agent_id:$a} end)'; }

new_repo() {
  local repo
  repo=$(mktemp -d "$TMP/repo.XXXXXX")
  git init -q -b main "$repo"
  git -C "$repo" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
  printf '%s' "$repo"
}

# A project directory that ships its own (different) copy of the named hook.
project_with_copy() {
  local proj
  proj=$(mktemp -d "$TMP/proj.XXXXXX")
  mkdir -p "$proj/.claude/hooks"
  echo '#!/bin/sh' > "$proj/.claude/hooks/$1"
  printf '%s' "$proj"
}

L=(ALLOWED_TYPES="feat fix refactor docs test chore" BLOCK_AI_ATTRIBUTION=1 BLOCKED_PATTERN='æ|ø|å' BLOCKED_WORDS="ikke endret")

test_lint_commit_message() {
  local h=$1
  result "$(verdict "$h" "$(bash_payload 'git commit -m "feat: add export"')" "${L[@]}")" ALLOW "valid subject"
  result "$(verdict "$h" "$(bash_payload 'git commit -m "fix(api): handle timeout" -m "Body text."')" "${L[@]}")" ALLOW "scope + body paragraph"
  result "$(verdict "$h" "$(bash_payload 'git commit -m "added export"')" "${L[@]}")" DENY "missing type prefix"
  result "$(verdict "$h" "$(bash_payload 'git commit -m "feature: x"')" "${L[@]}")" DENY "unknown type"
  result "$(verdict "$h" "$(bash_payload 'git commit -am "feat: x"')" "${L[@]}")" ALLOW "bundled -am flag"
  result "$(verdict "$h" "$(bash_payload 'git commit -m "feat: x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"')" "${L[@]}")" DENY "AI attribution"
  result "$(verdict "$h" "$(bash_payload 'git commit -m "feat: x" -m "Claude-Session: https://claude.ai/code/session_x"')" "${L[@]}")" DENY "session-link trailer"
  result "$(verdict "$h" "$(bash_payload 'git commit -m "feat: x" -m "Co-Authored-By: Kari <kari@example.com>"')" "${L[@]}")" ALLOW "human co-author"
  result "$(verdict "$h" "$(bash_payload 'git commit -m "feat: legg til eksport på kart"')" "${L[@]}")" DENY "blocked characters"
  result "$(verdict "$h" "$(bash_payload 'git commit -m "fix: ikke krasj"')" "${L[@]}")" DENY "blocked word"
  result "$(verdict "$h" "$(bash_payload 'git commit -m "feat: på"')" BLOCKED_PATTERN= BLOCKED_WORDS=)" ALLOW "language check off"
  result "$(verdict "$h" "$(bash_payload 'git log --grep "git commit"')" "${L[@]}")" ALLOW "mentions git commit only"
  result "$(verdict "$h" "$(bash_payload 'git commit')" "${L[@]}")" ALLOW "editor commit"
  result "$(verdict "$h" "$(bash_payload 'ls -la')" "${L[@]}")" ALLOW "unrelated command"
  local proj
  proj=$(project_with_copy lint-commit-message.sh)
  result "$(run "$h" "$(bash_payload 'git commit -m "bad"')" CLAUDE_PROJECT_DIR="$proj")" ALLOW "stands down when the project ships its own copy"
}

test_workspace_hygiene() {
  local h=$1 repo proj
  repo=$(new_repo)
  result "$(RUN_CWD=$repo run "$h" '' -u CLAUDE_PROJECT_DIR)" CONTEXT "nudges on the default branch in the main checkout"
  git -C "$repo" worktree add -q -b feat/x "$repo-x" 2>/dev/null
  result "$(RUN_CWD=$repo-x run "$h" '' -u CLAUDE_PROJECT_DIR)" ALLOW "silent in a linked worktree"
  proj=$(project_with_copy workspace-hygiene.sh)
  result "$(RUN_CWD=$repo run "$h" '' CLAUDE_PROJECT_DIR="$proj")" ALLOW "stands down when the project ships its own copy"
}

test_open_worktree_in_editor() {
  local h=$1 repo payload out
  result "$(verdict "$h" "$(bash_payload 'ls')" EDITOR_DRY_RUN=1)" ALLOW "ignores other commands"
  repo=$(new_repo)
  git -C "$repo" worktree add -q -b feat/y "$repo-y" 2>/dev/null
  payload=$(jq -n --arg c "git worktree add -b feat/y $repo-y" --arg d "$repo" '{tool_name:"Bash",tool_input:{command:$c},cwd:$d}')
  out=$(printf '%s' "$payload" | env CLAUDE_PROJECT_DIR="$TMP/none" EDITOR_DRY_RUN=1 "$h" 2>&1)
  case "$out" in
    *"would open $(cd "$repo-y" && pwd -P)"*) result ok ok "opens the new worktree (dry run)" ;;
    *) result "${out:-silent}" "would open <worktree>" "opens the new worktree (dry run)" ;;
  esac
}

test_remind_rules_budget() {
  local h=$1 p proj
  p=$(mktemp -d "$TMP/rules.XXXXXX")
  mkdir -p "$p/.claude/rules"
  { echo "# Long"; for _ in $(seq 1 130); do echo "one two three four five six seven eight nine ten"; done; } > "$p/.claude/rules/long.md"
  { echo "# Short"; echo "### A"; echo "a few words"; } > "$p/.claude/rules/short.md"
  result "$(verdict "$h" "$(edit_payload "$p/.claude/rules/long.md")")" CONTEXT "over the file budget"
  result "$(verdict "$h" "$(edit_payload "$p/.claude/rules/short.md")")" ALLOW "within budget"
  result "$(verdict "$h" "$(edit_payload "$p/src/long.md")")" ALLOW "outside .claude/rules"
  cp "$p/.claude/rules/long.md" "$p/CLAUDE.md"
  result "$(verdict "$h" "$(edit_payload "$p/CLAUDE.md")")" CONTEXT "CLAUDE.md over the file budget"
  proj=$(project_with_copy remind-rules-budget.sh)
  result "$(run "$h" "$(edit_payload "$p/.claude/rules/long.md")" CLAUDE_PROJECT_DIR="$proj")" ALLOW "stands down when the project ships its own copy"
}

test_gate_path_to_subagent() {
  local h=$1 G=(GATED_PATH=web AGENT_NAME=web-dev)
  result "$(verdict "$h" "$(edit_payload /r/web/src/a.ts)" "${G[@]}")" DENY "main session, gated path"
  result "$(verdict "$h" "$(edit_payload /r/web/src/a.ts agent-123)" "${G[@]}")" ALLOW "subagent, gated path"
  result "$(verdict "$h" "$(edit_payload /r/api/a.ts)" "${G[@]}")" ALLOW "ungated path"
}

test_protect_generated_files() {
  local h=$1 P=(PROTECTED_PATH=src/generated)
  result "$(verdict "$h" "$(edit_payload /r/src/generated/client.ts)" "${P[@]}")" DENY "generated file"
  result "$(verdict "$h" "$(edit_payload /r/src/client.ts)" "${P[@]}")" ALLOW "hand-written file"
}

test_remind_on_change() {
  local h=$1 W=(WATCH_GLOB='*/api/*' REMINDER=regenerate)
  result "$(verdict "$h" "$(edit_payload /r/src/api/users.ts)" "${W[@]}")" CONTEXT "watched path"
  result "$(verdict "$h" "$(edit_payload /r/src/ui/users.ts)" "${W[@]}")" ALLOW "other path"
}

test_verify_on_stop() {
  local h=$1 repo S=(FILE_PATTERN='\.js$' CHECK_DIR=. CHECK_BIN=bin/check CHECK_ARGS=)
  repo=$(new_repo)
  mkdir -p "$repo/bin"
  printf '#!/bin/sh\ngrep -l BAD "$@" && exit 1\nexit 0\n' > "$repo/bin/check"
  chmod +x "$repo/bin/check"
  echo ok > "$repo/good.js"
  stop_verdict() {
    run "$h" "$1" CLAUDE_PROJECT_DIR="$repo" "${S[@]}" "${@:2}"
  }
  local stop='{"stop_hook_active":false}'
  result "$(stop_verdict "$stop")" ALLOW "passing check"
  echo BAD > "$repo/bad.js"
  result "$(stop_verdict "$stop")" BLOCK "failing check blocks"
  result "$(stop_verdict '{"stop_hook_active":true}')" ALLOW "second stop is let through"
  result "$(stop_verdict "$stop" CHECK_BIN=bin/missing)" ALLOW "missing check fails open"
  result "$(stop_verdict "$stop" EXCLUDE_PATTERN='bad\.js$')" ALLOW "excluded file is not checked"
}

for name in lint-commit-message workspace-hygiene open-worktree-in-editor remind-rules-budget \
            gate-path-to-subagent protect-generated-files remind-on-change verify-on-stop; do
  for d in "${DIRS[@]}"; do
    h="$d/$name.sh"
    [ -f "$h" ] || continue
    echo "$name.sh ($h)"
    "test_${name//-/_}" "$h"
  done
done

echo
if [ "$FAILS" -eq 0 ]; then
  echo "All hook tests passed."
else
  echo "$FAILS hook test(s) failed."
  exit 1
fi
