#!/usr/bin/env bash
# Checks the outcome of an ADOPT.md test run independently of the agent's own report.
#
#   tests/adopt/check.sh <dir>     # the same <dir> given to setup.sh

set -u

if [ $# -ne 1 ] || [ ! -d "$1/work/acme-api" ]; then
  echo "usage: $0 <dir prepared by setup.sh>" >&2
  exit 2
fi

KIT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib.sh
. "$KIT/tests/adopt/lib.sh"
S="$(cd "$1" && pwd)"
R="$S/work/acme-api"
FAILS=0

check() {
  if [ "$2" = "ok" ]; then
    printf '  ok    %s\n' "$1"
  else
    printf '  FAIL  %s: %s\n' "$1" "$2"
    FAILS=$((FAILS + 1))
  fi
}

echo "Isolation"
if [ "$(claude_snapshot)" = "$(cat "$S/real-claude-before.sha")" ]; then
  check "real ~/.claude unchanged" ok
else
  check "real ~/.claude unchanged" "checksums differ: compare against $S/real-claude-before.sha"
fi
if [ "$(git -C "$KIT" rev-parse HEAD)" = "$(cat "$S/kit-before.sha")" ] \
   && [ "$(git -C "$KIT" status --porcelain)" = "$(cat "$S/kit-before.status")" ]; then
  check "kit unchanged" ok
else
  check "kit unchanged" "HEAD or working tree changed"
fi

echo "Result"
for f in "$S/home/.claude/settings.json" "$R/.claude/settings.json"; do
  if jq . "$f" >/dev/null 2>&1; then
    check "parses: ${f#"$S"/}" ok
  else
    check "parses: ${f#"$S"/}" "invalid JSON"
  fi
done
if jq -e '.hooks.Notification' "$S/home/.claude/settings.json" >/dev/null 2>&1; then
  check "existing global Notification hook kept" ok
else
  check "existing global Notification hook kept" "missing"
fi
if grep -q 'pnpm-style terse answers' "$S/home/.claude/CLAUDE.md" 2>/dev/null; then
  check "existing global CLAUDE.md content kept" ok
else
  check "existing global CLAUDE.md content kept" "missing"
fi
left=$(grep -rln 'ADAPT' "$S/home/.claude" "$R/.claude" 2>/dev/null | grep -v '/adopt-backups/')
check "no unresolved ADAPT markers" "$( [ -z "$left" ] && echo ok || echo "$left" )"
stray=$(git -C "$R" status --porcelain | grep -E '\.bak|backup' || true)
check "no backups inside the repo" "$( [ -z "$stray" ] && echo ok || echo "$stray" )"
if ls "$S"/home/.claude/adopt-backups/*/MANIFEST.md >/dev/null 2>&1; then
  check "MANIFEST.md written" ok
else
  check "MANIFEST.md written" "missing"
fi
if [ -n "$(git -C "$R" log origin/main..HEAD --oneline 2>/dev/null)" ] || [ "$(git -C "$R" rev-list --count HEAD)" != "3" ]; then
  check "nothing committed" "new commits found"
else
  check "nothing committed" ok
fi

echo "Installed hooks"
dirs=()
for d in "$S/home/.claude/hooks" "$R/.claude/hooks"; do
  if [ -d "$d" ]; then
    dirs+=("$d")
  fi
done
if [ "${#dirs[@]}" -gt 0 ]; then
  if (cd "$R" && "$KIT/hooks/test-hooks.sh" "${dirs[@]}" >"$S/check-hooks.log" 2>&1); then
    check "test-hooks.sh on installed copies" ok
  else
    check "test-hooks.sh on installed copies" "see $S/check-hooks.log"
  fi
fi

echo
if [ "$FAILS" -eq 0 ]; then
  echo "All checks passed."
else
  echo "$FAILS check(s) failed."
  exit 1
fi
