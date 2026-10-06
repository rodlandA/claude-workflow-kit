# Where Agent Instructions Go

## The tiering

| Kind | Lives in | Loads |
|------|----------|-------|
| Short, normative rules | `.claude/rules/*.md` (or `CLAUDE.md`) | in **every** session |
| Procedures and depth knowledge | `.claude/skills/<name>/SKILL.md` | **on demand**, matched to intent via `description` |
| Explicit entrypoints | `.claude/commands/<name>.md` | only when someone types `/<name>` |
| Mechanical enforcement | hooks in `settings.json` | on every matching event |

Place content by how often it is needed, not by how central it feels.

## Substance in a skill, the command a thin pointer
A skill fires when a request matches its `description`. A command fires only on its slash.
Conventions that live in a `/pr` command are silently skipped every time someone says
"open a PR" in prose. So: the procedure goes in a skill whose `description` lists the
phrases people actually use — in every language they use — and the command just says
"invoke the `<name>` skill".

## The test for a rule
A line belongs in `rules/` only if it is **normative** (says what to do next time) **and**
**stable** (a new file or component does not make it wrong).

| Question | If yes |
|---|---|
| Would `grep` or `ls` answer it? | A snapshot. Out |
| Does a commit, PR or issue already hold it? | Archaeology. Out |
| Is it the code, copied? | Teach the shape, not the instance |
| Would a new X tomorrow make it wrong? | Rewrite it as the predicate that still holds |

## Budgets
<!-- ADAPT: must match FILE_BUDGET / SECTION_BUDGET in hooks/remind-rules-budget.sh. -->
About 150 words per `###` section and 1200 per file — advisory, enforced by a reminder
hook. Crossing one re-asks the test above. A decision register is exempt from the file
budget, not the section one. Rationale and history move to a skill's `references/` or
to the commit body.

## A rule that matters is backed by a hook
A rule the agent follows 95% of the time still fails one PR in twenty. When a rule is
mechanical — a format, a forbidden path, a required check — back it with a hook. Hooks
fail open: a tooling problem lets the action through rather than blocking work.
