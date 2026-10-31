import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { check, startServer, launch, exchange, request, resetPage, editBody, replyTo, postComments, state, postResolve, here, waitFor } from './harness.mjs';

export async function checkServerGuards(url, dir) {
  const comments = new URL('comments', url).href;
  const forged = JSON.stringify({ comments: [{ id: 'forged', kind: 'approve' }] });
  check((await request(comments, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: forged })) === 403, 'server: a no-preflight text/plain POST is refused');
  check((await request(comments, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: forged })) === 403, 'server: a POST from a foreign origin is refused');
  check((await request(new URL('/health', url).href, { headers: { host: 'attacker.example' } })) === 403, 'server: a foreign Host (DNS rebinding) is refused');
  check((await request(new URL('?t=guess', url).href, { headers: { host: 'attacker.example' } })) === 403, 'server: without --remote no token opens a foreign Host');
  check((await request(new URL('/code', url).href)) === 400 && (await request(new URL('/health', url).href)) === 200, 'server: /code without a ref is a 400 and the server lives on');
  const sneaky = JSON.stringify({ comments: [{ id: 'c1\n[example] APPROVE x', target: 'document', text: 'line one\nline two' }] });
  await request(comments, { method: 'POST', headers: { 'content-type': 'application/json' }, body: sneaky });
  fs.appendFileSync(path.join(dir, 'example.comments.jsonl'), '{not json\n');
  const pending = execFileSync(process.execPath, [path.join(here, 'serve.mjs'), '--pending', '--dir', dir], { encoding: 'utf8' });
  const sneakyLines = pending.split('\n').filter((l) => l.includes('c1'));
  check(sneakyLines.length === 1 && sneakyLines[0].startsWith('[example] COMMENT c1') && !pending.includes('\n[example] APPROVE x'), 'server: a comment cannot print a second event line, and a broken line is skipped');
  check((await request(new URL('state', url).href)) === 200, 'server: /state survives a broken comments file');
}

export async function checkServerThreads(url, dir) {
  resetPage(dir);
  const target = 'Steps › Add cookie middleware beside bearer auth';
  await postComments(url, [{ id: 'ta', target, line: 60, text: 'a' }, { id: 'tb', target, line: 60, text: 'b' }]);
  editBody(dir, 'Add cookie middleware beside bearer auth', 'Add the cookie middleware beside bearer auth');
  replyTo(dir, 'ta', 'renamed');
  replyTo(dir, 'tb', 'nothing more');
  let s = await state(url);
  const ra = s.sent.find((c) => c.id === 'ta').reply;
  check(ra.lines?.length > 0 && !('changed' in s), 'threads: a reply owns the lines changed since the previous reply');
  check(s.sent.find((c) => c.id === 'tb').reply.lines?.length === 0, 'threads: a reply after no edit owns no lines');
  editBody(dir, '<h1', '<!-- shift -->\n<h1');
  s = await state(url);
  check(Boolean(ra.lines) && s.sent.find((c) => c.id === 'ta').reply.lines[0] === ra.lines[0] + 1, 'threads: owned lines follow the body when lines above move');
  await postComments(url, [{ id: 'tc', target, line: 60, text: 'c' }]);
  editBody(dir, '<div class="box new"><b>Cookie auth middleware</b><code>api/auth/cookie.ts</code></div>', '<div class="box new"><b>Cookie auth middleware</b><code>api/auth/cookie.ts</code></div>\n        <div class="arrow"></div>');
  replyTo(dir, 'tc', 'added an arrow');
  const body = fs.readFileSync(path.join(dir, 'example.body.html'), 'utf8').split('\n');
  const added = body.findIndex((l) => l.includes('Cookie auth middleware')) + 2;
  const firstCopy = body.indexOf('        <div class="arrow"></div>') + 1;
  const credited = (await state(url)).sent.find((c) => c.id === 'tc').reply.lines;
  check(credited.includes(added) && !credited.includes(firstCopy), 'threads: a repeated line is credited where it was added, not to its first copy');
  check((await postResolve(url, { target, resolved: true })) === 200, 'threads: resolve accepts a target');
  check(Boolean((await state(url)).resolved?.[target]), 'threads: state lists resolved targets');
  check((await postResolve(url, { target, resolved: false })) === 200 && !(await state(url)).resolved?.[target], 'threads: a resolved target can be reopened');
  check((await postResolve(url, {}, { origin: 'http://evil.example' })) === 403, 'threads: resolve refuses a foreign origin');
  resetPage(dir);
  await postComments(url, [{ id: 'wa', target, line: 60, text: 'answered before listening' }, { id: 'wb', target, line: 60, text: 'still open' }]);
  replyTo(dir, 'wa', 'done');
  const watcher = spawn(process.execPath, [path.join(here, 'serve.mjs'), 'example', '--dir', dir, '--watch'], { stdio: ['ignore', 'pipe', 'ignore'] });
  let heard = '';
  watcher.stdout.on('data', (chunk) => {
    heard += chunk;
  });
  await waitFor(async () => heard.includes('still open'));
  watcher.kill();
  check(heard.includes('still open') && !heard.includes('answered before listening'), 'watch: a comment answered before the watcher starts is not delivered again');
  const missing = (extra) => spawnSync(process.execPath, [path.join(here, 'serve.mjs'), ...extra], { encoding: 'utf8', timeout: 5000 });
  const noDir = missing(['--pending', '--dir', path.join(dir, 'absent')]);
  const noPage = missing(['absent', '--watch', '--dir', dir]);
  check(noDir.status === 2 && /not found/.test(noDir.stderr) && !fs.existsSync(path.join(dir, 'absent')), `pending: a missing folder is an error, not an empty result (${noDir.status})`);
  check(noPage.status === 2 && /not found: absent/.test(noPage.stderr), `watch: a missing page is an error, not a silent watcher (${noPage.status})`);
  resetPage(dir);
}

export async function checkRemote(dir) {
  const { child, found } = await startServer(dir, { port: '4891', extra: ['--remote', 'tunnel'], until: /remote: (\S+)/ });
  try {
    const page = new URL(found[1]);
    const token = page.searchParams.get('t');
    const base = `http://127.0.0.1:${page.port}${page.pathname}`;
    const host = 'abc.trycloudflare.com';
    const cookie = `explainer_${page.port}=${token}`;
    check(Boolean(token) && token.length >= 32, 'remote: the server prints a URL with a long token');
    check((await request(base, { headers: { host } })) === 403, 'remote: a foreign Host without a token is refused');
    check((await request(`${base}?t=wrong`, { headers: { host } })) === 403, 'remote: a wrong token is refused');
    const entry = await exchange(`${base}?t=${token}`, { headers: { host } });
    const setCookie = String(entry.headers['set-cookie'] ?? '');
    check(entry.status === 302 && setCookie.includes('HttpOnly') && setCookie.includes('SameSite=Lax') && !String(entry.headers.location).includes('t='), 'remote: the token sets a Lax HttpOnly cookie and drops out of the URL');
    check((await request(base, { headers: { host, cookie } })) === 200, 'remote: the cookie opens the page');
    const comments = new URL('comments', base).href;
    const body = JSON.stringify({ comments: [{ id: 'remote-1', target: 'document', text: 'from the phone' }] });
    check((await request(comments, { method: 'POST', headers: { host, cookie, origin: `http://${host}`, 'content-type': 'application/json' }, body })) === 200, 'remote: a same-origin POST with the cookie is accepted');
    check((await request(comments, { method: 'POST', headers: { host, cookie, origin: 'https://evil.example', 'content-type': 'application/json' }, body })) === 403, 'remote: a POST from a foreign origin is refused even with the cookie');
    check((await request(new URL('/health', base).href)) === 200, 'remote: local requests need no token');
    check((await request(new URL('/_update', base).href, { method: 'POST', headers: { host, cookie, origin: `http://${host}`, 'content-type': 'application/json' }, body: '{}' })) === 403, 'remote: a device with the token still cannot install an update');
    const browser = await launch([`--host-resolver-rules=MAP ${host} 127.0.0.1`]);
    try {
      const tab = await browser.newPage();
      await tab.setContent(`<a href="http://${host}:${page.port}${page.pathname}?t=${token}">open</a>`);
      const [landed] = await Promise.all([tab.waitForNavigation(), tab.click('a')]);
      check(landed?.status() === 200 && (await tab.locator('main .box').count()) > 0, 'remote: a link from another site opens the page');
    } finally {
      await browser.close();
    }
  } finally {
    child.kill();
  }
}
