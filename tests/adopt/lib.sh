# Sourced by setup.sh and check.sh.

# Checksums of the parts of a ~/.claude an adoption could write to. Only scripts under
# hooks/, since hooks may keep their own state files there.
claude_snapshot() {
  [ -d "$HOME/.claude" ] || return 0
  (
    cd "$HOME/.claude" || exit 0
    # find exits non-zero for a missing path; under a caller's `set -e` that would end the list early.
    { find CLAUDE.md settings.json rules skills commands -type f 2>/dev/null || true
      find hooks -type f -name '*.sh' 2>/dev/null || true; } | sort | while IFS= read -r f; do shasum "$f"; done
  )
}
