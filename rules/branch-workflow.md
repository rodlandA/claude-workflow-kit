# Branch Workflow

<!-- ADAPT: if the user does not want sibling worktrees, rewrite the Worktrees section to their layout (and WORKTREE_HINT in workspace-hygiene.sh to match). -->

**One task = one worktree = one branch = one PR.** The main checkout stays on the default
branch and is never worked in directly.

## Worktrees
- Create the worktree as a **sibling** of the repo: `../<repo>-<slug>/`. Never inside the
  repo (`.worktrees/`, `.claude/worktrees/`) — tools that walk the repo then see every
  worktree twice
- Create it with `git worktree add` through the shell. Claude Code's built-in worktree
  tool places worktrees inside the repo, which this rule forbids
- Several worktrees can run in parallel, one agent session each
- Run dev servers and watchers from the worktree, and stop them before removing it

## On an open PR
- Follow-up changes are **new commits and a plain push**. Never `--amend` + force-push:
  it destroys the reviewer's diff, and PRs are squash-merged anyway
- Review the branch as **one cumulative diff** against the merge-base, not commit by
  commit — that is what lands (`git review` does this, if installed)

## After merge
Remove the worktree, delete the branch locally and on the remote, and update the default
branch — the `cleaning-up-after-merge` skill. With squash merges `git branch -d` reports
"not merged"; the PR's `MERGED` state is the safety check, then `-D` is safe.

## Verify before claiming done
Run the project's check command, read the output, quote it. "Should work" is not a result,
and a green exit from a directory with no tests in it is not evidence.
