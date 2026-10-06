#!/usr/bin/env bash
# Builds a disposable environment for an ADOPT.md test run: a simulated home with an
# existing Claude Code setup to merge into, a small TypeScript API repo with an origin,
# and a checksum of the real ~/.claude so check.sh can prove the run never touched it.
#
#   tests/adopt/setup.sh <dir>     # <dir> must be outside the kit; it is wiped first

set -eu

if [ $# -ne 1 ]; then
  echo "usage: $0 <dir>" >&2
  exit 2
fi

KIT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib.sh
. "$KIT/tests/adopt/lib.sh"
parent="$(cd "$(dirname "$1")" && pwd)" || exit 2
case "$parent/$(basename "$1")/" in
  "$KIT/"*) echo "refusing: $1 is inside the kit" >&2; exit 2 ;;
esac
mkdir -p "$1"
S="$(cd "$1" && pwd)"

rm -rf "$S/home" "$S/work" "$S/remote.git" "$S/questions.md"
mkdir -p "$S/home/.claude" "$S/work"
cp "$KIT/tests/adopt/persona.md" "$S/persona.md"

cat > "$S/home/.claude/CLAUDE.md" <<'EOF'
# My preferences

- Use pnpm-style terse answers, no long explanations.
- Prefer functional style over classes in TypeScript.
EOF

cat > "$S/home/.claude/settings.json" <<'EOF'
{
  "permissions": { "allow": ["Bash(npm test:*)"] },
  "hooks": {
    "Notification": [
      { "hooks": [{ "type": "command", "command": "afplay /System/Library/Sounds/Glass.aiff" }] }
    ]
  }
}
EOF

git init -q --bare -b main "$S/remote.git"
R="$S/work/acme-api"
mkdir -p "$R/src/api" "$R/src/generated" "$R/.github/workflows" "$R/.claude"
cd "$R"
git init -q -b main
git config user.email dev@example.com
git config user.name Dev

cat > package.json <<'EOF'
{
  "name": "acme-api",
  "private": true,
  "scripts": {
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "check": "npm run lint && npm run typecheck && npm test",
    "generate:client": "openapi-typescript openapi.yaml -o src/generated/client.ts"
  }
}
EOF
echo 'export const users = () => [];' > src/api/users.ts
echo '// generated' > src/generated/client.ts
echo 'openapi: 3.0.0' > openapi.yaml
printf 'name: ci\non: [pull_request]\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci && npm run check\n' > .github/workflows/ci.yml
echo '{ "permissions": { "allow": ["Bash(npm run check)"] } }' > .claude/settings.json
echo 'node_modules/' > .gitignore

git add -A
git commit -q -m "chore: initial project setup"
echo 'export const health = () => "ok";' > src/api/health.ts
git add -A
git commit -q -m "feat: add health endpoint"
echo 'export const users = () => [] as string[];' > src/api/users.ts
git add -A
git commit -q -m "fix: users endpoint returns typed list"

git remote add origin "$S/remote.git"
git push -q -u origin main
git remote set-head origin main

claude_snapshot > "$S/real-claude-before.sha"
git -C "$KIT" rev-parse HEAD > "$S/kit-before.sha"
git -C "$KIT" status --porcelain > "$S/kit-before.status"

echo "Environment ready: S=$S"
echo "Next: give an agent tests/adopt/prompt.md with KIT=$KIT and S=$S, then run tests/adopt/check.sh $S"
