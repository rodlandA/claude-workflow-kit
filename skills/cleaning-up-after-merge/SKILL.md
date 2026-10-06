---
name: cleaning-up-after-merge
description: Use after a pull request is merged to reclaim the workspace — remove the worktree, delete the local and remote branch, update the default branch. Triggers on "clean up after merge", "the PR is merged", "remove the worktree", "delete the merged branch", "rydd opp etter merge".
---

# Cleaning up after a merge

The bookend to creating a worktree. The `workspace-hygiene` hook keeps saying the default
branch is behind until this is done.

**Squash merges:** the branch tip never appears in the default branch's history, so
`git branch -d` reports "not merged". That is expected. The safety check is the PR state,
not git ancestry.

## Steps

1. **Confirm the PR is merged.** Never delete unmerged work.
   ```bash
   gh pr view <number-or-branch> --json state -q .state   # expect MERGED
   ```

2. **Stop anything running from the worktree** — dev servers, watchers, test runners.
   <!-- ADAPT: add one `lsof -nP -iTCP:<port> -sTCP:LISTEN` line per dev-server port the project uses, or delete this marker if it runs none. -->
   ```bash
   lsof -nP +D ../<repo>-<slug> 2>/dev/null | head   # processes holding files in the worktree
   ```

3. **Close the editor window on that folder first.** Left open, it survives the deletion
   pointing at a missing path and reopens as a broken workspace. Ask the user to close it,
   or close it yourself if you can verify that it closed.

4. **From the main checkout**, remove the worktree (you cannot remove the one you stand in):
   ```bash
   cd <main checkout>
   git worktree remove ../<repo>-<slug>
   # --force only if it refuses over build output, after confirming nothing uncommitted is lost
   ```

5. **Delete the local branch** — `-D`, since the MERGED state is the check:
   ```bash
   git branch -D <branch>
   ```

6. **Delete the remote branch** unless GitHub already did:
   ```bash
   git push origin --delete <branch>
   ```

7. **Update the default branch:**
   ```bash
   BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's|^origin/||')
   git checkout "$BASE" && git pull --ff-only origin "$BASE"
   ```

`git worktree list` should no longer show it.
