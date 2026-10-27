#!/usr/bin/env node
// Tests for shell.html and serve.mjs: run after every change to either.
//   npm --prefix <scripts dir> install          (once; pulls playwright-core)
//   npm --prefix <scripts dir> test             serves a copy of example.body.html on a spare port and tests it
//   npm --prefix <scripts dir> test -- margin   runs only the areas named
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { failures, check, cssBalanced, startServer, launch } from './harness.mjs';
import { WIDTHS, checkWidth, checkQuestions, checkToc, checkExport, checkLiveUpdate, checkTransitions, checkEditRefresh } from './page.test.mjs';
import { checkServerGuards, checkServerThreads, checkRemote } from './server.test.mjs';
import { checkMarginReply, checkMarginLayout, checkMarginMotion, checkThreadActions, checkOffscreen, checkExpand, checkReviewFixes } from './margin.test.mjs';
import { checkLegend, checkDrawing, checkLive, checkShowcase } from './drawing.test.mjs';
import { checkUpdate } from './update.test.mjs';

const AREAS = {
  page: async ({ browser, url, dir }) => {
    for (const size of WIDTHS) {
      await checkWidth(browser, url, size);
    }
    await checkQuestions(browser, url, dir);
    await checkToc(browser, url);
    await checkExport(browser, dir);
    await checkLiveUpdate(browser, url, dir);
    await checkTransitions(browser, url);
    await checkEditRefresh(browser, url, dir);
  },
  server: async ({ url, dir }) => {
    await checkServerGuards(url, dir);
    await checkServerThreads(url, dir);
    await checkRemote(dir);
  },
  margin: async ({ browser, url, dir }) => {
    await checkMarginReply(browser, url, dir);
    await checkMarginLayout(browser, url, dir);
    await checkMarginMotion(browser, url, dir);
    await checkThreadActions(browser, url, dir);
    await checkOffscreen(browser, url, dir);
    await checkExpand(browser, url, dir);
    await checkReviewFixes(browser, url, dir);
  },
  drawing: async ({ browser, url, dir }) => {
    await checkLegend(browser, url, dir);
    await checkDrawing(browser, url, dir);
    await checkLive(browser, url, dir);
    await checkShowcase();
  },
  update: async ({ browser, dir }) => {
    await checkUpdate(browser, dir);
  },
};

async function main() {
  const named = process.argv.slice(2);
  const unknown = named.filter((n) => !AREAS[n]);
  if (unknown.length) {
    console.error(`unknown area ${unknown.join(', ')}; areas: ${Object.keys(AREAS).join(', ')}`);
    process.exit(2);
  }
  check(cssBalanced(), 'shell.html: CSS braces balance');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainer-check-'));
  const { child, url } = await startServer(dir);
  let browser;
  try {
    browser = await launch();
    const index = await (await fetch(new URL('/', url))).text();
    check(index.includes('href="example/"'), 'index lists the page');
    for (const [name, run] of Object.entries(AREAS)) {
      if (!named.length || named.includes(name)) {
        await run({ browser, url, dir });
      }
    }
  } finally {
    await browser?.close();
    child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
  process.exit(failures.length ? 1 : 0);
}

main();
