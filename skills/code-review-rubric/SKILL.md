---
name: code-review-rubric
description: Use when a code review is requested in this repository — "review my changes", "code review", "review this branch", "check this before merge", "se over endringene". Supplies the project-specific rubric a dispatched reviewer is handed. The review itself is run by superpowers:requesting-code-review; this is its context, not a procedure for reviewing inline.
---

# Code-review rubric

What "correct" means in this repository, for the reviewer grading a diff against it.

**This is not a review procedure.** `superpowers:requesting-code-review` runs the review:
it dispatches a fresh reviewer, owns the prompt, the severity calibration and the report
format. This file supplies only what that skill cannot know.

## How this is used

*For the coordinating session. The reviewer starts at § The rubric.*

1. Run the automated checks below and report the result. A failure is a Critical finding.
2. Invoke `superpowers:requesting-code-review`. Add one line to its dispatch:
   *"Read `<absolute path>/.claude/skills/code-review-rubric/SKILL.md` and apply it."* —
   a pointer, never a copy, so the two cannot drift.
3. Scope: "my changes" → uncommitted work, base `HEAD` (untracked files appear in no
   diff — the reviewer reads them directly). "The branch" → base
   `$(git merge-base origin/<default> HEAD)`.
4. Act on the findings via `superpowers:receiving-code-review`.

**NEVER grade the diff yourself instead of dispatching.** The session that wrote the code
carries the assumptions that produced its bugs — that is why the review goes to a fresh
reviewer.

## Automated checks
<!-- ADAPT: the project's lint / typecheck / test commands, and where to run them from. -->
- `<lint command>`
- `<test command>`

## The rubric

### Before judging
- Read every changed file in full, not just the hunk
- Grep for consumers of changed functions: breaking changes, and whether the change follows the pattern its neighbours use

### Project rules
<!-- ADAPT: one line per file in .claude/rules/, naming what to check against it. -->
- [ ] `comments.md`: default no comment; one line, one per function; rationale in the commit, not the file
- [ ] `commits.md` / `issues-and-prs.md`: only if the review covers commit messages or the PR text

### Architecture
<!-- ADAPT: import direction, layering, where new code belongs. -->

### Bugs, edge cases, errors
- [ ] Null/empty/zero/negative inputs; error paths, not just the happy path
- [ ] Resources cleaned up; no leftover debug output

### Never in suggested fixes
- AI attribution in suggested code
- Refactoring beyond the actual problem
- Personal style the linter does not enforce
- Hypothetical problems — real bugs only

### Deliberate choices — do not report these
<!-- ADAPT: things that look like mistakes but are decided, each with a pointer to where the reasoning lives. Without this list the reviewer re-files them on every review. -->
