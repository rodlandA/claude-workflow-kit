import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { check, startServer, launch, resetPage, editBody, here, until, ready, settled } from './harness.mjs';

const legendOf = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(`${s} .legend`)].map((l) => [...l.children].map((c) => c.className).join(',')), sel);

export async function checkLegend(browser, url, dir) {
  resetPage(dir);
  editBody(dir, '<div class="box"><b>Login form</b>', '<div class="box focus"><b>Login form</b>');
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await ready(page);
  check((await legendOf(page, '#after')).join('|') === 'new,changed,removed', 'legend: colours without a legend get one naming exactly the states used');
  check((await legendOf(page, '#today')).join('|') === 'focus', 'legend: focus has its own legend entry');
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    const borders = await page.evaluate(() => ['new', 'changed', 'removed', 'focus'].map((k) => getComputedStyle(document.querySelector(`main .box.${k}`)).borderTopColor));
    check(new Set(borders).size === 4, `legend: the four states have four different colours in ${scheme} mode`);
  }
  resetPage(dir);
  editBody(dir, '<div class="cols">', '<div class="legend"><span class="new">new</span></div>\n  <div class="cols">');
  await page.reload();
  await ready(page);
  check((await legendOf(page, '#after')).join('|') === 'new', 'legend: a legend the body writes is not doubled');
  await page.close();
  const shell = fs.readFileSync(path.join(here, 'shell.html'), 'utf8');
  const states = shell.match(/^\s*--(new|changed|removed)(-soft)?:.*$/gm) ?? [];
  check(states.length === 6 && states.every((l) => !l.includes('#')), 'palette: state colours are derived from the palette, not hand-picked');
}

const FIGURE = '<figure data-c="Sequence"><svg viewBox="0 0 300 90" aria-label="Sequence"><rect class="lane" x="0" y="0" width="300" height="40"/><rect class="node changed" x="10" y="5" width="80" height="30"/><path class="edge arrow" d="M90 20 H200"/><text class="label" x="10" y="70">time</text><g data-c="Gate"><rect class="node" x="210" y="5" width="80" height="30"/></g></svg></figure><aside class="more" data-for="Gate"><p>Why the gate.</p></aside>';

export async function checkDrawing(browser, url, dir) {
  resetPage(dir);
  editBody(dir, '<h2>How a request is authenticated today</h2>', `<h2>How a request is authenticated today</h2>\n  ${FIGURE}`);
  editBody(dir, '<li><b>Size</b>3 files, one migration step, no schema change.</li>', '<li><b>Size</b>3 files, one migration step, no schema change.</li>\n  <li><b>Risk</b>Low.</li>');
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await ready(page);
  const rows = await page.evaluate(() => new Set([...document.querySelectorAll('.tldr li')].map((li) => Math.round(li.getBoundingClientRect().top))).size);
  check(rows === 1, `layout: four tldr items share one row on a wide screen (${rows} rows)`);
  const drawn = await page.evaluate(() => {
    const fig = document.querySelector('#today figure');
    const marker = getComputedStyle(fig.querySelector('.edge.arrow')).markerEnd;
    const id = marker.match(/#([\w-]+)/)?.[1];
    return {
      arrow: Boolean(id && document.getElementById(id)?.tagName === 'marker'),
      fill: getComputedStyle(fig.querySelector('.node.changed')).fill,
      box: getComputedStyle(document.querySelector('main .box.changed')).backgroundColor,
      legend: fig.previousElementSibling?.matches('.legend') ? fig.previousElementSibling.textContent : null,
    };
  });
  check(drawn.arrow, 'drawing: an arrow edge gets the shell arrowhead');
  check(drawn.fill === drawn.box, 'drawing: a state class fills an SVG node with its state colour');
  check(drawn.legend === 'changed', 'legend: a figure with coloured nodes gets a legend above it');
  check(await page.locator('#today figure [data-c="Gate"] .ibadge').isVisible(), 'drawing: an SVG part with an expansion shows the i badge');
  const contrast = () => page.evaluate(() => {
    const rgb = (css) => {
      const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d');
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    };
    const lum = (css) => rgb(css).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const probe = document.createElement('div');
    document.body.append(probe);
    const resolve = (v) => {
      probe.style.color = `var(${v})`;
      return getComputedStyle(probe).color;
    };
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const fg = resolve('--fg');
    const worst = Math.min(...['flame', 'truffle', 'blue-fantastic'].flatMap((h) => [100, 200].map((n) => ratio(fg, resolve(`--${h}-${n}`)))));
    probe.remove();
    return worst;
  });
  const light = await contrast();
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await contrast();
  check(light >= 4.5 && dark >= 4.5, `palette: text reads on the light steps (100, 200) in both themes (${light.toFixed(1)}, ${dark.toFixed(1)})`);
  await page.close();
  resetPage(dir);
  const shell = fs.readFileSync(path.join(here, 'shell.html'), 'utf8');
  const steps = ['flame', 'truffle', 'blue-fantastic'].flatMap((hue) => [100, 200, 300, 400, 600, 700, 800, 900].map((n) => `--${hue}-${n}:`));
  check(steps.every((t) => shell.includes(t)), 'palette: every hue has its 100-900 steps for drawings');
}

const LIVE = `<figure class="live" data-c="Spin"><script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export default (el, { palette }) => {
  el.dataset.rev = THREE.REVISION;
  el.dataset.orbit = typeof OrbitControls;
  el.dataset.fg = palette.fg;
  el.insertAdjacentHTML('beforeend', "<b class='marked'>x</b>");
  window.liveMounts = (window.liveMounts ?? 0) + 1;
  return () => { window.liveCleanups = (window.liveCleanups ?? 0) + 1; };
};
</script><figcaption>Spins.</figcaption></figure>`;

export async function checkLive(browser, url, dir) {
  resetPage(dir);
  editBody(dir, '<h2>How a request is authenticated today</h2>', `<h2>How a request is authenticated today</h2>\n  ${LIVE}`);
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  await page.goto(url);
  await ready(page);
  await until(page, () => Boolean(document.querySelector('#today figure.live .live-stage')?.dataset.rev));
  const stage = page.locator('#today figure.live .live-stage');
  const fg = () => page.evaluate(() => {
    const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d');
    ctx.fillStyle = getComputedStyle(document.body).color;
    ctx.fillRect(0, 0, 1, 1);
    return `#${[...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  });
  check((await stage.getAttribute('data-rev')) === '168' && (await stage.getAttribute('data-orbit')) === 'function', 'live: a live figure runs its module with three.js and its addons');
  check((await stage.getAttribute('data-fg')) === await fg(), 'live: the module gets the page palette as hex');
  check((await stage.locator('b.marked').count()) === 1, 'live: markup in a module string is left as written, not stamped with source lines');
  await stage.click();
  await settled(page);
  check((await page.locator('.pop').count()) === 0 && await page.locator('.sheet').isHidden(), 'live: clicking inside a live figure does not open a comment or the sheet');
  await page.emulateMedia({ colorScheme: 'dark' });
  const counts = () => page.evaluate(() => [window.liveMounts, window.liveCleanups ?? 0]);
  const mounted = (n) => until(page, (want) => window.liveMounts === want && Boolean(document.querySelector('#today figure.live .live-stage')?.dataset.rev), n);
  await mounted(2);
  check(JSON.stringify(await counts()) === '[2,1]' && (await stage.getAttribute('data-fg')) === await fg(), 'live: a theme change cleans up and remounts with the new palette');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await mounted(3);
  check(JSON.stringify(await counts()) === '[3,2]', 'live: a change in reduced motion remounts the figure');
  editBody(dir, '<figcaption>Spins.</figcaption>', '<figcaption>Spins slowly.</figcaption>');
  await mounted(4);
  check(JSON.stringify(await counts()) === '[4,3]' && (await page.locator('#today figure.live .live-stage').getAttribute('data-rev')) === '168', 'live: an edit cleans up the old figure and mounts the new one');
  await page.close();
  const out = path.join(dir, 'live-export.html');
  execFileSync(process.execPath, [path.join(here, 'serve.mjs'), 'example', '--dir', dir, '--export', out]);
  const html = fs.readFileSync(out, 'utf8');
  const offline = await browser.newPage();
  await offline.goto(`file://${out}`);
  await until(offline, () => Boolean(document.querySelector('figure.live .live-stage')?.dataset.rev));
  check(!html.includes('/_vendor/') && (await offline.locator('figure.live .live-stage').getAttribute('data-rev')) === '168', 'export: a live figure runs offline with three.js inlined');
  await offline.close();
  resetPage(dir);
  execFileSync(process.execPath, [path.join(here, 'serve.mjs'), 'example', '--dir', dir, '--export', out]);
  check(!fs.readFileSync(out, 'utf8').includes('data:text/javascript'), 'export: a page without live figures carries no three.js');
}

// The showcase is what agents read to see each technique written out; it must keep rendering as the shell changes.
export async function checkShowcase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainer-showcase-'));
  const source = path.join(here, '..', 'showcase.body.html');
  check(fs.existsSync(source), 'showcase: the skill ships a showcase page');
  if (!fs.existsSync(source)) {
    return;
  }
  fs.copyFileSync(source, path.join(dir, 'showcase.body.html'));
  const { child, url } = await startServer(dir, { port: '4893' });
  const browser = await launch(['--use-angle=swiftshader', '--enable-unsafe-swiftshader']);
  try {
    const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(new URL('../showcase/', url).href);
    await until(page, () => {
      const stages = [...document.querySelectorAll('main figure.live .live-stage')];
      return stages.length === 2 && stages.every((s) => s.childElementCount || s.classList.contains('failed'));
    }, null, 15000);
    const live = await page.evaluate(() => [...document.querySelectorAll('main figure.live .live-stage')].map((s) => (s.classList.contains('failed') ? s.textContent : s.childElementCount)));
    check(live.length === 2 && live.every((n) => typeof n === 'number' && n > 0) && errors.length === 0, `showcase: every live figure mounts without errors (${JSON.stringify({ live, errors })})`);
    check((await page.locator('main figure svg').count()) >= 5, 'showcase: the drawings render');
  } finally {
    await browser.close();
    child.kill();
  }
}
