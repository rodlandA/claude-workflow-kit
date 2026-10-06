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

## Not included, worth knowing about

- **A sound when the agent waits for you** — the `Notification` and `PermissionRequest`
  hook events. `peon-ping` (search GitHub) is a ready-made one; a one-line
  `afplay /System/Library/Sounds/Glass.aiff` hook does the same on macOS.
- **Terminal tab title showing working/ready** — a hook on `UserPromptSubmit`, `Stop` and
  `Notification` that prints an OSC title escape. Terminal-specific, so write it for yours.
