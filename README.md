# Claude Code workflow kit

A starting set of rules, skills, commands and hooks for working with Claude Code: clean
commits, PRs and issues, one worktree per task, and hooks that enforce the parts that
matter mechanically instead of hoping the model remembers.

It is not meant to be installed as-is. **Your agent adapts it to your setup.**

## Getting started

```bash
# 1. Clone the kit (anywhere; this path is used below)
git clone https://github.com/rodlandA/claude-workflow-kit.git ~/claude-workflow-kit

# 2. Start Claude Code in the project you want to set up, with the adoption prompt
cd ~/path/to/your-project
claude "Read ~/claude-workflow-kit/ADOPT.md and set this up for me."
```

The agent surveys what you already have, asks what you want, adapts each piece, shows you
every change before writing it, and tests the hooks it installs. You can stop after any
package, and run it again later for the rest.

Prerequisites: `git`, `jq`, and `gh` for the PR skills (`brew install jq gh` on macOS,
then `gh auth login`). Several skills build on the
[superpowers](https://github.com/obra/superpowers) plugin; the agent checks for it.

Later:

```bash
git -C ~/claude-workflow-kit pull                   # get kit updates
~/claude-workflow-kit/hooks/test-hooks.sh ~/.claude/hooks .claude/hooks   # re-test installed hooks
```

## The model: three layers, four kinds of file

| Layer | Where | Applies to |
|-------|-------|------------|
| Global | `~/.claude/` — `CLAUDE.md`, `rules/`, `skills/`, `commands/`, `hooks/`, `settings.json` | you, in every repo |
| Project | `<repo>/.claude/` — checked in | everyone working on that repo |
| Memory | `~/.claude/projects/…/memory/` | you; what the agent learns along the way |

The project wins where they conflict. Hooks in this kit can live in either layer: a global
copy stands down when the project ships its own, so nothing fires twice.

| Kind | Loads | For |
|------|-------|-----|
| `rules/*.md` | every session | short, normative rules |
| `skills/*/SKILL.md` | on demand, matched to what you ask | procedures: commit, PR, cleanup, review |
| `commands/*.md` | when you type `/name` | thin pointers to a skill |
| hooks | on every matching event | mechanical enforcement |

Why skills over commands: "open a PR" in plain words reaches a skill just as `/pr` does.
Conventions that only live in a command are skipped whenever someone asks in prose.

## The workflow it supports

One task = one worktree = one branch = one PR. The main checkout stays on the default branch.

1. **Start a session.** `workspace-hygiene` warns if you are about to work on the default
   branch directly, or if it is behind origin.
2. **Create a worktree** as a sibling, `../<repo>-<slug>/`. `open-worktree-in-editor`
   opens it.
3. **Work.** The agent explains the cause and the proposed fix before editing.
4. **Verify.** Run the checks and read the output. `verify-on-stop` can block "done"
   while a check still fails.
5. **Commit** via the `committing` skill — conventional message, and never without your
   approval. `lint-commit-message` is the safety net.
6. **Review** the branch as one diff (`tools/git-review`), and have a *fresh* agent review
   it with the project's rubric — never the session that wrote the code.
7. **Open the PR** via `creating-pull-requests`. Afterwards the agent waits for CI and the
   automated review, verifies each finding, and resolves the threads it fixed.
8. **Changes on an open PR** are new commits and a plain push, never amend + force-push.
9. **After merge**, `cleaning-up-after-merge` removes the worktree and branch and updates
   the default branch.

## What is in here

| Path | What |
|------|------|
| `ADOPT.md` | Instructions for the agent doing the setup |
| `global/CLAUDE.md` | Personal working rules template |
| `rules/` | Commits, issues and PRs, branch workflow, comments, where instructions go |
| `skills/` | `committing`, `creating-pull-requests`, `cleaning-up-after-merge`, `code-review-rubric` (template) |
| `commands/` | `/commit`, `/pr`, `/review`, `/cleanup-branch` |
| `hooks/` | Generic hooks, each configured through a Config block, plus `test-hooks.sh` |
| `patterns/` | Project-specific hook shapes to rewrite for your stack |
| `tools/` | `git-review`, and pointers to optional extras |

All hooks fail open: a missing tool or an unparseable payload lets the action through
rather than blocking your work. The one thing they cannot detect is a check that is installed
but misconfigured — `verify-on-stop` will then block until it is fixed.
