#!/usr/bin/env node
// Smoke test for shell.html and serve.mjs: run after every change to either.
//   npm --prefix <this dir> install   (once; pulls playwright-core)
//   node check.mjs                    serves a copy of example.body.html on a spare port and checks it
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    failures.push(label);
  }
};

const WIDTHS = [
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1000, h: 800 },
  { w: 1512, h: 900 },
];

function cssBalanced() {
  const shell = fs.readFileSync(path.join(here, 'shell.html'), 'utf8');
  const css = shell.slice(shell.indexOf('<style>'), shell.indexOf('</style>')).replace(/"[^"]*"/g, '');
  return css.split('{').length === css.split('}').length;
}

function startServer(dir) {
  const body = path.join(dir, 'example.body.html');
  fs.copyFileSync(path.join(here, '..', 'example.body.html'), body);
  const child = spawn(process.execPath, [path.join(here, 'serve.mjs'), body, '--root', path.join(here, '..'), '--port', '4890', '--no-open'], { stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((done, fail) => {
    child.stdout.on('data', (chunk) => {
      const url = String(chunk).match(/explainer: (\S+)/)?.[1];
      if (url) {
        done({ child, url });
      }
    });
    child.on('exit', (code) => fail(new Error(`serve.mjs exited with ${code}`)));
  });
}

async function launch() {
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch {
    return chromium.launch();
  }
}

const geometry = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  const visible = el && !el.hidden && getComputedStyle(el).display !== 'none';
  if (!visible) {
    return null;
  }
  const r = el.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  return { left: Math.round(r.left), right: Math.round(vw - r.right), top: Math.round(r.top), bottom: Math.round(innerHeight - r.bottom), width: Math.round(r.width), vw };
}, sel);

// Material 3: a side sheet from 840px, a bottom sheet below; full width up to 640px, then 56px side margins.
function placedPerSpec(g, w) {
  if (!g) {
    return false;
  }
  if (w >= 840) {
    return g.right === 0 && g.top === 0 && g.bottom === 0;
  }
  if (g.vw <= 640) {
    return g.left === 0 && g.right === 0 && g.bottom === 0;
  }
  return g.bottom === 0 && g.width <= 640 && g.left >= 56 && Math.abs(g.left - g.right) <= 1;
}

async function openSheet(page, w) {
  await page.locator('main .box').first().click();
  if (w < 840) {
    await page.locator('.pop .tools button').first().click();
  }
  await page.waitForTimeout(700);
}

const panelHeight = (page) => page.evaluate(() => Math.round(document.querySelector('.panel').getBoundingClientRect().height));

async function dragHandle(page, dy, steps) {
  const box = await page.locator('.panel .handle').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps });
  await page.mouse.up();
  await page.waitForTimeout(700);
}

// Snap points are 30%, 50%, 75% and full height minus the top margin; the sheet opens at 50%.
async function checkSnaps(page, w, h) {
  const near = (got, want) => Math.abs(got - want) <= 2;
  check(near(await panelHeight(page), h * 0.5), `${w}px: bottom sheet opens at the 50% snap point`);
  await dragHandle(page, -h * 0.2, 25);
  check(near(await panelHeight(page), h * 0.75), `${w}px: a slow drag settles on the nearest snap point`);
  await dragHandle(page, 0, 1);
  const barH = await page.evaluate(() => document.querySelector('.bar').getBoundingClientRect().height);
  check(near(await panelHeight(page), h - (w > 640 ? 56 : barH)), `${w}px: a tap on the handle moves one snap point up`);
  if (w <= 640) {
    const docked = await page.evaluate(() => {
      const top = document.querySelector('.panel').getBoundingClientRect().top;
      const bar = document.querySelector('.bar').getBoundingClientRect().bottom;
      const close = document.querySelector('.panel .close').getBoundingClientRect();
      return Math.abs(top - bar) <= 1 && close.width > 0 && document.elementFromPoint(close.x + 5, close.y + 5)?.closest('.panel .close') !== null;
    });
    check(docked, `${w}px: at the top snap point the sheet docks under the bar with a close button`);
  }
}

async function checkWidth(browser, url, { w, h }) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  await page.goto(url);
  await page.waitForTimeout(1200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `${w}px: no horizontal overflow (${overflow}px)`);
  check(Boolean(await page.locator('#status').textContent()), `${w}px: status shows`);

  await openSheet(page, w);
  check(placedPerSpec(await geometry(page, '.sheet'), w), `${w}px: info sheet placed per spec`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check((await geometry(page, '.sheet')) === null, `${w}px: Esc closes the info sheet`);

  await page.locator('#list').click();
  await page.waitForTimeout(700);
  check(placedPerSpec(await geometry(page, '.panel'), w), `${w}px: comments panel placed per spec`);
  if (w < 840) {
    await checkSnaps(page, w, h);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check((await geometry(page, '.panel')) === null, `${w}px: Esc closes the comments panel`);

  check(errors.length === 0, `${w}px: no console errors${errors.length ? ` (${errors[0]})` : ''}`);
  await page.close();
}

async function checkQuestions(browser, url, dir) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(1200);
  check(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('15px Geist') && document.fonts.check('13px "Geist Mono"'); }), 'fonts: Geist and Geist Mono load from the server');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const before = await bg();
  await page.locator('#theme').click();
  await page.waitForTimeout(700);
  const flipped = await bg();
  await page.reload();
  await page.waitForTimeout(800);
  check(before !== flipped && (await bg()) === flipped, 'theme: the switch flips the theme and survives a reload');
  await page.locator('#theme').click();
  await page.waitForTimeout(700);
  const head = () => page.locator('.qcard .qhead span').textContent();
  check((await head()) === 'Question 1 of 2', 'questions: the first one shows on top');
  await page.locator('#approve').click();
  await page.waitForTimeout(500);
  check(await page.locator('dialog.confirm li', { hasText: '2 unanswered questions' }).isVisible(), 'questions: unanswered ones block a silent approval');
  await page.locator('dialog.confirm [data-a=cancel]').click();
  await page.waitForTimeout(500);
  await page.locator('.qcard .opt').first().click();
  await page.locator('.qcard textarea').fill('but not before 2.0');
  await page.locator('.qcard [data-a=send]').click();
  await page.waitForTimeout(500);
  check((await head()) === 'Question 2 of 2', 'questions: answering moves to the next one');
  check((await page.locator('details.qa summary').textContent()) === 'Your answers (1)', 'questions: the answer lands in the log');
  const pending = execFileSync(process.execPath, [path.join(here, 'serve.mjs'), '--pending', '--dir', dir], { encoding: 'utf8' });
  check(/\[example\] ANSWER \S+ L4 \[#q-mobile\] "Should the mobile app move to cookies too\?" :: Move it too — but not before 2\.0/.test(pending), 'questions: the agent gets choice and free text in one ANSWER line');
  await page.locator('details.qa summary').click();
  await page.locator('details.qa .qa-item button').click();
  await page.waitForTimeout(500);
  check((await head()) === 'Change your answer' && (await page.locator('.qcard .opt.on').count()) === 1, 'questions: Change reopens the answer as given');
  await page.close();
}

async function checkToc(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(1000);
  const active = () => page.evaluate(() => document.querySelector('nav.toc a.active')?.hash ?? null);
  check((await active()) === '#questions', 'toc: the first entry is active at the top');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  const last = await page.evaluate(() => [...document.querySelectorAll('nav.toc a')].at(-1).hash);
  check((await active()) === last, 'toc: the last entry is active at the bottom');
  await page.locator('nav.toc a[href="#steps"]').click();
  await page.waitForTimeout(800);
  check((await active()) === '#steps', 'toc: a clicked entry stays active although the page cannot scroll it to the top');
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, -5000);
  await page.waitForTimeout(800);
  check((await active()) === '#questions', 'toc: scrolling by hand hands the indicator back to the scroll position');
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('j');
    await page.waitForTimeout(150);
  }
  check((await active()) === '#files', 'toc: j walks every section even where the page cannot scroll further');
  const numbers = await page.evaluate(() => [...document.querySelectorAll('nav.toc a:not(.qlink, .sub) .n')].map((n) => n.textContent).join());
  check(numbers === '01,02,03,04', `toc: entries are numbered like the sections (${numbers})`);
  await page.close();
}

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
  } finally {
    await browser?.close();
    child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
  process.exit(failures.length ? 1 : 0);
}

main();
