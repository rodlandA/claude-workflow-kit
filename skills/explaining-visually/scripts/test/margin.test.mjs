import { check, resetPage, editBody, replyTo, postComments, state, pendingLines, linkedTo, overlaps, inView } from './harness.mjs';

export async function checkMarginReply(browser, url, dir) {
  resetPage(dir);
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(1200);
  await page.locator('main .box').first().click();
  await page.locator('.pop textarea').fill('rename this');
  await page.locator('.pop [data-a=send]').click();
  await page.waitForTimeout(700);
  check(await page.locator('.margin .thread .chip.waiting').isVisible(), 'margin: a sent comment opens a thread that shows Claude is working');
  const id = (await state(url)).sent.at(-1).id;
  await page.evaluate(() => scrollTo(0, 0));
  editBody(dir, '<b>Login form</b>', '<b>Login form v2</b>');
  replyTo(dir, id, 'Renamed it.');
  await page.waitForTimeout(3000);
  const thread = page.locator('.margin .thread').first();
  check((await thread.locator('.msg.claude').textContent()).includes('Renamed it.'), 'margin: the reply lands in the thread');
  check(await thread.locator('.chip.changed').isVisible() && (await page.locator('main .box.delta').count()) === 1, 'margin: the reply names and outlines what it changed');
  const [t, b] = [await thread.boundingBox(), await page.locator('main .box').first().boundingBox()];
  check(Math.abs(t.y - b.y) < 40, 'margin: the thread sits level with the renamed element');
  check((await page.locator('#changes, #clear-changes, #reload').count()) === 0, 'margin: the bar no longer has change or reload buttons');
  const target = await page.evaluate(() => document.querySelector('.margin .thread').dataset.key);
  await postComments(url, [{ id: 'long1', target, line: 25, text: 'and this?' }]);
  replyTo(dir, 'long1', 'Also done.');
  await page.waitForTimeout(2600);
  check((await thread.locator('.msg').count()) === 1 && (await thread.locator('.earlier').textContent()) === '▾ 3 earlier in this thread', 'margin: a long thread collapses to its latest message');
  await thread.locator('.earlier').click();
  await page.waitForTimeout(300);
  check((await page.locator('.margin .thread').first().locator('.msg').count()) === 4, 'margin: the collapsed thread unfolds on click');
  await page.close();
  resetPage(dir);
}

export async function checkMarginLayout(browser, url, dir) {
  resetPage(dir);
  let page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(1200);
  const items = await page.evaluate(() => [...document.querySelectorAll('.tldr li')].slice(0, 3).map((li) => ({ target: li.dataset.ct, line: Number(li.dataset.line) })));
  await postComments(url, [...items.map((c, i) => ({ id: `lay${i}`, ...c, text: `point ${i}` })), { id: 'gen', target: 'document', line: null, text: 'overall' }]);
  await page.waitForTimeout(2600);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.margin .thread')].map((el) => {
    const r = el.getBoundingClientRect();
    return { key: el.dataset.key, general: el.classList.contains('general'), left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  const plain = cards.filter((c) => !c.general);
  const general = cards.find((c) => c.general);
  check(plain.length === 3 && plain.every((a, i) => plain.every((b, j) => i === j || !overlaps(a, b))), 'margin: threads on adjacent elements never overlap');
  const upper = plain.reduce((a, b) => (a.top < b.top ? a : b));
  await page.locator(`.margin .thread[data-key="${upper.key}"] .tools textarea`).focus();
  const apart = () => page.evaluate(() => {
    const r = [...document.querySelectorAll('.margin .thread:not(.general)')].map((el) => el.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    return r.every((a, i) => i === 0 || r[i - 1].bottom <= a.top);
  });
  await page.waitForTimeout(120);
  const midway = await apart();
  await page.waitForTimeout(400);
  check(midway && await apart() && await page.locator(`.margin .thread[data-key="${upper.key}"] [data-a=send]`).isVisible(), 'margin: opening a reply pushes the thread below along with it');
  await page.locator('main h1').click();
  check((await page.locator('.margin svg, .margin .tie').count()) === 0, 'margin: no lines are drawn between threads and their elements');
  check(Boolean(general) && plain.every((c) => general.top <= c.top && general.left > c.left), 'margin: the general thread sits on top, offset right');
  const lit = [];
  for (const c of plain) {
    lit.push((await linkedTo(page, c.key)).join('|'));
  }
  check(plain.every((c, i) => lit[i] === c.key), 'margin: hovering a thread lights up its own element');
  const roomy = () => page.evaluate(() => ({ margin: document.querySelector('.margin').getBoundingClientRect().width, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  await page.locator('main .box').first().click();
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  let wide = await roomy();
  check(await page.locator('.sheet').isVisible() && wide.margin > 200 && wide.overflow <= 0, `1512px: the margin stays beside an open Info sheet (${JSON.stringify(wide)})`);
  await page.locator('#list').click();
  await page.waitForTimeout(700);
  wide = await roomy();
  check(await page.locator('.panel.open').isVisible() && wide.margin > 200 && wide.overflow <= 0, `1512px: the margin stays beside the open comments panel (${JSON.stringify(wide)})`);
  await page.close();
  page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.goto(url);
  await page.waitForTimeout(1500);
  const mid = await page.evaluate(() => ({ margin: document.querySelector('.margin').getBoundingClientRect().width, toc: getComputedStyle(document.querySelector('nav.toc')).display, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  check(mid.margin > 200 && mid.toc === 'flex' && mid.overflow <= 0, `1000px: the margin stays, the TOC becomes a row, no overflow (${JSON.stringify(mid)})`);
  await page.locator('#list').click();
  await page.waitForTimeout(700);
  check(await page.locator('.margin').isHidden(), '1000px: the margin gives way to the comments panel when there is no room');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.locator('main .step').first().click();
  await page.waitForTimeout(500);
  check(await page.locator('.sheet').isVisible() && await page.locator('.margin').isHidden(), '1000px: the margin gives way to the Info sheet when there is no room');
  await page.locator('.pop textarea').fill('narrow');
  await page.locator('.pop [data-a=send]').click();
  await page.waitForTimeout(800);
  check(await page.locator('.sheet').isHidden() && await page.locator('.margin .thread').first().isVisible(), '1000px: the sheet makes way so a new thread shows');
  await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);
  await page.waitForTimeout(1500);
  check(await page.locator('.margin').isHidden(), '390px: no margin');
  await page.close();
  resetPage(dir);
}

const marginFrames = (page, ms) => page.evaluate((span) => new Promise((done) => {
  const frames = [];
  const t0 = performance.now();
  const read = () => {
    frames.push([...document.querySelectorAll('.margin .thread:not(.general, .leaving)')].map((el) => el.getBoundingClientRect()).sort((a, b) => a.top - b.top).map((r) => ({ top: r.top, bottom: r.bottom })));
    if (performance.now() - t0 < span) {
      requestAnimationFrame(tick);
    } else {
      done(frames);
    }
  };
  // Read after the frame has rendered, so resize observers have run as they do before paint.
  const tick = () => setTimeout(read, 0);
  requestAnimationFrame(tick);
}), ms);

// No frame lets the threads overlap or opens a gap wider than where the motion starts or ends.
const inStep = (frames) => {
  const gaps = frames.map(([a, b]) => (b ? b.top - a.bottom : -1));
  return Math.min(...gaps) >= 7.5 && Math.max(...gaps) <= Math.max(gaps[0], gaps.at(-1)) + 1.5;
};

export async function checkMarginMotion(browser, url, dir) {
  resetPage(dir);
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(1200);
  const items = await page.evaluate(() => [...document.querySelectorAll('.tldr li')].slice(0, 2).map((li) => ({ target: li.dataset.ct, line: Number(li.dataset.line) })));
  await postComments(url, items.map((c, i) => ({ id: `mot${i}`, ...c, text: `a longer point number ${i} that wraps over a couple of lines in the margin` })));
  await page.waitForTimeout(2600);
  const upper = page.locator(`.margin .thread[data-key="${items[0].target}"]`);
  await upper.hover();
  let frames = marginFrames(page, 450);
  await upper.locator('[data-a=fold]').click();
  frames = await frames;
  check(frames[0][1].top - frames[0][0].bottom < 9 && inStep(frames), 'motion: folding a thread moves the thread below in step');
  await page.waitForTimeout(200);
  frames = marginFrames(page, 450);
  await upper.click();
  frames = await frames;
  check(inStep(frames), 'motion: unfolding a thread pushes the thread below in step');
  await page.waitForTimeout(200);
  await page.locator('main h1').click();
  await upper.hover();
  const lowerKey = items[1].target;
  const departure = page.evaluate((key) => new Promise((done) => {
    const frames = [];
    const read = () => {
      const gone = document.querySelector('.margin .thread.leaving');
      const lower = document.querySelector(`.margin .thread[data-key="${key}"]`).getBoundingClientRect().top;
      frames.push({ lower, leaving: gone ? gone.getBoundingClientRect().bottom : null });
      if (frames.length < 70) {
        requestAnimationFrame(() => setTimeout(read, 0));
      } else {
        done(frames);
      }
    };
    read();
  }), lowerKey);
  await upper.locator('[data-a=resolve]').click();
  await page.waitForTimeout(120);
  const leaving = await page.evaluate(() => {
    const el = document.querySelector('.margin .thread.leaving');
    return el && { opacity: Number(getComputedStyle(el).opacity), x: new DOMMatrix(getComputedStyle(el).transform).m41 };
  });
  check(Boolean(leaving) && leaving.opacity < 1 && leaving.x > 0, `motion: a resolved thread slides out to the right (${JSON.stringify(leaving)})`);
  await page.waitForTimeout(600);
  check((await page.locator('.margin .thread.leaving').count()) === 0, 'motion: the resolved thread is gone once it has slid out');
  const left = await departure;
  check(left.every((f) => f.leaving === null || f.lower >= f.leaving - 0.5) && left.find((f) => f.leaving !== null).lower === left[0].lower && left.at(-1).lower < left[0].lower, 'motion: the thread below moves up only as the resolved one gives up its place');
  await page.close();
  resetPage(dir);
}

export async function checkThreadActions(browser, url, dir) {
  resetPage(dir);
  let page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(1200);
  const box = await page.evaluate(() => {
    const el = document.querySelector('main .box');
    return { target: el.dataset.ct, line: Number(el.dataset.line) };
  });
  await postComments(url, [{ id: 'act1', ...box, text: 'tighten this' }]);
  editBody(dir, '<small>POST /login</small>', '<small>POST /session</small>');
  replyTo(dir, 'act1', 'Done.');
  await page.waitForTimeout(2600);
  const card = () => page.locator(`.margin .thread[data-key="${box.target}"]`);
  await card().locator('textarea').fill('one more');
  await card().locator('[data-a=send]').click();
  await page.waitForTimeout(700);
  check(pendingLines(dir).includes(`[${box.target}] "↩ Done." :: one more`), 'actions: a reply in the thread reaches Claude with its previous answer quoted');
  await card().locator('textarea').fill('later');
  await card().locator('[data-a=batch]').click();
  await page.waitForTimeout(400);
  check((await card().locator('.msg.me.draft').textContent()).includes('not sent') && (await page.locator('#send').textContent()) === 'Send batch (1)', 'actions: a batched reply shows in the thread as not sent');
  await card().hover();
  await card().locator('[data-a=fold]').click();
  await page.waitForTimeout(400);
  check((await card().getAttribute('class')).includes('folded') && (await card().textContent()).includes('💬'), 'actions: fold shrinks the thread to a tab');
  await page.reload();
  await page.waitForTimeout(1500);
  check((await card().getAttribute('class')).includes('folded'), 'actions: a folded thread stays folded after a reload');
  await card().click();
  await page.waitForTimeout(400);
  await card().hover();
  await card().locator('[data-a=resolve]').click();
  await page.waitForTimeout(700);
  check((await card().count()) === 0 && (await page.locator('.tbadge').count()) === 1, 'actions: resolve takes the thread out of the margin and leaves a counter');
  check(Boolean((await state(url)).resolved[box.target]), 'actions: resolve is stored on the server');
  await page.locator('#list').click();
  await page.waitForTimeout(700);
  check((await page.locator(`.panel .thread-item.resolved[data-key="${box.target}"]`).count()) === 1, 'actions: the panel lists the thread under Resolved');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const followUp = (await state(url)).sent.find((c) => c.text === 'one more').id;
  replyTo(dir, followUp, 'Tightened.');
  await page.waitForTimeout(2600);
  check((await card().count()) === 1, 'actions: a new reply reopens a resolved thread');
  await card().locator('.msg.claude').last().click();
  await page.waitForTimeout(900);
  const boxLit = () => page.evaluate((t) => [...document.querySelectorAll('main .linked')].some((el) => el.dataset.ct === t), box.target);
  const selected = async () => (await card().getAttribute('class')).includes('selected');
  check(await page.locator('.panel').isHidden() && await selected() && await boxLit(), 'select: clicking a thread selects it and lights up its element, without the panel');
  check((await page.locator('main .box.flash').count()) === 1, 'actions: clicking a thread flashes the change');
  await page.mouse.move(5, 450);
  await page.waitForTimeout(200);
  check(await boxLit(), 'select: the element stays lit after the pointer leaves');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(!(await selected()) && !(await boxLit()), 'select: Esc clears the selection');
  await page.locator('main .box').first().click();
  await page.waitForTimeout(500);
  const replying = await page.evaluate((t) => document.activeElement === document.querySelector(`.margin .thread[data-key="${t}"] .tools textarea`), box.target);
  check((await page.locator('.pop').count()) === 0 && await page.locator('.sheet').isVisible() && await selected() && replying, 'select: clicking an element with a thread opens its sheet like any element, and selects the thread to reply in');
  check(await card().locator('[data-a=open-info], [data-a=open-code]').evaluateAll((els) => els.every((el) => !el.checkVisibility())), 'select: a margin thread has no Info or Code buttons, since its element opens them');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const step = await page.evaluate(() => {
    const el = document.querySelector('main .step');
    return { target: el.dataset.ct, line: Number(el.dataset.line) };
  });
  await postComments(url, [{ id: 'act2', ...step, text: 'which file?' }]);
  editBody(dir, '<td>Deleted in step 3</td>', '<td>Deleted in step 3, see step 1</td>');
  replyTo(dir, 'act2', 'Noted in the table.');
  await page.waitForTimeout(2600);
  await page.evaluate(() => document.querySelector('main .step').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.locator(`.margin .thread[data-key="${step.target}"]`).hover();
  await page.locator(`.margin .thread[data-key="${step.target}"] [data-a=show]`).click();
  await page.waitForTimeout(900);
  check(await inView(page, 'table.files tr:last-child'), 'actions: Show change scrolls to what the reply changed');
  await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);
  await page.waitForTimeout(1500);
  const badge = page.locator('.tbadge').first();
  await badge.scrollIntoViewIfNeeded();
  await badge.click();
  await page.waitForTimeout(800);
  check(await page.locator('.panel.open').isVisible() && (await page.locator('.panel .thread-item').count()) === 1 && await page.locator('.panel .general').isHidden(), '390px: a thread counter opens the panel on that thread alone');
  await page.locator('.panel .back').click();
  await page.waitForTimeout(300);
  check((await page.locator('.panel .thread-item').count()) >= 2, '390px: All comments goes back to every thread');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await page.locator('main .box').first().click();
  await page.waitForTimeout(800);
  check(await page.locator('.panel.open').isVisible() && (await page.locator(`.panel .thread-item[data-key="${box.target}"]`).count()) === 1 && (await page.locator('.panel .thread-item').count()) === 1, '390px: tapping an element with a thread opens that thread');
  await page.locator('.panel .thread-item textarea').fill('from the panel');
  await page.locator('.panel .thread-item [data-a=send]').click();
  await page.waitForTimeout(700);
  check(pendingLines(dir).includes(`[${box.target}] "↩ Tightened." :: from the panel`), '390px: a reply typed in the panel continues the thread');
  await page.close();
  resetPage(dir);
}

export async function checkOffscreen(browser, url, dir) {
  resetPage(dir);
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(1200);
  const last = await page.evaluate(() => {
    const el = document.querySelector('table.files tr:last-child');
    return { target: el.dataset.ct, line: Number(el.dataset.line) };
  });
  await postComments(url, [{ id: 'off1', ...last, text: 'x' }, { id: 'off2', ...last, text: 'y' }]);
  await page.evaluate(() => scrollTo(0, 0));
  editBody(dir, '<td>New middleware</td>', '<td>New cookie middleware</td>');
  replyTo(dir, 'off1', 'done');
  await page.waitForTimeout(2600);
  check(((await page.locator('.offscreen-note.below').textContent()) ?? '').includes('1 new reply below'), 'offscreen: a reply out of view is announced below');
  check((await page.locator('main .delta').count()) === 1 && (await page.title()).startsWith('(1)'), 'offscreen: an unseen reply keeps its outline and the title count');
  await page.locator('.offscreen-note.below').click();
  await page.waitForTimeout(2500);
  check(await page.locator('.offscreen-note.below').isHidden(), 'offscreen: the notice clears once the reply is seen');
  check((await page.locator('main .delta').count()) === 0, 'offscreen: the outline clears once seen');
  check(!(await page.title()).startsWith('('), 'offscreen: the title count clears once seen');
  const card = page.locator(`.margin .thread[data-key="${last.target}"]`);
  await card.hover();
  await card.locator('[data-a=fold]').click();
  await page.waitForTimeout(400);
  replyTo(dir, 'off2', 'also done');
  await page.waitForTimeout(2600);
  check(!(await card.getAttribute('class')).includes('folded'), 'offscreen: a new reply unfolds a folded thread');
  const inner = await page.evaluate(() => {
    const el = document.querySelector('main aside.more p');
    return { target: el.dataset.ct, line: Number(el.dataset.line) };
  });
  await postComments(url, [{ id: 'aside1', ...inner, text: 'more?' }]);
  await page.waitForTimeout(2600);
  const owner = await page.evaluate(() => document.querySelector('tr[data-c="cookie.ts"]').dataset.ct);
  check((await linkedTo(page, inner.target)).join('|') === owner, 'margin: a comment inside an expansion sits beside the element the expansion belongs to');
  await page.close();
  resetPage(dir);
}

export async function checkExpand(browser, url, dir) {
  resetPage(dir);
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(1200);
  const target = await page.evaluate(() => document.querySelector('main .box').dataset.ct);
  await page.locator('main .box').first().click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator('.sheet .ask textarea').fill('why this order?');
  await page.locator('.sheet .ask button').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const id = (await state(url)).sent.find((c) => c.kind === 'expand').id;
  editBody(dir, '<div class="box"><b>Login form</b><small>POST /login</small></div>', '<div class="box"><b>Login form</b><small>POST /login</small></div><aside class="more"><p>Order matters.</p></aside>');
  replyTo(dir, id, 'Added to Info for Login form');
  await page.waitForTimeout(2600);
  const card = page.locator(`.margin .thread[data-key="${target}"]`);
  check((await card.locator('.msg.me').textContent()).includes('why this order?') && await card.locator('[data-a=info]').isVisible(), 'expand: the question opens a thread whose reply offers Show in Info');
  await card.locator('[data-a=info]').click();
  await page.waitForTimeout(800);
  const sheet = await page.evaluate(() => {
    const asked = document.querySelector('.sheet-body .asked');
    const aside = document.querySelector('.sheet-body aside.more');
    return { open: !document.querySelector('.sheet').hidden, asked: asked?.textContent ?? '', before: Boolean(asked && aside && asked.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  check(sheet.open && sheet.asked.includes('why this order?') && sheet.before, 'expand: the Info tab shows the question above the expansion');
  await page.close();
  resetPage(dir);
}

async function cardBesideStep(page, key) {
  if (!(await page.locator(`.margin .thread[data-key="${key}"]`).count())) {
    return false;
  }
  await linkedTo(page, key);
  return page.evaluate((k) => {
    const card = [...document.querySelectorAll('.margin .thread')].find((el) => el.dataset.key === k);
    const step = document.querySelector('main .step');
    return step.classList.contains('linked') && Math.abs(card.getBoundingClientRect().top - step.getBoundingClientRect().top) < 40;
  }, key);
}

export async function checkReviewFixes(browser, url, dir) {
  resetPage(dir);
  let page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await page.waitForTimeout(1200);
  const step = await page.evaluate(() => {
    const el = document.querySelector('main .step');
    return { target: el.dataset.ct, line: Number(el.dataset.line) };
  });
  await postComments(url, [{ id: 'fx1', ...step, text: 'rename' }]);
  editBody(dir, 'Add cookie middleware beside bearer auth', 'Add the cookie middleware');
  replyTo(dir, 'fx1', 'Renamed.');
  await page.waitForTimeout(2600);
  await postComments(url, [{ id: 'fx2', ...step, text: 'thanks' }]);
  replyTo(dir, 'fx2', 'You are welcome.');
  await page.waitForTimeout(2600);
  check(await cardBesideStep(page, step.target), 'fixes: a renamed element keeps its thread after a follow-up with no edit');
  await postComments(url, [{ id: 'fx4', kind: 'approve', target: 'document', line: null, text: '', version: 'x' }]);
  replyTo(dir, 'fx4', 'Approved — next: step 1');
  await page.waitForTimeout(3500);
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('explainer:example:seen')).includes('fx4')), 'fixes: an approval reply does not leave an unread count');
  await page.locator('#list').click();
  await page.waitForTimeout(700);
  check((await page.locator('.panel .list').textContent()).includes('Approved — next: step 1'), 'fixes: the approval reply shows in the panel');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await postComments(url, [{ id: 'fx3', target: 'Steps › Login sets the cookie', line: step.line + 1, text: 'and this one?' }]);
  editBody(dir, '<h2>Steps</h2>', '<h2>Rollout steps</h2>');
  await page.waitForTimeout(2600);
  await linkedTo(page, 'Steps › Login sets the cookie');
  check(await page.evaluate(() => document.querySelectorAll('main .step')[1].classList.contains('linked')), 'fixes: a thread stays beside its element after its section is renamed');
  await page.mouse.move(5, 450);
  await page.locator('.qcard textarea').click();
  await page.keyboard.type('abc');
  editBody(dir, '<p class="lede">', '<p class="lede">Again. ');
  await page.waitForTimeout(2600);
  await page.keyboard.type('def');
  check((await page.locator('.qcard textarea').inputValue()) === 'abcdef', 'fixes: typing in a question survives a body change');
  await page.locator('.qcard textarea').fill('');
  await page.evaluate(() => document.querySelector('main .box').scrollIntoView({ block: 'center' }));
  await page.locator('main .box').first().click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator('.sheet .ask textarea').click();
  await page.keyboard.type('abc');
  editBody(dir, '<p class="lede">', '<p class="lede">More. ');
  await page.waitForTimeout(2600);
  await page.keyboard.type('def');
  check((await page.locator('.sheet .ask textarea').inputValue()) === 'abcdef', 'fixes: typing in the Info sheet survives a body change');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const steps = page.locator('main .step').nth(2);
  await steps.click();
  await page.waitForTimeout(400);
  await page.locator('.pop textarea').fill('where?');
  editBody(dir, '<h2>Rollout steps</h2>', '<h2>Rollout steps</h2>\n<p>Shifted.</p>');
  await page.waitForTimeout(2600);
  const now = await steps.getAttribute('data-line');
  await page.locator('.pop [data-a=send]').click();
  await page.waitForTimeout(600);
  check((await state(url)).sent.find((c) => c.text === 'where?')?.line === Number(now), 'fixes: a comment sent after its section moved carries the current line');
  check(await page.locator('.sheet').isVisible() && await page.locator('.margin').isVisible(), 'fixes: with room, the sheet stays open beside the margin after a send');
  const card = page.locator(`.margin .thread[data-key="${step.target}"]`);
  const text = await card.locator('.msg.claude .text').last().boundingBox();
  await page.mouse.move(text.x + 2, text.y + 6);
  await page.mouse.down();
  await page.mouse.move(text.x + 60, text.y + 6, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  check(await page.locator('.panel').isHidden(), 'fixes: selecting text in a thread does not open the panel');
  await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);
  await page.waitForTimeout(1500);
  await postComments(url, [{ id: 'fx5', target: 'document', line: null, text: 'overall?' }]);
  replyTo(dir, 'fx5', 'Overall fine.');
  await page.waitForTimeout(2600);
  check((await page.title()).startsWith('(1)'), '390px: a general reply counts as unread');
  await page.locator('#list').click();
  await page.waitForTimeout(2500);
  check(!(await page.title()).startsWith('('), '390px: opening the panel on a general reply marks it read');
  await page.close();
  resetPage(dir);
}
