# Testing ADOPT.md

`ADOPT.md` is only as good as an agent's ability to follow it. This test has a fresh
agent adopt the kit into a simulated user's setup, then checks the result independently
of what the agent reports.

| File | What |
|------|------|
| `setup.sh <dir>` | Builds the environment: a simulated home with an existing setup to merge into, a small TypeScript API repo with an origin, and checksums of the real `~/.claude` and the kit |
| `persona.md` | The simulated user's answers |
| `prompt.md` | The task for the test agent; replace `<KIT>` and `<S>` |
| `check.sh <dir>` | Verifies isolation and the outcome: settings parse and keep existing entries, no unresolved `ADAPT`, no backups in the repo, a manifest, nothing committed, installed hooks pass `test-hooks.sh` |

## Running it

```bash
tests/adopt/setup.sh /tmp/adopt-run
```

Then, in a Claude Code session, have a **fresh** subagent run `prompt.md` with `<KIT>`
set to this repo and `<S>` to `/tmp/adopt-run`. A fresh one matters: an agent that saw
earlier runs or this kit being written knows the answers ADOPT.md is supposed to give.

```bash
tests/adopt/check.sh /tmp/adopt-run
```

The agent's friction log is the actual output — `check.sh` only confirms it did not
break anything. Fix the findings, reset with `setup.sh`, and run again with a new agent.

## Why a subagent and not `claude -p`

A fully isolated `claude -p` would be cleaner, but it loses its login under a fake `HOME`
or `CLAUDE_CONFIG_DIR`. A subagent keeps the login but sees the tester's own CLAUDE.md,
rules and hooks, which is why `prompt.md` tells it to ignore them and `check.sh` checks
the real `~/.claude` was not touched.
