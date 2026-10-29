import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { check, resetPage, editBody, replyTo, postComments, here, until, settled, ready, afterEdit, scrolled } from './harness.mjs';

export const WIDTHS = [
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1000, h: 800 },
  { w: 1512, h: 900 },
];

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
  await settled(page);
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
  await settled(page);
}

// Snap points are 30%, 50%, 75% and full height minus the top margin; the sheet opens at 50%.
export async function checkSnaps(page, w, h) {
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

export async function checkWidth(browser, url, { w, h }) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  await page.goto(url);
  await ready(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `${w}px: no horizontal overflow (${overflow}px)`);
  check(['listening', 'idle'].includes(await page.locator('#status').getAttribute('data-kind')), `${w}px: status shows the server's answer`);

  await openSheet(page, w);
  check(placedPerSpec(await geometry(page, '.sheet'), w), `${w}px: info sheet placed per spec`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await settled(page);
  check((await geometry(page, '.sheet')) === null, `${w}px: Esc closes the info sheet`);

  await page.locator('#list').click();
  await settled(page);
  check(placedPerSpec(await geometry(page, '.panel'), w), `${w}px: comments panel placed per spec`);
  if (w < 840) {
    await checkSnaps(page, w, h);
  }
  await page.keyboard.press('Escape');
  await settled(page);
  check((await geometry(page, '.panel')) === null, `${w}px: Esc closes the comments panel`);

  check(errors.length === 0, `${w}px: no console errors${errors.length ? ` (${errors[0]})` : ''}`);
  await page.close();
}

export async function checkQuestions(browser, url, dir) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await ready(page);
  check(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('15px Geist') && document.fonts.check('13px "Geist Mono"'); }), 'fonts: Geist and Geist Mono load from the server');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const before = await bg();
  await page.locator('#theme').click();
  await settled(page);
  const flipped = await bg();
  await page.reload();
  await ready(page);
  check(before !== flipped && (await bg()) === flipped, 'theme: the switch flips the theme and survives a reload');
  await page.locator('#theme').click();
  await settled(page);
  const head = () => page.locator('.qcard .qhead span').textContent();
  check((await head()) === 'Question 1 of 2', 'questions: the first one shows on top');
  await page.locator('#approve').click();
  await settled(page);
  check(await page.locator('dialog.confirm li', { hasText: '2 unanswered questions' }).isVisible(), 'questions: unanswered ones block a silent approval');
  await page.locator('dialog.confirm [data-a=cancel]').click();
  await settled(page);
  await page.locator('.qcard .opt').first().click();
  await page.locator('.qcard textarea').fill('but not before 2.0');
  await page.locator('.qcard [data-a=send]').click();
  await until(page, () => document.querySelector('.qcard .qhead span')?.textContent === 'Question 2 of 2');
  check((await head()) === 'Question 2 of 2', 'questions: answering moves to the next one');
  check((await page.locator('details.qa summary').textContent()) === 'Your answers (1)', 'questions: the answer lands in the log');
  const pending = execFileSync(process.execPath, [path.join(here, 'serve.mjs'), '--pending', '--dir', dir], { encoding: 'utf8' });
  check(/\[example\] ANSWER \S+ L4 \[#q-mobile\] "Should the mobile app move to cookies too\?" :: Move it too — but not before 2\.0/.test(pending), 'questions: the agent gets choice and free text in one ANSWER line');
  await page.locator('details.qa summary').click();
  await page.locator('details.qa .qa-item button').click();
  await settled(page);
  check((await head()) === 'Change your answer' && (await page.locator('.qcard .opt.on').count()) === 1, 'questions: Change reopens the answer as given');
  await page.close();
}

export async function checkToc(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await ready(page);
  const active = (hash) => until(page, (h) => document.querySelector('nav.toc a.active')?.hash === h, hash, 2000);
  check(await active('#questions'), 'toc: the first entry is active at the top');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const last = await page.evaluate(() => [...document.querySelectorAll('nav.toc a')].at(-1).hash);
  check(await active(last), 'toc: the last entry is active at the bottom');
  await page.locator('nav.toc a[href="#steps"]').click();
  await scrolled(page);
  check(await active('#steps'), 'toc: a clicked entry stays active although the page cannot scroll it to the top');
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, -5000);
  await scrolled(page);
  check(await active('#questions'), 'toc: scrolling by hand hands the indicator back to the scroll position');
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('j');
    await scrolled(page);
  }
  check(await active('#files'), 'toc: j walks every section even where the page cannot scroll further');
  check((await page.locator('tr.has-more').count()) === 1, 'expansion: a table row takes its aside through data-for');
  const numbers = await page.evaluate(() => [...document.querySelectorAll('nav.toc a:not(.qlink, .sub) .n')].map((n) => n.textContent).join());
  check(numbers === '01,02,03,04', `toc: entries are numbered like the sections (${numbers})`);
  await page.close();
}

export async function checkChecks(browser, url, dir) {
  resetPage(dir);
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await ready(page);
  const box = page.locator('td[data-check] .chk');
  check((await box.count()) === 1 && (await box.getAttribute('aria-checked')) === 'false', 'checks: a data-check cell renders one empty box');
  await box.click();
  await settled(page);
  check((await box.getAttribute('aria-checked')) === 'true', 'checks: clicking it ticks it');
  const pending = execFileSync(process.execPath, [path.join(here, 'serve.mjs'), '--pending', '--dir', dir], { encoding: 'utf8' });
  check(/\[example\] CHECK \S+ L\d+ \[.+ › cookie\.ts\] "cookie\.ts" :: tested/.test(pending), 'checks: the agent gets one CHECK line naming the row');
  const waiting = await page.evaluate(() => ({
    marks: document.querySelectorAll('main .loader, nav.toc .loader, .loader.pin, main .c-sent, .margin .thread').length,
    pill: document.querySelector('#list').textContent,
  }));
  check(waiting.marks === 0 && !waiting.pill.includes('waiting'), `checks: a tick waits for no reply (${JSON.stringify(waiting)})`);
  await page.reload();
  await ready(page);
  check((await page.locator('td[data-check] .chk').getAttribute('aria-checked')) === 'true', 'checks: the tick survives a reload');
  await page.locator('td[data-check] .chk').click();
  await until(page, () => document.querySelector('td[data-check] .chk')?.getAttribute('aria-checked') === 'false');
  const off = execFileSync(process.execPath, [path.join(here, 'serve.mjs'), '--pending', '--dir', dir], { encoding: 'utf8' });
  check(/:: unchecked/.test(off), `checks: unticking says so (${off.trim().split('\n').length} lines)`);
  editBody(dir, '</table>', '</table>\n  <div data-check="loose">Loose</div>');
  await until(page, () => Boolean(document.querySelector('[data-check="loose"]')));
  await settled(page);
  check((await page.locator('[data-check="loose"] .chk').count()) === 0, 'checks: an element with nothing commentable around it gets no box');
  await page.close();
}

export async function checkExport(browser, dir) {
  const out = path.join(dir, 'export.html');
  execFileSync(process.execPath, [path.join(here, 'serve.mjs'), 'example', '--dir', dir, '--export', out]);
  const html = fs.readFileSync(out, 'utf8');
  check(!html.includes('/_fonts/') && html.includes('data:font/woff2'), 'export: fonts are inlined');
  const page = await browser.newPage();
  await page.goto(`file://${out}`);
  check(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('15px Geist'); }), 'export: the standalone file renders in Geist');
  check((await page.locator('#status').getAttribute('data-kind')) === 'copy', 'export: the status says it is an offline copy');
  let alerted = '';
  page.on('dialog', (d) => {
    alerted = d.message();
    d.accept();
  });
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')); });
  await page.locator('#list').click();
  await page.locator('.panel .general textarea').fill('kept even without a clipboard');
  await page.locator('.panel .general [data-a=send]').click();
  await settled(page);
  const kept = await page.evaluate(() => document.querySelectorAll('.panel .item.draft').length);
  check(kept === 1 && alerted.includes('kept as unsent'), 'export: a comment survives a refused clipboard');
  await page.close();
}

export async function checkLiveUpdate(browser, url, dir) {
  resetPage(dir);
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await ready(page);
  await page.evaluate(() => { window.alive = true; });
  await page.locator('.qcard .opt').nth(1).click();
  await afterEdit(page, 'main .lede', () => editBody(dir, '<p class="lede">', '<p class="lede">Edited. '));
  check(await page.evaluate(() => window.alive === true), 'live: a body change does not reload the page');
  check((await page.locator('.qcard .opt.on').count()) === 1, 'live: a selected but unsent answer survives a body change');
  check((await page.locator('main .lede').textContent()).startsWith('Edited.'), 'live: the changed element is swapped in');
  await page.locator('main .box').first().click();
  await page.locator('.pop textarea').fill('half typed');
  await afterEdit(page, 'main .box', () => editBody(dir, '<b>Login form</b>', '<b>Login form</b> '));
  check((await page.locator('.pop textarea').inputValue()) === 'half typed', 'live: text in an open comment survives a body change');
  await page.keyboard.press('Escape');
  await page.locator('tr[data-c="cookie.ts"]').click();
  await settled(page);
  await page.keyboard.press('Escape');
  await settled(page);
  editBody(dir, 'so routes need no change.</p>', 'so routes need no change.</p><p>More detail.</p>');
  await until(page, () => document.querySelector('.sheet-body').textContent.includes('More detail.'));
  const sheet = await page.evaluate(() => ({ open: !document.querySelector('.sheet').hidden, text: document.querySelector('.sheet-body').textContent }));
  check(sheet.open && sheet.text.includes('More detail.'), 'live: an open Info sheet shows the extended aside');
  check(await page.evaluate(() => document.querySelectorAll('aside.more').length === 1), 'live: the replaced aside leaves no stale copy behind');
  check(await page.evaluate(() => window.alive === true), 'live: the page is still the same page after several changes');
  await page.close();
  resetPage(dir);
}

export async function checkTransitions(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await ready(page);
  await page.locator('main .box').first().click();
  await settled(page);
  const left = await page.evaluate(() => [...document.documentElement.classList].filter((c) => c.startsWith('vt-')));
  check(left.length === 0, `transitions: opening a comment beside the sheet leaves no transition class behind (${left})`);
  await page.close();
}

export async function checkEditRefresh(browser, url, dir) {
  resetPage(dir);
  const file = path.join(dir, 'example.body.html');
  const questions = fs.readFileSync(file, 'utf8').match(/^<div class="q" id="[^"]+">[\s\S]*?^<\/div>\n/gm);
  fs.writeFileSync(file, questions.reduce((body, q) => body.replace(q, ''), fs.readFileSync(file, 'utf8')));
  editBody(dir, '<p class="lede">', '<p class="lede">');
  let page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await ready(page);
  const lede = fs.readFileSync(file, 'utf8').match(/<p class="lede">[\s\S]*?<\/p>\n/)[0];
  editBody(dir, lede, `${lede}${questions.at(-1)}`);
  await until(page, () => Boolean(document.querySelector('.qzone .qcard')));
  await settled(page);
  check(await page.locator('.qzone .qcard').isVisible() && (await page.locator('.qcard .qhead span').textContent()) === 'Question 1 of 1', 'questions: a question added by an edit shows on a page that had none');
  await page.close();
  resetPage(dir);
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);
  await ready(page);
  const box = await page.evaluate(() => {
    const el = document.querySelector('main .box');
    return { target: el.dataset.ct, line: Number(el.dataset.line) };
  });
  await postComments(url, [{ id: 'cx1', ...box, text: 'here' }]);
  replyTo(dir, 'cx1', 'noted');
  await until(page, () => Boolean(document.querySelector('.tbadge')));
  await afterEdit(page, 'main .box', () => editBody(dir, '<small>POST /login</small>', '<small>POST /signin</small>'));
  const place = await page.evaluate(() => {
    const badge = document.querySelector('.tbadge').getBoundingClientRect();
    const el = document.querySelector('main .box').getBoundingClientRect();
    return Math.round(Math.abs(badge.top + 11 - el.top));
  });
  check(place < 4, `badges: a thread counter stays on its element after an edit replaces it (${place}px off)`);
  await page.close();
  resetPage(dir);
}
