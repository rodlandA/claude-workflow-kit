# Patterns

Hooks that are always project-specific. Each script is a working example of one shape;
adopting one means deciding whether the shape fits this repository, then setting its
Config block — not copying it as-is.

| Pattern | Shape | Fits when |
|---------|-------|-----------|
| `gate-path-to-subagent.sh` | Deny main-session edits under a path; subagents pass | A part of the codebase has its own conventions, carried by a dedicated subagent, and a rule already says "use the agent" |
| `protect-generated-files.sh` | Deny edits under a path, say how to regenerate | The repo has generated output checked in |
| `remind-on-change.sh` | After editing X, tell the agent Y is now stale | X → Y is a step people forget: API → client, schema → migration, strings → translations |
| `verify-on-stop.sh` | Block "done" while a fast check fails on changed files | There is a lint or typecheck that runs per file in seconds |

## Before trusting the subagent gate

It assumes PreToolUse payloads carry `agent_id` only inside a subagent. Confirm on the
installed Claude Code version: register a throwaway hook that appends its stdin to a file,
make one edit from the main session and one from a subagent, and compare the two payloads.

## Testing an adapted pattern

`hooks/test-hooks.sh` exercises every pattern it finds in the directories you pass it,
forcing its own config through environment variables — so it tests the mechanism of your
adapted copy. Then test your configuration with one real payload, for example:

```bash
jq -n '{tool_name:"Edit",tool_input:{file_path:"/repo/<your gated path>/x.ts"}}' \
  | .claude/hooks/gate-path-to-subagent.sh
```
