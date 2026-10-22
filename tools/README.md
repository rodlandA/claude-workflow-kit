# Tools

Optional. None of the rules, skills or hooks depend on these.

## `git-review`

Shows everything a PR would land — the cumulative diff against the merge-base with the
default branch, the same set GitHub shows under "Files changed".

```
git review                 side-by-side in the browser, with a file list
git review feat/foo        another branch, without checking it out
git review ../myrepo-foo   a worktree, by path
git review --doc           one unified diff in the editor
git review --web           GitHub's compare page
```

Install: copy it onto your `PATH` as `git-review` (e.g. `~/.local/bin/`), and `git review`
works as a subcommand. Check that `command -v git-review` prints the path you installed
to — if it prints another one, an older copy shadows it; if nothing, add
`export PATH="$HOME/.local/bin:$PATH"` to your shell profile. Help is `git review -h`
(git intercepts `--help` and looks for a man page). Needs `node`/`npx` for the side-by-side view (falls back to
`--doc` without it). Uses `open`, so macOS as written — swap in `xdg-open` on Linux.

## `protect-public-repo`

Locks down a public repository you maintain alone: anyone can fork and open a PR, only you
merge, and nobody rewrites the default branch.

```
protect-public-repo                  the repo in the current directory
protect-public-repo owner/repo       another repo
```

It creates two rulesets on the default branch. `main: no rewrite` blocks deletion and
force-push with no bypass. `main: PR only` requires a PR (0 approvals, squash only, linear
history), and repository admins bypass it so you can still push directly. It also sets
squash-only merges, deletes branches on merge, requires approval before workflows run on any
outside contributor's PR, and turns on secret scanning with push protection. Rerunning it
updates the rulesets by name instead of adding duplicates.

The rulesets only matter once someone else has write access. Until then, being the sole
collaborator is what keeps others from merging. Needs `gh` and `jq`.

## Not included, worth knowing about

- **A sound when the agent waits for you** — the `Notification` and `PermissionRequest`
  hook events. `peon-ping` (search GitHub) is a ready-made one; a one-line
  `afplay /System/Library/Sounds/Glass.aiff` hook does the same on macOS.
- **Terminal tab title showing working/ready** — a hook on `UserPromptSubmit`, `Stop` and
  `Notification` that prints an OSC title escape. Terminal-specific, so write it for yours.
