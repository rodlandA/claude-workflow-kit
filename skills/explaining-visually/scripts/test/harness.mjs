import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const failures = [];

export const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    failures.push(label);
  }
};

export function cssBalanced() {
  const shell = fs.readFileSync(path.join(here, 'shell.html'), 'utf8');
  const css = shell.slice(shell.indexOf('<style>'), shell.indexOf('</style>')).replace(/"[^"]*"/g, '');
  return css.split('{').length === css.split('}').length;
}

export function startServer(dir, { port = '4890', extra = [], until = /explainer: (\S+)/, scripts = here, env = { EXPLAINER_NO_UPDATE_CHECK: '1' } } = {}) {
  const body = path.join(dir, 'example.body.html');
  fs.copyFileSync(path.join(here, '..', 'example.body.html'), body);
  const child = spawn(process.execPath, [path.join(scripts, 'serve.mjs'), body, '--root', path.join(here, '..'), '--port', port, '--no-open', ...extra], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...env } });
  let out = '';
  return new Promise((done, fail) => {
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const found = out.match(until);
      if (found) {
        done({ child, url: out.match(/explainer: (\S+)/)?.[1], found });
      }
    });
    child.on('exit', (code) => fail(new Error(`serve.mjs exited with ${code}`)));
  });
}

export async function launch(args = []) {
  try {
    return await chromium.launch({ channel: 'chrome', args });
  } catch {
    return chromium.launch({ args });
  }
}

export const exchange = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((done) => {
  const u = new URL(url);
  const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers }, (res) => {
    res.resume();
    res.on('end', () => done({ status: res.statusCode, headers: res.headers }));
  });
  req.on('error', () => done({ status: 0, headers: {} }));
  req.end(body);
});

export const request = async (url, opts) => (await exchange(url, opts)).status;

export const SIDECARS = ['comments.jsonl', 'replies.json', 'resolved.json', 'replied.html', 'cursor'];

export function resetPage(dir) {
  SIDECARS.forEach((ext) => fs.rmSync(path.join(dir, `example.${ext}`), { force: true }));
  fs.copyFileSync(path.join(here, '..', 'example.body.html'), path.join(dir, 'example.body.html'));
}

let bodyClock = 0;

// Two edits within one millisecond would share an mtime, and the mtime is the page version.
export function editBody(dir, from, to) {
  const file = path.join(dir, 'example.body.html');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(from, to));
  bodyClock += 1;
  const t = Date.now() / 1000 + bodyClock;
  fs.utimesSync(file, t, t);
}

export const replyTo = (dir, id, text) => execFileSync(process.execPath, [path.join(here, 'serve.mjs'), '--reply', id, text, '--dir', dir], { encoding: 'utf8' });

export const postComments = (url, comments) => request(new URL('comments', url).href, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ comments }) });

export const state = async (url) => (await fetch(new URL('state', url))).json();

export const postResolve = (url, body, headers = {}) => request(new URL('resolve', url).href, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

export const pendingLines = (dir) => execFileSync(process.execPath, [path.join(here, 'serve.mjs'), '--pending', '--dir', dir], { encoding: 'utf8' });

export async function waitFor(probeOnce, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const value = await probeOnce().catch(() => null);
    if (value) {
      return value;
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  return null;
}

export async function linkedTo(page, key) {
  await page.locator(`.margin .thread[data-key="${key}"]`).hover();
  await page.waitForTimeout(100);
  return page.evaluate(() => [...document.querySelectorAll('main .linked')].map((el) => el.dataset.ct));
}

export const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export const inView = (page, sel) => page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  return r.top >= 0 && r.bottom <= innerHeight;
}, sel);
