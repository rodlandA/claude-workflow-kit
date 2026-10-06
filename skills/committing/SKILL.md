---
name: committing
description: Use when creating a git commit — "commit this", "commit the changes", "lag en commit", "commit det". Validates the code, writes a conventional message per the commits rule, and asks for approval before committing.
---

# Committing changes

The commit flow, whether the user typed `/commit` or just asked in prose.

## Step 1: Check what is staged
```bash
git status
git diff --cached --stat
```
Nothing staged → say so and propose which files to stage. Do not stage unrelated changes.

## Step 2: Validate
<!-- ADAPT: the project's fast check command(s), and which paths trigger which. -->
Run the project's check command for what changed, e.g. `npm run lint && npm test`.

Checks fail → show the errors and stop. Never commit broken code.

## Step 3: Read the change
```bash
git diff --cached
```
Work out the purpose, the type, and whether it is one logical change. Two unrelated
changes → propose splitting them.

## Step 4: Write the message
Per the `commits.md` rule (in `.claude/rules/` or `~/.claude/rules/`): `<type>: <subject>`, imperative, under 72 characters, a
body that explains why when the why is not obvious.

## Step 5: Ask for approval
Show the staged files and the proposed message. Ask: commit as-is / change the message /
cancel. Never commit without an explicit yes.

## Step 6: Commit
```bash
git commit -m "<subject>" -m "<body>"
```
Show the result (`git log --oneline -1`). Do not push unless asked.

> The `lint-commit-message` hook independently blocks a bad prefix and AI attribution —
> but write it right the first time.
