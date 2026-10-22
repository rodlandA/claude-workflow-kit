# Explainers from your phone

The explainer server runs on the machine where Claude Code runs and only answers that machine.
When you drive that session from your phone through
[Remote Control](https://code.claude.com/docs/en/remote-control), start the server with
`--remote` and open the page on the phone. The comment loop stays the same: comments, answers
and approvals reach the agent, and the page reloads with its edits.

```bash
node ~/.claude/skills/explaining-visually/scripts/serve.mjs <slug> --remote tailnet
```

The server prints a second line:

```
remote: http://100.x.y.z:4791/<slug>/?t=<token>
```

Open that URL on the phone. The token works like a password: the first visit trades it for a
cookie, and every request from outside the machine without it gets a 403. Each server start
makes a new token, so an old link stops working after a restart.

The agent does this for you: tell it you are on your phone, and it asks how the phone reaches
the machine.

## Set up Tailscale

[Tailscale](https://tailscale.com) puts your machine and your phone on one private network,
wherever each of them is.

1. Install Tailscale on the machine that runs Claude Code and on the phone
   ([downloads](https://tailscale.com/download)).
2. Sign in to the same account on both.
3. On the machine, check that both are listed and the phone is not `offline`:

   ```bash
   tailscale status
   ```

4. Keep Tailscale switched on on the phone while you review.

`--remote tailnet` finds the machine's Tailscale address with `tailscale ip -4` and listens there
as well as on `127.0.0.1`. Nothing is exposed outside your tailnet.

## Other ways in

| Flag | When | Listens on |
|---|---|---|
| `--remote tailnet` | Phone and machine on Tailscale, anywhere | The machine's Tailscale IPv4 address |
| `--remote lan` | Phone on the same wifi as the machine | The machine's first non-loopback IPv4 address outside Tailscale's range |
| `--remote tunnel` | You run your own tunnel (cloudflared, ngrok) to the printed port | `127.0.0.1` only; the token guards the tunnel |

## When it does not work

| Symptom | Cause |
|---|---|
| `{"ok":false,"error":"unknown host"}` | The link has no token, or the server restarted since. Ask the agent for the current `remote:` line |
| The page never loads | The phone is offline in `tailscale status`, or Tailscale is off on the phone |
| `no tailnet address found on this machine` | Tailscale is not running on the machine |

A cloud session (Claude Code on the web, or the Code tab in the Claude app without Remote
Control) cannot serve an explainer: its sandbox takes no inbound connections, and its default
network blocks tunnels. Use Remote Control to a machine you own.
