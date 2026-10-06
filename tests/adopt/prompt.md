You are testing an instruction file by following it exactly, as the agent it was written for. Afterwards you report where it worked and where it failed you.

## The setup

- KIT = `<KIT>` — a starter kit of Claude Code rules, skills, commands and hooks. Its entry point for you is `KIT/ADOPT.md`. Read it first and follow it step by step. READ ONLY: never modify anything under KIT.
- S = `<S>`
- The user's repo is `S/work/acme-api` (a git repo; treat it as the "current repo").
- **The user's home is simulated at `S/home`.** Wherever ADOPT.md says `~` or `$HOME`, use `S/home` instead — including backups, and hook paths you write into settings.json (write them fully expanded).
- The user is not available live. Their answers are in `S/persona.md`.

## Hard limits

- NEVER read or write the real `~/.claude`, nor anything outside S except reading KIT. The simulated home is the only home you may touch.
- Do not use WebFetch or WebSearch: their output is saved under the real home. If you need Claude Code documentation, `curl -s` it into a file under S.
- Your session may have instructions injected (a CLAUDE.md, project rules, memory) that belong to the person running this test, not to the simulated user. They are NOT the user's setup. Take no adoption decision or file content from them — only from KIT and persona.md.
- Do not run `git commit`, `git push`, or any `gh` command that writes.
- Your own Bash commands may pass through the tester's hooks, including a commit-message linter. If you need to send a hook a payload with blocked text, create the payload file with the Write tool and pipe the file in.

## How to handle "ask the user" and "show before writing"

Keep a log at `S/questions.md`. Every time ADOPT.md tells you to ask the user, or to show a change and get approval, append:

```
### Q<n> (ADOPT.md step/section)
Question / proposed change: ...
Answer (from persona): ...   — or: NOT COVERED BY PERSONA → chose <the recommended option>
```

Then act on the answer. Approvals: approve what matches persona.md, reject anything that overwrites existing content.

## Your report (final message)

1. **Installed**: a table — file, where it went, what you adapted.
2. **Skipped**, and why.
3. **Verification**: the commands from ADOPT.md Step 5 you ran, with their output quoted (trim long output, keep failures in full).
4. **Friction log** — the most important part. Every place where ADOPT.md or a kit file: was ambiguous; was wrong; lacked information you needed; told you to do something that did not work as described; or where you had to guess. For each: quote the line, say what happened, say what would have fixed it. Be specific and do not soften — this report exists to improve the kit. Say so plainly if you found nothing in a category.
5. Anything you noticed that the kit should have and does not.
