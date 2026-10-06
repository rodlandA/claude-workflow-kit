---
name: creating-pull-requests
description: Use when opening or editing a pull request — "open a PR", "create a pull request", "lag PR", "PR den". Writes the title and body in the format from the issues-and-prs rule, asks for approval, creates it, then waits for CI and the automated review and reports both. Apply even when the user did not type /pr.
---

# Creating pull requests

The format is mandatory whenever a PR is opened, slash command or not.

## Step 1: Branch state
```bash
BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's|^origin/||')
git branch --show-current
git log "origin/$BASE"..HEAD --oneline
git diff "origin/$BASE"...HEAD --stat
```
Stop if on the base branch or there are no commits ahead of it.

## Step 2: Push
```bash
git status -sb
```
Not pushed → `git push -u origin HEAD`.

## Step 3: Understand the whole branch
Read every commit (`git log "origin/$BASE"..HEAD --format='%s%n%b'`) and the key changed
files. The PR describes the cumulative diff, not the last commit.

## Step 4: Write title and body
Per the `issues-and-prs.md` rule (in `.claude/rules/` or `~/.claude/rules/`). Title `<type>: <description>`; for `fix:`, the
bug the user saw. Body: Summary, Changes, `Closes #N` when tied to an issue. No AI
attribution, no empty sections, no file list.

## Step 5: Ask for approval
Show title and body. Ask: create as-is / change / cancel.

## Step 6: Create
```bash
gh pr create --base "$BASE" --title "<title>" --body "<body>"
```
Show the URL.

## Step 7: Follow up
Opening the PR is not the end of the task. Report what follows without being asked.

<!-- ADAPT: delete 7a if the repo has no CI. Delete 7b whole if no automated reviewer (e.g. Copilot) is enabled, and then also drop "and the automated review" from the description in the frontmatter. -->

### 7a. CI
Wait for every workflow run on the PR's head commit to complete — run the loop in the
background. It gives up after 30 minutes, since a path filter or a disabled workflow
means no run ever starts:
```bash
SHA=$(gh pr view <N> --json headRefOid -q .headRefOid)
for _ in $(seq 1 60); do
  gh run list --commit "$SHA" --json status --jq 'length > 0 and all(.[]; .status == "completed")' \
    | grep -qx true && break
  sleep 30
done
gh pr checks <N>
```
`gh pr checks --watch` started right after `gh pr create` can exit green before CI has
even registered its jobs — do not rely on it. On failure, read `gh run view <run-id> --log-failed`.

### 7b. Automated review
Read the review, including inline comments, which `gh pr view --json comments` does
not show:
```bash
gh pr view <N> --json reviews --jq '.reviews[] | "\(.author.login) [\(.state)]: \(.body)"'
gh api --paginate repos/{owner}/{repo}/pulls/<N>/comments \
  --jq '.[] | "--- \(.user.login) @ \(.path):\(.line // .original_line)\n\(.body)"'
```

**Verify each finding before acting on it.** An automated reviewer pattern-matches the
surrounding code; it is capable of both a precise catch and a confident invention. Check
the spec, schema or code, then either fix it or reply on the thread with the evidence.

**Resolve threads you fixed; leave the ones you argued against** for a human to close.
Threads can only be resolved through GraphQL:
```bash
gh api graphql -f id="<threadId>" -f query='
  mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { isResolved } } }'
```
List unresolved thread ids with the `reviewThreads` field on `repository.pullRequest`.
