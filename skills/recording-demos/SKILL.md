---
name: recording-demos
description: Use when asked to make a promo video, demo clip, GIF, screencast or recorded walkthrough of an app, web page, CLI or feature — for a README, PR, landing page, release notes or a social post. "lag en promovideo", "demo-gif", "record a demo", "lag et demoklipp".
---

# Recording demos

A demo clip is judged by someone who sees it once, at the size it is shown, often muted and
without context. Everything below serves that viewer.

## Agree on the clip before recording

Recording, checking and re-encoding is the slow part, and a wrong length or format means a
full redo. So look at the project first, then send the user **one message that proposes the
clip** — a concrete choice for each point, drawn from what you saw, so that "ok" is a
complete answer and a correction is one line:

- **Where it is shown, and to whom.** This decides most of the rest.
- **What the viewer should take away**, and the moments that show it.
- **Length.**
- **Format** — GIF, MP4/WebM or both; pixel width; a file-size budget if the destination
  has one.
- **Style** — captions or none, cursor, theme, pace, real or demo data, framing (bare app,
  browser window, terminal window).

Then stop and wait for the answer. If the user already said to just go ahead, state your
choices in one line and start.

## What the clip must do

- **Read at the size it is shown.** Text that is crisp in a 1280px recording can be
  unreadable at 800px in a README. Fill the frame with what matters: zoom, a smaller
  viewport, or a crop.
- **Open on something meaningful.** The first frame is the thumbnail and the first thing a
  GIF shows. Trim blank and loading frames.
- **Make every action visible**: a cursor that travels to what it clicks, typing at a
  readable pace, a pause after each result long enough to read it.
- **Show real behaviour** — output from actual runs, not mocked text.
- **Hold the end** for a beat before a loop restarts.
- **Fit what was agreed**, and report duration, dimensions and file size.
- **Can be re-recorded**: keep the script that resets state and drives the take, and say
  where it is.

## Check it as the viewer sees it

Extract frames from the final file — not the raw recording — at the start, at each key
moment and at the end, scaled to the display width, and look at them. You are looking for
text you cannot read, a frame caught mid-animation, a missing cursor, blank frames. Fix and
re-encode before reporting.

## Gotchas

- Playwright's `recordVideo` draws no cursor. Inject one with `addInitScript` (an element
  that follows `mousemove`, plus a ring on `mousedown`), and move with
  `page.mouse.move(x, y, { steps })` so it travels.
- Headless Chrome may render WebGL in software and stutter. Use `channel: 'chrome'` with
  GPU flags (`--enable-gpu --ignore-gpu-blocklist`, and `--use-angle=metal` on macOS), and
  check the motion in the frames.
- GIF size grows with how many pixels change per frame; gradients, scrolling and 3D cost
  most. Levers: lower fps (10–15), smaller width, `palettegen=stats_mode=diff` with
  `paletteuse=dither=none` or `bayer`, a shorter clip.
- GitHub READMEs do not play an MP4 committed to the repo, only a video uploaded as an
  attachment through the web UI. A committed GIF always plays.
- A terminal demo without VHS or asciinema: run the real commands, capture their output,
  render it in an HTML terminal and record that.
