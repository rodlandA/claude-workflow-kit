#!/usr/bin/env bash
# Event: PreToolUse (matcher: Bash). Layer: global or project.
# Problem: commit-message conventions written in a rule are followed most of the time;
#   this blocks the rest before the commit exists.
# Checks: conventional type prefix, optional ban on AI attribution, optional ban on a
#   language (e.g. git in English while chatting in Norwegian).
# Trap: it scans the whole command, so any command containing `git commit -m` plus blocked
#   text is denied, test scripts included. Put such commands in a file and run the file.
# Assumes: jq. Fail-open: anything it cannot parse is allowed.
# Adapt: the Config block. Each value can also be overridden from the environment.

set -u

# --- Config ------------------------------------------------------------------
ALLOWED_TYPES="${ALLOWED_TYPES-feat fix refactor docs test chore}"
BLOCK_AI_ATTRIBUTION="${BLOCK_AI_ATTRIBUTION-1}"
# Regex alternation of characters that mark the wrong language, e.g. 'æ|ø|å'. Empty = off.
BLOCKED_PATTERN="${BLOCKED_PATTERN-}"
# Space-separated whole words that never occur in the required language. Empty = off.
BLOCKED_WORDS="${BLOCKED_WORDS-}"
REQUIRED_LANGUAGE="${REQUIRED_LANGUAGE-English}"
RULE_REF="${RULE_REF-.claude/rules/commits.md}"
# -----------------------------------------------------------------------------

proj_copy="${CLAUDE_PROJECT_DIR:-}/.claude/hooks/$(basename "$0")"
if [ -f "$proj_copy" ] && [ "$(cd "$(dirname "$proj_copy")" && pwd -P)" != "$(cd "$(dirname "$0")" && pwd -P)" ]; then
  exit 0
fi

command -v jq >/dev/null 2>&1 || exit 0
input=$(cat 2>/dev/null) || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

# -m, a bundled short flag ending in m (-am), or --message.
msg_flag='(-[a-zA-Z]*m|--message)'

# Only a real commit with an inline message: a command that merely mentions
# "git commit" (grep, echo) or an editor commit must not be denied.
case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac
printf '%s' "$cmd" | grep -qE "(^|[[:space:]])${msg_flag}" || exit 0

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

if [ "$BLOCK_AI_ATTRIBUTION" = "1" ] && printf '%s' "$cmd" | grep -qiE 'co-authored-by:.*(claude|anthropic)|claude-session:|generated with|noreply@anthropic|🤖'; then
  deny "Commit message contains AI attribution, which ${RULE_REF} forbids. Remove the trailer."
fi

if [ -n "$BLOCKED_PATTERN" ] && printf '%s' "$cmd" | grep -qiE "$BLOCKED_PATTERN"; then
  deny "Commit message is not in ${REQUIRED_LANGUAGE} (${RULE_REF}). Rewrite it in ${REQUIRED_LANGUAGE}."
fi
if [ -n "$BLOCKED_WORDS" ]; then
  words=$(printf '%s' "$BLOCKED_WORDS" | tr -s ' ' '|')
  if printf '%s' "$cmd" | grep -qiwE "$words"; then
    deny "Commit message is not in ${REQUIRED_LANGUAGE} (${RULE_REF}). Rewrite it in ${REQUIRED_LANGUAGE}."
  fi
fi

# Only the first -m is the subject; later ones are body paragraphs. An unquoted value is
# read only when attached (-msubject), since a spaced one is indistinguishable from prose.
msg=$(printf '%s' "$cmd" \
  | grep -oE -- "(^|[[:space:]])(${msg_flag}[[:space:]=]*[\"'][^\"']*|(-m|--message=)[^[:space:]=\"'][^[:space:]]*)" \
  | head -1 \
  | sed -E "s/^[[:space:]]*(${msg_flag}[[:space:]=]*[\"']|-m|--message=)//")

# Heredoc and $() messages cannot be parsed reliably; let them through.
[ -z "$msg" ] && exit 0
[ "${msg#\$}" != "$msg" ] && exit 0

types=$(printf '%s' "$ALLOWED_TYPES" | tr -s ' ' '|')
if ! printf '%s' "$msg" | grep -qE "^(${types})(\([^)]*\))?!?: "; then
  deny "Commit subject must start with a type prefix (${ALLOWED_TYPES// /|}, optional (scope)) followed by ': ', per ${RULE_REF}. Got: \"${msg}\""
fi

exit 0
