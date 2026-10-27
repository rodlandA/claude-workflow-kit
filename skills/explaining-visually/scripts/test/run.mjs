#!/usr/bin/env node
// Tests for shell.html and serve.mjs: run after every change to either.
//   npm --prefix <scripts dir> install   (once; pulls playwright-core)
//   npm --prefix <scripts dir> test      serves a copy of example.body.html on a spare port and tests it
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { failures, check, cssBalanced, startServer, launch } from './harness.mjs';
import { WIDTHS, checkWidth, checkQuestions, checkToc, checkExport, checkLiveUpdate, checkTransitions, checkEditRefresh } from './page.test.mjs';
import { checkServerGuards, checkServerThreads, checkRemote } from './server.test.mjs';
import { checkMarginReply, checkMarginLayout, checkMarginMotion, checkThreadActions, checkOffscreen, checkExpand, checkReviewFixes } from './margin.test.mjs';
import { checkLegend, checkDrawing, checkLive, checkShowcase } from './drawing.test.mjs';
import { checkUpdate } from './update.test.mjs';

async function main() {
  check(cssBalanced(), 'shell.html: CSS braces balance');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainer-check-'));
  const { child, url } = await startServer(dir);
  let browser;
  try {
    browser = await launch();
    const index = await (await fetch(new URL('/', url))).text();
    check(index.includes('href="example/"'), 'index lists the page');
    for (const size of WIDTHS) {
      await checkWidth(browser, url, size);
    }
    await checkQuestions(browser, url, dir);
    await checkToc(browser, url);
    await checkExport(browser, dir);
    await checkServerGuards(url, dir);
    await checkServerThreads(url, dir);
    await checkLiveUpdate(browser, url, dir);
    await checkMarginReply(browser, url, dir);
    await checkMarginLayout(browser, url, dir);
    await checkMarginMotion(browser, url, dir);
    await checkThreadActions(browser, url, dir);
    await checkOffscreen(browser, url, dir);
    await checkExpand(browser, url, dir);
    await checkReviewFixes(browser, url, dir);
    await checkTransitions(browser, url);
    await checkEditRefresh(browser, url, dir);
    await checkLegend(browser, url, dir);
    await checkDrawing(browser, url, dir);
    await checkLive(browser, url, dir);
    await checkShowcase();
    await checkRemote(dir);
    await checkUpdate(browser, dir);
  } finally {
    await browser?.close();
    child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
  process.exit(failures.length ? 1 : 0);
}

main();
