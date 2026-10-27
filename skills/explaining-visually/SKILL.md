---
name: explaining-visually
description: Use when about to present a plan, design proposal or implementation approach, or when asked to explain, walk through or review how something works - architecture, a flow, a subsystem, code as built - even when nothing visual was asked for. Also when the user wants it skimmable rather than a wall of text, or wants to comment on parts and send that back to the agent - "explain this", "walk me through", "make a plan", "show me the plan".
---

# Explaining Visually

## Overview

You write only a **body fragment**. `scripts/shell.html` adds layout, TOC, theme, a side sheet and a comment layer; `scripts/serve.mjs` serves every explainer of the repo from one local server. The reader comments on elements or the whole page; each comment reaches you as a Monitor event with the source line it points at. You edit and reply; the page updates in place, and your reply appears in a thread beside the element, with what it changed outlined.

The page exists so a reader understands faster than from text. What it shows, and in what shape, follows from this topic and this reader; nothing below is a template.

## Ask first

If the user has not asked for a visual explainer, your first reply is one question, in the conversation's language: "Do you want this as a visual explainer you can comment on in the browser?" Yes → this skill. No → answer in chat; do not ask again about that topic. If the answer fits in about ten lines, answer directly instead.

## Where the file goes

`~/.claude/explainers/<repo-dir-name>/<YYYY-MM-DD>-<topic>.body.html` (outside a repo: `misc/`). The file name without `.body.html` is the page's **slug**. Not the repo, not a published Artifact.

## The page

A fragment — no `<html>` or `<style>`, and no `<script>` outside a live figure. Content in the conversation's language; identifiers as-is.

It opens with `<h1 data-mode="…">` and a `<p class="lede">`: the whole point in one sentence. `data-mode` is a short label in the conversation's language, except that a proposal is always `plan`: that exact value gives the page an Approve button (see Approval). A `<ul class="tldr">` of 3–4 labelled items helps a reader who stops there.

Then `<section id>`s, each with one `<h2>` that states its point, in the order the reader needs them. What a page has to answer:

- **A plan:** what changes and why, how it differs from today, the steps (each one commit), what is still open, and where in the code when there is code. The reader approves it from the page.
- **Anything else:** where to start — one drawing of the whole — then each part the reader must understand, what will bite them, and where in the code when there is code.

## Questions

When a plan depends on something only the user can settle, ask it on the page, right after the lede:

```html
<div class="q" id="q-mobile"><b>Should the mobile app move to cookies too?</b><small>what the answer changes</small>
  <ol><li class="rec">Move it too<small>consequence</small></li><li>Keep bearer<small>consequence</small></li></ol></div>
```

- The page lifts them into a band above the content, one at a time, with a free-text field; answered ones stay in a log, and the plan is marked a draft until all are answered.
- Ask only what changes the plan. Leave out `<ol>` for an open question; mark at most one `li` `rec`, and build the page on the recommended answers.
- Never delete or reword an answered `.q`; it feeds the log. A follow-up is a new `.q` with a new id.

## Keeping it light

Prose is what turns a page back into a wall of text. A section carries at most about 60 words in `<p>` and callouts (labels, tables and captions aside); a box label is a name plus at most 8 words. Detail that does not fit goes into an `aside.more` from the first version (see Expanding); elements that need no more get none. A topic that needs more than about eight sections is two explainers — say so and split.

## Building blocks

| Block | Markup |
|---|---|
| Box | `<div class="box [new\|changed\|removed\|focus]"><b>Name</b><small>detail</small><code>file:line</code></div>`; a box titled in plain words keeps its identifier in the code line: `<code>pushHistory · history.ts:11</code>` |
| Code reference | `file:line`, `file:a-b` or `file` inside `<code>` opens in the sheet's Code tab. Use the shortest path suffix unique in the repo; other `<code>` stays plain text |
| Flow | `<div class="flow [v]">` box, `<div class="arrow">label</div>`, box… (`v` = vertical); without arrows it wraps as an even grid |
| Group in a vertical flow | `<div class="col"><h4>Name</h4><div class="flow">boxes</div></div>` as one step of a `.flow.v` |
| Side by side | `<div class="cols"><div class="col"><h4>Before</h4>…</div>…</div>` |
| Steps | `<ol class="steps"><li class="step [new\|changed\|removed]"><b>…</b><small>…</small></li>` |
| Callouts | `<div class="callout trap\|decision\|question"><b>Label</b>text</div>` |
| Table | `<table class="files">`, any short table |
| Drawing | `<figure><svg viewBox="…" aria-label="…">`, see Drawing |
| Live figure | `<figure class="live" data-c="…">` with a module script, see Live figures |

State classes say where a box, step or node stands against a starting point, never decoration: `new` / `changed` / `removed` for what appears, changes or goes; `focus` for what its section is about. The page adds a legend of the states used. Everything is commentable automatically.

In this skill's folder, `example.body.html` is a complete plan and `showcase.body.html` writes out each kind of drawing and live figure; open it when you need a technique you have not written before, and take the technique, not its page.

## Drawing

Each visual takes the shape of what it shows: actors over time read as a sequence, states as a state diagram, containment as nested shapes, a screen as a wireframe, a data shape as the real value annotated, sizes as bars to proportion. A row of boxes and arrows fits a pipeline and nothing else. When nothing familiar fits, invent the picture.

Draw inline SVG in a `<figure>`, with a `viewBox` and no fixed width. The column is 760px wide, so `viewBox="0 0 760 …"` draws at 1:1; a `text.label` character is about 6.6px wide. Ids are page-wide: prefix them with the figure's name.

- Shell classes: `node` (a shape) and `node new|changed|removed|focus`, `edge`, `edge arrow`, `edge dashed`, `lane` (background band), `text.label` (small mono caption), `muted`.
- Other colours go in `style`, since an attribute cannot hold `var()`: `<rect style="fill: var(--flame-200)">`. Hues `--flame-*`, `--truffle-*`, `--blue-fantastic-*` run from 100 (nearest the page) to 900 (nearest the text) in either theme, at 100–400 and 600–900: light steps under `--fg` text, dark steps for lines. `--blue-fantastic` is the dark page's own colour, so its light steps vanish there. The hues are the state colours too, so in a figure that shows states, tell other kinds apart by shape, pattern or label rather than colour.
- Wrap each part a reader may comment on in `<g data-c="Name">`. An `aside.more` with `data-for="Name"` gives it an `i` badge on the top-left corner of its bounding box; keep about 8px clear there, or hang the aside on a label instead.

## Live figures

Prefer a drawing. A live figure is for what no drawing shows: a 3D shape the reader turns, a parameter whose effect they drag, a process that plays out over time.

```html
<figure class="live" data-c="Frustum">
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    export default (stage, { palette, reducedMotion }) => {
      // draw into stage, a 16:9 box; size from stage.clientWidth / clientHeight
      return () => { /* stop loops, observers and listeners; dispose the renderer */ };
    };
  </script>
  <figcaption>What to try, in one line.</figcaption>
</figure>
```

- Only the default export runs, with the stage the page puts after the script; keep the module free of top-level side effects. 2D needs no library: a `<canvas>` or SVG in the stage.
- `palette` holds hex for `fg` `bg` `card` `muted` `line` `accent` `new` `changed` `removed`, `flame` / `truffle` / `blueFantastic` at the same steps, and `dark`. The page remounts the figure after every edit, theme change and motion-preference change, so the cleanup must leave nothing running.
- With `reducedMotion`, start still and let the reader drive. Clicks inside the stage belong to the figure; the reader comments through its comment button or caption.

## The comment loop

`SERVE` is `node ~/.claude/skills/explaining-visually/scripts/serve.mjs`. Run it from the repo root: code references resolve against it.

1. **Unanswered first** — `SERVE --pending` lists comments without a reply on every page of this repo. Handle the ones on your topic before anything else.
2. **Server** — `SERVE <slug>` with Bash `run_in_background: true`. It reuses a server already running for this repo, opens the page unless a tab has it, and prints the URL; give the user `http://127.0.0.1:<port>/<slug>/`.
   - **Another device** (the user says they are on a phone, or drives this machine remotely): ask once per session how the device reaches this machine, then add `--remote tailnet` (Tailscale), `--remote lan` (same wifi) or `--remote tunnel` (their own tunnel to the printed port). Give them the `remote:` URL: its token works like a password, and any request from outside this machine without it gets a 403. Without a way in yet, point them to `docs/explaining-visually-remote.md` in the kit. A cloud session cannot serve a page; say so.
3. **Watcher** — `Monitor` with `SERVE <slug> --watch`, `timeout_ms: 1800000`, description `comments on <slug>`. Name only your own pages: another session may share the folder. Events:
   - `[slug] COMMENT <id> L<line> [<section> › <element>] "<quote>" :: <text>` (`GENERAL` instead of `L…` for the whole page)
   - `[slug] EXPAND <id> L<line> [<section> › <element>] :: <question or "(no question)">` — see Expanding
   - `[slug] ANSWER <id> L<line> [#<qid>] "<question>" :: <choice> — <free text>` — revise the page to match, as for a comment; a second ANSWER to the same `qid` replaces the first
   - `[slug] APPROVE <id> :: …` — see Approval

   On expiry, re-arm the same command at once. Exception: when this expiry and the previous one both delivered no events, do not re-arm; tell the user in one line that you stopped listening, and that clicking the status pill on the page shows what to send to resume. When they send it ("Pick up the comments on <slug> and listen again"), start again from step 1.
4. **Per comment** — revise (below); once the Edit has succeeded, in a separate call: `SERVE --reply <id> "<what changed, or the answer>"`. One reply per comment, always. A reply is credited with every line changed since your previous reply, so edit first, then reply. A quote starting with `↩` is your own earlier reply: the comment continues that thread.
5. **Done** — when the user says so, TaskStop your watcher, and the server if you started it.

`SERVE <slug> --export out.html` writes a standalone copy for sharing.

## Revising without disturbing the rest

1. Read the body around `L<line>` and Edit that element. Never Write the whole body after the first version.
2. Change only what the comment asks for, plus what would become wrong because of it. Leave every other element as it is; the page outlines each one that changed.
3. A question gets a reply, not an edit, unless the page made it unclear.
4. A structural change (sections added, removed or reordered, a different mode): reply with the proposed structure and wait for a follow-up comment.
5. A general comment, or one touching several elements: reply listing what you will change and what you will leave, then change exactly that.

## Expanding

Depth lives in the side sheet's Info tab, not in the page; the element shows an `i` badge that opens it.

1. Insert `<aside class="more">…</aside>` as the element's next sibling, even inside a `.flow` or `<ol>`. For an SVG part, a table row or a live figure, put the aside after the `<figure>` or `<table>` with `data-for="<its data-c>"`: the parser moves an aside between rows out of the table.
2. A visual first, then at most about 80 words. Answer the question if there is one.
3. In a plan: the reasoning and the alternatives with their cost, and a short example where it says more than words — never the implementation.
4. For an `EXPAND`, reply `Added to Info for <element>`. A second `EXPAND` on the element extends its aside.

## Approval

Plan pages have an "Approve plan" button; `APPROVE` means the user approved the plan as the page showed it. Then:

1. If the project keeps plans in the repo (e.g. `docs/superpowers/plans/`), write this one there as markdown.
2. Reply `Approved — next: <step>` and start that step.

It approves the plan, nothing more: commits and pushes follow the user's own rules. Any later edit to the body voids it.

## Common mistakes

| Mistake | Fix |
|---|---|
| Rewriting the body for one comment | Edit the element at `L<line>` |
| An edit without `--reply` | The comment stays "waiting"; reply every time |
| A choice the user must make, written as a callout | A `.q`, so it is answered rather than commented on |
| `--watch` without slugs while other sessions work in the repo | Name your pages, or you consume their comments |
| Prose under a diagram, detail in the page | Labels in the drawing, depth in an `aside.more` |
| Every section a row of boxes | Draw the shape the thing has |
| Every page built the same way | Start from what this reader needs to see |

## Maintaining the skill

After editing `scripts/shell.html` or `scripts/serve.mjs`, run `npm --prefix ~/.claude/skills/explaining-visually/scripts test` (once before: `… install`); it must end with `all passed`. The tests live in `scripts/test/`, one file per area. A running server keeps its old `serve.mjs` until restarted. The server offers updates from the page itself; `--no-update-check` or `EXPLAINER_NO_UPDATE_CHECK=1` turns that off. To release, bump `version` in `scripts/package.json`, merge, then tag the merge commit `explaining-visually-v<version>` and push the tag.
