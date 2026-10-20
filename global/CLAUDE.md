# Personal working rules

<!-- ADAPT: this file goes in ~/.claude/CLAUDE.md and applies to every repo. Merge into an
existing one; keep only the sections the user chose. -->

These apply in every project. A project's own CLAUDE.md and rules/ win where they conflict.

## Language

<!-- ADAPT: conversation language, or drop the section. -->
<Language> in conversation. **English in everything persisted to git or GitHub** — commit
messages, branch names, PR titles and bodies, code comments, issue titles.

## Answer shape

<!-- ADAPT: the reader's level and screen setup; drop the section to keep Claude's default. -->
I'm a senior developer and read answers in a small terminal pane, where the bottom of the
answer is what's visible.

- **Short enough to fit on screen.** Most answers should be readable without scrolling.
- **The bottom line goes last.** The final lines hold the answer, the finding, or what I
  need to decide or do. If I only read them, I have what matters.
- **Mark what needs action.** Decisions and warnings are stated explicitly and never sit in
  the middle of prose.
- **No flourish.** No preamble, no praise, no explaining concepts a senior developer knows.
  Plain words, short sentences.
- **Explain only what changes my next step.** Background and investigation history only
  when I ask.
- **One recommendation, not a survey.**

## Git

<!-- ADAPT: if package A's rules (commits.md, branch-workflow.md) are installed globally,
keep only the approval line here — the rest would say the same thing twice. If A is
project-only, keep the whole section: it is what applies in every other repo. -->

- **Never commit or push without explicit approval.** Staging and drafting the message is
  fine; running `git commit` is not, in any permission mode.
- **No AI attribution** in commits or PRs.
- **Conventional subject prefix**: `feat` `fix` `refactor` `docs` `test` `chore`. The body
  explains why; the code already shows what.
- **Follow-up commits, not amend.** On an open PR branch, new changes are new commits plus
  a plain push — never `--amend` + force-push.
- **Worktrees are siblings**: `../<repo>-<slug>/`, never nested inside the repo.
- Review a branch as one cumulative diff against the merge-base, not commit by commit.

## Working style

<!-- ADAPT: if rules/working-principles.md is installed in ~/.claude/rules/, delete this
section — that file covers it at length. Keep it if the principles are project-only. -->

- **Explain before changing.** State the root cause and the proposed fix before editing
  code. Don't open with a patch.
- **Verify before claiming done.** Run the command, read the output, quote it. "Should
  work" is not a result.
- **One centralized check, not guards scattered everywhere.** Two interactions that are
  "the same thing" share one mechanism.
- **Follow the existing pattern first.** Find how the codebase already solves this and copy
  its shape. Deviating needs a stated reason.

## Code style

<!-- ADAPT: keep what matches the user's taste; this is opinion, not convention. -->
- Braces always — no single-line `if`.
- Short functions, few branches. No nested ternaries.
- The default is no comment. One line at most, only for what the code cannot show.
