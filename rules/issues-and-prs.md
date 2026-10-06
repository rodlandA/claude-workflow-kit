# Issues and Pull Requests

## Titles

Issue and PR titles use the commit format and types (`commits.md`): `<type>: <description>`,
imperative, lowercase after the prefix, under 72 characters, no trailing punctuation, no
emoji, no `(closes #N)` — references go in the body.

- `fix:` describes the **bug the user saw**, not the fix. Good: `fix: map goes blank after reconnect`. Avoid: `fix: reset tile cache on reconnect` — that reads like a feature, and nobody can tell from it what was broken
- `feat:` describes the new capability in the user's words
- Internal tooling and refactors are `chore:`/`refactor:`, even when they took real work

<!-- ADAPT: keep this paragraph only if release notes are generated from PR titles. -->
**PR titles become release notes**, so write them for the reader of the release, not for
the implementer: customer-facing words over internal jargon.

## Issue body

An issue is read by someone deciding whether to pick it up, then by whoever does. Short
enough that it gets read at all. In this order, and most issues need nothing more:

1. **The symptom in one sentence** — what someone would notice
2. **Repro as numbered steps**, with measured values rather than adjectives (`visible: false` → `visible: true` beats "the layer reappears")
3. **Why**, in a sentence or two — the mechanism, not the investigation
4. **What is out of scope**, if anything

Cut the research that convinced you — dead ends, files read, alternatives weighed.
Someone who needs it can ask.

## PR body

```markdown
## Summary
- 2–3 bullets: what changed and why

## Changes
- the concrete changes, not a file list

Closes #N
```

Drop empty sections. No "N/A", no self-praise ("This greatly improves…").

## Voice

Issues, comments and PR text are posted under the user's name. Say it flat: name the
finding and stop. No build-up, no dramatising, no editorialising about the code. Code
blocks and measured numbers carry the weight; the prose says what they show.
