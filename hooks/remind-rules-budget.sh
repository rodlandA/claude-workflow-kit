#!/usr/bin/env bash
# Event: PostToolUse (matcher: Edit|Write|MultiEdit). Layer: global or project.
# Problem: .claude/rules/ and CLAUDE.md load into every session, so their length is paid
#   on every turn, and they only ever grow.
# Behaviour: after a rules file or CLAUDE.md is edited, nudges when the file or a ### section crosses
#   the word budget. Advisory only — a word count must never reject good prose.
# Assumes: jq.
# Adapt: the budgets, and RULE_REF if the budget rule lives elsewhere.

set -u

# --- Config ------------------------------------------------------------------
FILE_BUDGET="${FILE_BUDGET-1200}"
SECTION_BUDGET="${SECTION_BUDGET-150}"
# A file with this many ### entries is a decision register: exempt from the file budget.
REGISTER_HEADINGS="${REGISTER_HEADINGS-20}"
RULE_REF="${RULE_REF-.claude/rules/where-things-go.md § Budgets}"
# -----------------------------------------------------------------------------

proj_copy="${CLAUDE_PROJECT_DIR:-}/.claude/hooks/$(basename "$0")"
if [ -f "$proj_copy" ] && [ "$(cd "$(dirname "$proj_copy")" && pwd -P)" != "$(cd "$(dirname "$0")" && pwd -P)" ]; then
  exit 0
fi

command -v jq >/dev/null 2>&1 || exit 0
input=$(cat 2>/dev/null) || exit 0
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

case "$file" in
  */.claude/rules/*.md|*/CLAUDE.md) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

words=$(wc -w < "$file" | tr -d ' ')
over=$(awk -v max="$SECTION_BUDGET" '
  function flush() { if (h != "" && c >= max) printf "%s (%d words); ", h, c }
  /^### / { flush(); h = substr($0, 5); c = 0; next }
  /^#{1,2} / { flush(); h = ""; next }
  h != "" { c += NF }
  END { flush() }' "$file")
over="${over%; }"

headings=$(grep -c '^### ' "$file")
file_over=0
if [ "$headings" -lt "$REGISTER_HEADINGS" ] && [ "$words" -ge "$FILE_BUDGET" ]; then
  file_over=1
fi

[ "$file_over" -eq 0 ] && [ -z "$over" ] && exit 0

msg="\`$(basename "$file")\` is $words words"
if [ "$file_over" -eq 1 ]; then
  msg="$msg — over the ${FILE_BUDGET}-word file budget"
fi
if [ -n "$over" ]; then
  msg="$msg. Sections over ${SECTION_BUDGET} words: $over"
fi
msg="$msg. Check it against ${RULE_REF} — a prompt to check, not a failure."

jq -n --arg m "$msg" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$m}}'
exit 0
