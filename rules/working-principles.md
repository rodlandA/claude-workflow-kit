# Working Principles

## Write it the way this codebase already writes it

**Before writing anything new, find how the codebase already does the same kind of thing,
and copy its shape.** Consistency beats personal preference, including yours and the
model's. A second way of doing something is a cost every later reader pays.

Look, in this order:
1. The nearest sibling — the file next to where yours will go, the component or service that does the most similar job
2. The project's own rules and decision records (`.claude/rules/`, `CLAUDE.md`, `docs/`)
3. The rest of the codebase, by grep

Then match it on every axis:
- **Location** — put the file where its siblings live. Do not create a directory when an existing one fits; a new directory is a structural decision
- **Naming** — files, functions, variables, tests: the convention already in that folder
- **Shape** — file layout, ordering, how errors are handled, how state is held, how things are wired together
- **Style** — formatting, comment density, idioms. Do not introduce a pattern, syntax or abstraction the file does not already use
- **Dependencies** — do not add a library for something the codebase already solves

**Leave what you did not come to change.** No reformatting, renaming or "modernising" of
untouched code in passing. It hides the real change in the diff.

## Deviating is the exception

Doing it differently needs a stated reason: the existing pattern does not fit this case
(say why), it is known debt being paid down, or the user agreed to a new direction. If
unsure whether to follow or deviate, ask — do not decide silently.

## One mechanism, not parallel systems

When two things are "the same thing", they share one mechanism. Before adding a check, a
helper or a code path, look for the one that already does the job and extend it. Prefer
one centralised check over guards scattered across call sites.

This is what DRY means here: one mechanism per decision. It is **not** a licence to merge
code that merely looks alike. When a pattern deliberately keeps two similar things apart,
consistency with that pattern wins over removing duplication.

## Scope matches the idea

Build the size the request implies. A one-sentence idea gets a script, not a system. When
the work will be bigger than the request suggests, say so and state the size before
building.

## Explain, then change; verify, then claim

- State the root cause and the proposed change before editing. Don't open with a patch.
- "Done" means you ran the check and read the output. Quote it. "Should work" is not a
  result, and a green run that tested nothing is not evidence.

## Review findings are claims, not orders

A finding from a reviewer — human or automated — is checked against the code before it
is acted on. "Fix everything" means fix the real defects: drop the wrong findings, and
report what you dropped and why.
