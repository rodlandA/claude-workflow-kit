# Code Comments

**The default is no comment.** A file with zero comments is the normal, correct outcome.
A comment is a line that must be read, maintained and re-verified forever, so it has to
earn its place.

The failure this rule stops is not the one bad comment. It is the diff where every
symbol carries a defensible little paragraph, and the result is a wall of prose around
thirty lines of code.

## Hard limits
- **One line.** Two only if the sentence genuinely will not fit. Never a paragraph
- **At most one comment per function.** Several commented functions in a row means the names are wrong
- **No doc comments on private or module-local functions**
<!-- ADAPT: drop the next line for languages where @param is the convention (e.g. public C#/Java API). -->
- **No `@param` / `@returns` in typed code** — the signature already says it

## The delete test
Delete the comment and reread the code. If a competent reader loses nothing, it stays deleted.
This applies to comments you edit as much as ones you add.

## What earns a comment
1. A fact about the outside world the code cannot show — a vendor quirk, a browser bug
2. A workaround, with its issue number
3. A trap that will bite the next editor who "fixes" it
4. A lint-disable, with its reason
5. A TODO with enough context to act on, and an issue number where one exists

## NEVER
- Restate the name or the type
- Explain what the code does, step by step
- Narrate a design decision — that goes in the commit body or a decision register
- Banner comments (`// ----- Helpers -----`)
- Enumerate the current cases the code already lists; they go stale on the next change

## Where the prose goes instead
| Content | Home |
|---------|------|
| Why this approach, what was rejected | commit message body |
| A decision future work must respect | a decision register in `.claude/rules/` |
| How a subsystem fits together | a skill's `references/` |
| What this change does | the PR body |
