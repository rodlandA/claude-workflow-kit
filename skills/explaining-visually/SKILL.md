---
name: explaining-visually
description: Use when about to present a plan, design proposal or implementation approach, or when asked to explain, walk through or review how something works - architecture, a flow, a subsystem, code as built - even when nothing visual was asked for. Also when the user wants it skimmable rather than a wall of text, or wants to comment on parts and send that back to the agent - "explain this", "walk me through", "make a plan", "show me the plan".
---

# Explaining Visually

## Overview

You write only a **body fragment**. `scripts/shell.html` adds layout, TOC, theme, a side sheet and a comment layer; `scripts/serve.mjs` serves every explainer of the repo from one local server. The reader comments on elements or the whole page; each comment reaches you as a Monitor event with the source line it points at. You edit and reply; the page updates in place, and your reply appears in a thread beside the element, with what it changed outlined.

## Ask first

If the user has not asked for a visual explainer, your first reply is one question, in the conversation's language: "Do you want this as a visual explainer you can comment on in the browser?" Yes → this skill. No → answer in chat; do not ask again about that topic. If the answer fits in about ten lines, answer directly instead.

## Where the file goes

`~/.claude/explainers/<repo-dir-name>/<YYYY-MM-DD>-<topic>.body.html` (outside a repo: `misc/`). The file name without `.body.html` is the page's **slug**. Not the repo, not a published Artifact.

## The body, by mode

A fragment — no `<html>`, `<style>` or `<script>`. Content in the conversation's language; identifiers as-is.

**Plan** (before anything is built) — `<h1 data-mode="plan">`, then: `<p class="lede">` with the change in one sentence; the questions (below); `<ul class="tldr">` Why / What changes / Size; **Today** as a `.flow`; **After** as `.cols` Before/After with boxes `new` / `changed` / `removed`; **Steps** as `<ol class="steps">`, one commit-sized `.step` each; **Open decisions**, one `.callout.decision` each, only for what nobody can settle yet; **Where** as `table.files`.

**As-built** (what exists) — `<h1 data-mode="as-built">`, then: lede and a 3–4 item `.tldr`; **Map**, one drawing of the whole mechanism (see Drawing); **one section per concept**, visual first, then at most two sentences and a `file:line`; **Traps** as `.callout.trap`; **Where** as `table.files`.

## Questions (plan mode)

When the plan depends on something only the user can settle, ask it on the page. Each question goes right after the lede:

```html
<div class="q" id="q-mobile"><b>Should the mobile app move to cookies too?</b><small>what the answer changes</small>
  <ol><li class="rec">Move it too<small>consequence</small></li><li>Keep bearer<small>consequence</small></li></ol></div>
```

- The page lifts them into a band above the plan, one unanswered at a time, with a free-text field beside the options; answered ones stay there in a log. Until all are answered, the plan is marked as a draft.
- Ask only what changes the plan, at most 5 at a time. Leave out `<ol>` for an open question; mark at most one `li` `rec`.
- The page is still a full first draft, built on your recommended answers.
- Never delete or reword an answered `.q`; it feeds the log. A follow-up is a new `.q` with a new id.

## Budget

| Limit | Value |
|---|---|
| Sections | 4–8 `<section id>` in total, each with one `<h2>` |
| Prose | text in `<p>` and callouts: ≤ 60 words per section, ≤ 600 in total |
| Box text | `<b>` name + `<small>` ≤ 8 words |
| Interactive widgets | only when asked |

Over budget: merge related concepts; still over, the topic is two explainers — say so and split.

An element whose detail does not fit its box text and its section's prose gets that detail in an `aside.more` from the first version (see Expanding). Asides are outside the budget; elements that need no more get none.

## Building blocks

| Block | Markup |
|---|---|
| Box | `<div class="box [new\|changed\|removed\|focus]"><b>Name</b><small>detail</small><code>file:line</code></div>`; a box titled in plain words keeps its identifier in the code line: `<code>pushHistory · history.ts:11</code>` |
| Code reference | `file:line`, `file:a-b` or `file` inside `<code>` opens in the sheet's Code tab. Use the shortest path suffix unique in the repo |
| Flow | `<div class="flow [v]">` box, `<div class="arrow">label</div>`, box… (`v` = vertical); without arrows it wraps as an even grid |
| Group in a vertical flow | `<div class="col"><h4>Name</h4><div class="flow">boxes</div></div>` as one step of a `.flow.v` |
| Before/After | `<div class="cols"><div class="col"><h4>Before</h4>…</div>…</div>` |
| Steps | `<ol class="steps"><li class="step [new\|changed\|removed]"><b>…</b><small>…</small></li>` |
| Callouts | `<div class="callout trap\|decision\|question"><b>Label</b>text</div>` |
| Lookup table | `<table class="files">`, any short two- or three-column table |
| Drawing | `<figure><svg viewBox="…" aria-label="…">`, see Drawing |

Colour is a box's state against today, never decoration: `new` / `changed` / `removed` belong to a plan's After and Steps; `focus` marks what its section is about, and is the only colour on an as-built page. The page puts a legend of the states used above each coloured group.

Everything is commentable automatically. `example.body.html` shows a full plan.

## Drawing

Each visual takes the shape of what it shows. A row of boxes and arrows fits a pipeline and nothing else.

| The thing has | Draw |
|---|---|
| order in time between actors | a sequence: one lane per actor, arrows across in time order |
| states and transitions | a state diagram: rounded nodes, labelled arrows |
| parts inside parts | nested shapes, each container drawn around its contents |
| a screen or layout | a wireframe of it, the part in question highlighted |
| a data shape | the real example value, annotated |
| sizes, rates, limits | a scale or bars drawn to proportion |
| a pipeline | a `.flow` |

Draw as inline SVG in a `<figure>`, with a `viewBox` and no fixed width. Small illustrations and icons are welcome where they make a part recognisable. Shell classes: `node` (a shape), `node new` / `changed` / `removed` / `focus` (state), `edge` (a line), `edge arrow` (with arrowhead), `edge dashed`, `lane` (background band), `text.label` (small mono caption), `muted`. Any other colour as `var(--…)`: `--flame-100` … `--flame-900`, likewise `--truffle-*` and `--blue-fantastic-*`, so both themes work. Wrap each part a reader may comment on in `<g data-c="Name">`.

## The comment loop

`SERVE` is `node ~/.claude/skills/explaining-visually/scripts/serve.mjs`. Run it from the repo root: code references resolve against it.

1. **Unanswered first** — `SERVE --pending` lists comments without a reply on every page of this repo. Handle the ones on your topic before anything else.
2. **Server** — `SERVE <slug>` with Bash `run_in_background: true`. It reuses a server already running for this repo, opens the page unless a tab has it, and prints the URL; give the user `http://127.0.0.1:<port>/<slug>/`.
   - **Another device** (the user says they are on a phone, or drives this machine remotely): ask once per session how the device reaches this machine, then add `--remote tailnet` (Tailscale), `--remote lan` (same wifi) or `--remote tunnel` (their own tunnel to the printed port). Give them the `remote:` URL: it carries a token that works like a password, and every request from outside this machine without it gets a 403. A user without a way in yet gets `docs/explaining-visually-remote.md` in the kit (Tailscale setup). A cloud session cannot serve a page at all; say so.
3. **Watcher** — `Monitor` with `SERVE <slug> --watch`, `timeout_ms: 1800000`, description `comments on <slug>`. Name only your own pages: another session may share the folder. Events:
   - `[slug] COMMENT <id> L<line> [<section> › <element>] "<quote>" :: <text>` (`GENERAL` instead of `L…` for the whole page)
   - `[slug] EXPAND <id> L<line> [<section> › <element>] :: <question or "(no question)">` — see Expanding
   - `[slug] ANSWER <id> L<line> [#<qid>] "<question>" :: <choice> — <free text>` — revise the plan to match the answer, as for a comment; a second ANSWER to the same `qid` replaces the first
   - `[slug] APPROVE <id> :: …` — see Approval

   On expiry, re-arm the same command at once. Exception: when this expiry and the previous one both delivered no events, do not re-arm; tell the user in one line that you stopped listening, and that clicking the status pill on the page shows what to send to resume. When they send it ("Pick up the comments on <slug> and listen again"), start again from step 1.
4. **Per comment** — revise (below); once the Edit has succeeded, in a separate call: `SERVE --reply <id> "<what changed, or the answer>"`. One reply per comment, always. The page credits a reply with every line changed since your previous reply, so edit first, then reply. A quote starting with `↩` is your own earlier reply: the comment continues that thread.
5. **Done** — when the user says so, TaskStop your watcher, and the server if you started it.

`SERVE <slug> --export out.html` writes a standalone copy for sharing.

## Revising without disturbing the rest

1. Read the body around `L<line>` and Edit that element. Never Write the whole body after the first version.
2. Change only what the comment asks for, plus what would become wrong because of it. Do not reword, reorder, re-id or restyle anything else; the page outlines every changed element.
3. A question gets a reply, not an edit, unless the page made it unclear.
4. A structural change (section added, removed or reordered, a different mode): reply with the proposed structure and wait for a follow-up comment.
5. A general comment, or one touching several elements: reply listing what you will change and what you will leave, then change exactly that.

## Expanding

Depth lives in the side sheet's Info tab, never in the page. The element shows an `i` badge, and clicking it opens the aside there. The same aside answers an `EXPAND`, or is written up front (see Budget).

1. Insert `<aside class="more">…</aside>` as the element's next sibling, even inside a `.flow` or `<ol>`. For an SVG `<g>` or a table row, give it `data-c="Name"` and put the aside after the `<figure>` or `<table>` with `data-for="Name"`: the parser moves an aside between rows out of the table.
2. A visual first (flow, box grid, small table), then ≤ 80 words. Answer the question if there is one. Outside the budget.
3. Plan mode: reasoning, alternatives and their cost, a `<pre>` example of at most 10 lines — never the implementation.
4. For an `EXPAND`, reply `Added to Info for <element>`. A second `EXPAND` on the element extends its `aside`.

## Approval

Plan pages have an "Approve plan" button; `APPROVE` means the user approved the plan as the page showed it. Then:

1. If the project keeps plans in the repo (e.g. `docs/superpowers/plans/`), write this one there as markdown.
2. Reply `Approved — next: <step>` and start that step.

It approves the plan, nothing more: commits and pushes follow the user's own rules. Any later edit to the body voids it.

## Updates

The server checks GitHub hourly for a newer release. The index page and the status pill's tooltip show the installed version; when a newer one exists, the page shows an Update button, usable only on this machine. A copied install is replaced (the old one kept in `~/.claude/explainers/.update/previous`); a git checkout is fast-forwarded, and only on its default branch. The server then restarts on the same port and the page reloads. `--no-update-check` or `EXPLAINER_NO_UPDATE_CHECK=1` turns the check off.

## Changing the shell or server

After editing `scripts/shell.html` or `scripts/serve.mjs`, run `node ~/.claude/skills/explaining-visually/scripts/check.mjs` (once: `npm --prefix ~/.claude/skills/explaining-visually/scripts install`). It must end with `all passed`.

To release, bump `version` in `scripts/package.json`, merge, then tag the merge commit `explaining-visually-v<version>` and push the tag.

## Common mistakes

| Mistake | Fix |
|---|---|
| Own CSS/JS, or a full HTML page | Fragment only; the shell owns all of it |
| Rewriting the body for one comment | Edit the element at `L<line>` |
| No reply after an edit | The comment stays "waiting"; always `--reply` |
| A choice the user must make, written as an Open decisions callout | A `.q`, so it is answered on top instead of commented on |
| `--watch` without slugs while other sessions work in the repo | Name your pages, or you consume their comments |
| Prose under a diagram, or detail in the page | Box labels, or an `aside.more` |
| Every section a row of boxes | Draw the shape the thing has (see Drawing) |
| An expansion that writes the code a plan describes | Reasons and a short example; code comes after approval |
