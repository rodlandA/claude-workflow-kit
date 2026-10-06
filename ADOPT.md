# ADOPT.md — instructions for the agent setting this up

You are helping a user adopt parts of this kit into their own Claude Code setup. The kit
is a starting point written for someone else's workflow. Your job is to make it **theirs**:
fitted to their repo, their stack and their taste, with nothing installed they did not
choose.

`KIT` below means the directory this file is in. `~` means the user's home.

## Ground rules

- **Never overwrite.** Existing `CLAUDE.md`, rules, skills and `settings.json` entries are
  merged into, never replaced.
- **Back up before editing**, and never inside a repo: copy every existing file you are
  about to change — settings files and `CLAUDE.md` alike — into
  `~/.claude/adopt-backups/<date>/`, as `home/<path under ~>` or `repos/<repo name>/<path in
  repo>`. A backup in the repo's working tree gets committed by the next `git add -A`.
- **Keep a manifest** at `~/.claude/adopt-backups/<date>/MANIFEST.md`: every file you
  added or changed, and every hook entry you added to a `settings.json`. It is the undo list.
- **Merging JSON reformats it.** That is fine; show the user the semantic change (the
  entries added), not a whitespace diff.
- **Show before writing, one package at a time.** Present each package's files together —
  content or diff — and get one yes for the package. Writing to `~/.claude/` affects every
  repo the user works in; say so when you propose it.
- **Ask one question at a time**, with a recommended answer. Infer what you can from the
  survey and ask only what you cannot.
- **Resolve every `ADAPT` marker.** Markdown files carry `<!-- ADAPT: ... -->` comments;
  resolve each, then delete the comment. Hooks are different: their settings live in a
  `# --- Config ---` block with working defaults — set the values, keep the block.
- **The user can stop after any package.** A partial adoption is a valid outcome.
- **Do not commit** the result unless the user asks.

## Step 1: Survey (no questions yet)

Read, and summarise in a few lines:

- `~/.claude/CLAUDE.md`, `~/.claude/rules/`, `~/.claude/skills/`, `~/.claude/settings.json`
- The current repo, if any: `.claude/` (rules, skills, commands, hooks, `settings.json`), `CLAUDE.md`, `AGENTS.md`
- Default branch: `git symbolic-ref --short refs/remotes/origin/HEAD`
- Commit style already in use: `git log --oneline -30`
- Stack and check commands: `package.json` scripts, `Makefile`, `pyproject.toml`, `*.sln`, CI workflow files
- **Whether those check commands actually run here.** Try the fast one (lint) once. If it
  fails for setup reasons — no lockfile, dependencies not installed, no linter config — note
  it: the skills and hooks that call it will not work until it does, and the user should know.
- Tools: `jq`, `gh` (and `gh auth status`), an editor CLI (`code`, `cursor`)
- Plugins: is `superpowers` installed? (`ls ~/.claude/plugins`, or ask the user to run `/plugin`)

Missing `jq` → every hook silently does nothing. Say so and offer the install command
before installing any hook.

## Step 2: Explain the layers, then agree on scope

Tell the user, briefly, what `README.md` § "The model" says: global vs project vs memory,
and that the project wins. Then agree on:

- **Global, project, or both?** Personal working style goes global; anything the team
  should share goes in the repo's `.claude/` and is checked in.
  - Global rules go in `~/.claude/rules/`, global skills in `~/.claude/skills/`, global
    commands in `~/.claude/commands/`, global hooks in `~/.claude/hooks/`.
  - **A skill and the rules it reads go in the same layer**, and a hook's `RULE_REF` names
    the file where that rule actually ended up. See § References between files.
  - Hooks in `hooks/` work in either layer: a global copy stands down when the project
    ships its own file of the same name.
- **Recommended split for package A** when the repo is shared: the rules, skills, commands
  and the commit hook go in the project, so the team gets one convention. A personal
  preference that should hold in *every* repo — git in English, no AI attribution —
  additionally gets a global copy of the commit hook; inside this repo the project copy
  wins. Keep personal language blocks out of the project copy unless the whole team
  agrees: it applies to teammates too.
- **Which packages**, from the list below. Recommend starting with A.

## Step 3: Packages

Do them in order; each is useful alone.

### A. Git hygiene (recommended first — stack-independent)

| File | Goes to | Adapt |
|------|---------|-------|
| `rules/commits.md` | rules dir of the chosen layer | Type list; the English-in-git line and the attribution line are choices — ask |
| `rules/issues-and-prs.md` | same | Release-notes section only if they generate notes from PR titles — look for release tooling in CI before asking |
| `rules/branch-workflow.md` | same | Worktree layout, if they object to siblings |
| `skills/committing/` | skills dir of the same layer | The validation command found in Step 1 |
| `skills/creating-pull-requests/` | same | Drop the CI step if there is no CI; drop the review part if no automated reviewer is enabled |
| `skills/cleaning-up-after-merge/` | same | Dev-server ports; whether they squash-merge |
| `commands/commit.md`, `pr.md`, `cleanup-branch.md` | commands dir of the same layer | Nothing — they only point at the skills |
| `hooks/lint-commit-message.sh` | hooks dir of the chosen layer | Config must match `commits.md`; `RULE_REF` must name where `commits.md` was installed |
| `hooks/workspace-hygiene.sh` | same | `WORKTREE_HINT`, only if worktrees are not siblings |
| `hooks/open-worktree-in-editor.sh` | global | `EDITOR_CANDIDATES` — offer it when they use worktrees and VS Code or Cursor |

**Language.** For a Norwegian speaker who wants English in git, set in the commit hook:

```bash
BLOCKED_PATTERN="${BLOCKED_PATTERN-æ|ø|å}"
BLOCKED_WORDS="${BLOCKED_WORDS-ikke endre endret endring oppdater fjern}"
```

Same idea for other languages: a few characters and words that never occur in English.

**AI attribution.** If they want none, the mechanism is Claude Code's `attribution`
setting; the hook is only the safety net. Use the form every version accepts:

```json
"attribution": { "commit": "", "pr": "", "sessionUrl": false }
```

Do **not** use `"attribution": false` — versions before 2.1.281 reject it and skip the
whole settings file, hooks included. If the rule is a team rule, put the setting in the
project's `settings.json` too; otherwise teammates' default commits carry the trailer and
the project hook denies them.

If their commit log uses a different convention, follow theirs: adapt the rule and the
hook to it rather than imposing this one.

### B. Personal working rules

`global/CLAUDE.md` → merged into `~/.claude/CLAUDE.md`. Go section by section. If package A
is installed **globally**, the Git section shrinks to what A does not cover; if A is
project-only, keep the section whole — it is what applies in every other repo.
The Code style section is opinion: offer it, don't push it.

### C. Keeping instructions lean

`rules/where-things-go.md` → rules dir, plus `hooks/remind-rules-budget.sh` in the same
layer, with its `RULE_REF` pointing at where `where-things-go.md` went. Worth it once a repo
has more than a handful of rules files.

`rules/comments.md` is **opinion**, like B's Code style — offer it separately, and only
install it if they want it. Adapt it to the language: `@param` is the convention for public
API in some languages (C#, Java), and wrong to forbid there.

### D. Independent code review

`skills/code-review-rubric/` + `commands/review.md`. Requires superpowers — offer to
install it, otherwise skip D. Fill the rubric's ADAPT sections from the repo's real rules
and check commands. The "Deliberate choices" list is the most valuable part and only the
user can supply it — ask for two or three things a reviewer always flags wrongly.

### E. Patterns

Read `patterns/README.md`, then ask what in **this** repo matches each shape. Install
only a pattern with a concrete target: an actual generated directory, an actual
"X makes Y stale" pair, an actual fast per-file check. A pattern with no target is noise.

For `remind-on-change.sh`: confirm Y really depends on X. If the generator reads a spec
file rather than the source directory, watching the source reminds about a step that
does nothing — watch the spec, or word the reminder as "update the spec, then regenerate".

For `verify-on-stop.sh`, check the tool before registering it:

| State | What to do |
|-------|------------|
| Installed, config present, runs clean on a known-good file | Register it |
| Not installed, **and** its config file exists (e.g. `eslint.config.*`) | Register it; it stays silent until the tool is installed |
| Config missing, or the tool errors on a known-good file | Do not register it. List it as an open item: once installed without a config, it would block every turn |

Set `EXCLUDE_PATTERN` for generated output, so a regeneration does not trip the check.

### F. Tools

`tools/README.md`. Offer `git-review`; after installing it, confirm `command -v git-review`
prints the path you installed to — not another copy, and not nothing (`tools/README.md`
has the PATH line). If F is skipped, remove the `git review` mention from `branch-workflow.md`.

## References between files

Moving a file to another layer breaks whatever names its path. Check these after any
placement decision:

| File | Refers to |
|------|-----------|
| `skills/committing` | `commits.md` |
| `skills/creating-pull-requests` | `issues-and-prs.md` |
| `hooks/lint-commit-message.sh` | `RULE_REF` → `commits.md` |
| `hooks/remind-rules-budget.sh` | `RULE_REF` → `where-things-go.md` |
| `rules/branch-workflow.md` | `git review` (package F), `cleaning-up-after-merge` skill |
| `rules/commits.md` | `branch-workflow.md` |
| `skills/code-review-rubric` | every installed rules file, by name |

## Step 4: Register hooks

Merge into the chosen `settings.json`, following `hooks/settings.example.json`:

- Global hooks: `$HOME/.claude/hooks/<name>.sh` (hooks run through a shell, so `$HOME`
  expands). Project hooks: `"$CLAUDE_PROJECT_DIR"/.claude/hooks/<name>.sh`
- Keep the user's existing hook entries; add yours beside them under the same event
- `chmod +x` every installed script
- `jq . <settings file>` must parse — a settings file that does not parse is skipped whole

## Step 5: Verify

Not optional, and "should work" does not count.

1. **The mechanism.** Run the kit's harness on every layer you installed into, and show
   the output. It tests every copy it finds, including the stand-down between layers:
   ```bash
   KIT/hooks/test-hooks.sh ~/.claude/hooks <repo>/.claude/hooks
   ```
   Any `ERROR(...)` means the hook crashed, wrote to stderr or is not executable.
2. **The user's configuration.** For every installed hook, one payload that should fire
   and one that should not, with no environment overrides, run from the repo. Silence
   alone proves nothing — a hook that never fires is also silent. `<layer>` is
   `~/.claude` or `<repo>/.claude`, wherever that hook went.
   - A payload that should be denied must contain what the config blocks: for the
     language check, a character from `BLOCKED_PATTERN` or a word from `BLOCKED_WORDS`.
   - A command containing `git commit -m` plus blocked text is denied by the installed
     hook itself — even a heredoc that writes it. Create such payloads as files **with
     the Write tool**, then pipe the file into the hook.
   ```bash
   jq -n '{tool_input:{command:"git commit -m \"feat: add x\""}}' | <layer>/hooks/lint-commit-message.sh      # silent
   <layer>/hooks/lint-commit-message.sh < payload-blocked.json                                               # deny
   (cd <repo> && CLAUDE_PROJECT_DIR=$PWD <layer>/hooks/workspace-hygiene.sh)                                 # nudge on the default branch
   jq -n '{tool_input:{file_path:"<repo>/<PROTECTED_PATH>/x"}}' | <layer>/hooks/protect-generated-files.sh   # deny
   jq -n '{tool_input:{file_path:"<repo>/<a path matching WATCH_GLOB>"}}' | <layer>/hooks/remind-on-change.sh # reminder
   jq -n --arg c "git worktree add <existing worktree path>" --arg d "<repo>" \
     '{tool_input:{command:$c},cwd:$d}' | EDITOR_DRY_RUN=1 <layer>/hooks/open-worktree-in-editor.sh          # "would open …"
   ```
   For `remind-rules-budget`, edit a copy of a rules file past the budget. For
   `verify-on-stop`, change a matching file so the check has something to run on, then
   `echo '{"stop_hook_active":false}' | CLAUDE_PROJECT_DIR=<repo> <layer>/hooks/verify-on-stop.sh`.
   Denials print a `deny` JSON, reminders an `additionalContext` JSON, a block a
   `"decision":"block"` JSON.
3. `grep -rn 'ADAPT' <every installed directory>` — must return nothing.
4. Ask the user to start a new session (hooks and rules load at session start) and run
   `/hooks` to confirm the registrations are live.

## Step 6: Hand over

Give the user:

- **A table** of what was installed, where, and what was skipped and why.
- **The day-to-day picture**: point to `README.md` § "The workflow it supports", and say
  which of its steps do not apply to what they installed.
- **What is uncommitted**: new files under the repo's `.claude/` are meant to be reviewed
  and checked in by the user, so the team gets them.
- **How to undo**: point to `~/.claude/adopt-backups/<date>/MANIFEST.md` and the backups
  beside it.
- **Open items** from Step 1, e.g. a check command that does not run yet.
