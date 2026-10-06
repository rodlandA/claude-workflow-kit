# Commit Messages

## Format
```
<type>: <short description>

[optional body]
```

<!-- ADAPT: the type list must match ALLOWED_TYPES in hooks/lint-commit-message.sh. -->
| Type | Use for |
|------|---------|
| `feat` | New user-visible functionality |
| `fix` | A bug in existing functionality |
| `refactor` | Restructuring with no behaviour change |
| `docs` | Documentation only |
| `test` | Tests only |
| `chore` | Build, config, dependencies, tooling |

## Rules
- Subject under 72 characters, imperative mood ("Add export", not "Added export"), no trailing period
- The body explains **why**. The diff already shows what
- Reference the issue when there is one: `fix: map crashes on reconnect (#123)`
- One logical change per commit
<!-- ADAPT: keep or drop the two lines below. -->
- English in everything persisted to git — commits, branch names, PR titles and bodies, code comments — even when the conversation is in another language
- No AI attribution: no `Co-Authored-By: Claude`, no "Generated with", no 🤖

## Approval
Never run `git commit` or `git push` without explicit approval from the user in this
conversation. Staging and drafting the message is fine.

## NEVER
- Name the file in the subject ("Update utils.ts") — say what the change does
- Vague subjects: "Fix bug", "Update code", "Minor changes"
- Amend and force-push on a branch with an open PR — see `branch-workflow.md`
