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
force-push with no bypass. `main: admins only` lets only repository admins update the branch,
by merging a PR or pushing directly; anyone else, collaborators with write access included,
can open a PR but not merge it. It also sets squash-only merges, deletes branches on merge,
requires approval before workflows run on any outside contributor's PR, and turns on secret
scanning with push protection. Rerunning it updates the rulesets by name instead of adding
duplicates. Needs `gh` and `jq`.

## `package-skill`

Zips a skill as committed, for uploading to a skill marketplace.

```
package-skill skills/explaining-visually         ./explaining-visually.zip
package-skill skills/foo -o ~/Downloads/foo.zip  another output path
```

Only files tracked at `HEAD` go in, under a `<skill-name>/` folder, so local edits and ignored
files such as `node_modules` never ship. It refuses while the skill has uncommitted changes,
and prints the last commit that touched the skill: note it with the upload, and
`git log <that commit>..HEAD -- skills/<name>` later shows whether the listing is stale.

## Not included, worth knowing about

- **A sound when the agent waits for you** — the `Notification` and `PermissionRequest`
  hook events. `peon-ping` (search GitHub) is a ready-made one; a one-line
  `afplay /System/Library/Sounds/Glass.aiff` hook does the same on macOS.
- **Terminal tab title showing working/ready** — a hook on `UserPromptSubmit`, `Stop` and
  `Notification` that prints an OSC title escape. Terminal-specific, so write it for yours.
