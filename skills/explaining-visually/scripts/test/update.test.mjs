import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { check, startServer, request, waitFor, here } from './harness.mjs';

// A copied install of version 1.0.0 against a fake GitHub that has tagged 9.9.9.
function fakeGithub(skill) {
  const tag = 'explaining-visually-v9.9.9';
  const files = execFileSync('git', ['ls-files'], { cwd: skill, encoding: 'utf8' }).split('\n').filter(Boolean);
  const released = (rel) => {
    const raw = fs.readFileSync(path.join(skill, rel));
    return rel === 'scripts/package.json' ? Buffer.from(String(raw).replace(/"version": "[^"]+"/, '"version": "9.9.9"').replace('rodlandA/claude-workflow-kit', 'o/r')) : raw;
  };
  const routes = {
    '/repos/o/r/git/matching-refs/tags/explaining-visually-v': () => JSON.stringify([{ ref: 'refs/tags/explaining-visually-v0.9.0' }, { ref: `refs/tags/${tag}` }]),
    [`/repos/o/r/git/trees/${tag}`]: () => JSON.stringify({ tree: files.map((f) => ({ type: 'blob', path: `skills/explaining-visually/${f}` })) }),
  };
  files.forEach((f) => {
    routes[`/o/r/${tag}/skills/explaining-visually/${f}`] = () => released(f);
  });
  const server = http.createServer((req, res) => {
    const found = routes[new URL(req.url, 'http://x').pathname];
    res.writeHead(found ? 200 : 404);
    res.end(found ? found() : '');
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

function copiedInstall(home) {
  const skill = path.join(home, '.claude', 'skills', 'explaining-visually');
  fs.cpSync(path.join(here, '..'), skill, { recursive: true, filter: (src) => !src.includes('node_modules') });
  fs.mkdirSync(path.join(skill, 'scripts', 'node_modules'));
  fs.writeFileSync(path.join(skill, 'scripts', 'node_modules', 'marker'), '');
  const pkg = path.join(skill, 'scripts', 'package.json');
  fs.writeFileSync(pkg, fs.readFileSync(pkg, 'utf8').replace(/"version": "[^"]+"/, '"version": "1.0.0"').replace('rodlandA/claude-workflow-kit', 'o/r'));
  return skill;
}

export async function checkUpdate(browser, dir) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'explainer-home-'));
  const skill = copiedInstall(home);
  const github = await fakeGithub(path.join(here, '..'));
  const fake = `http://127.0.0.1:${github.address().port}`;
  const env = { HOME: home, EXPLAINER_GITHUB_API: fake, EXPLAINER_GITHUB_RAW: fake };
  const blocker = http.createServer((req, res) => res.end('busy'));
  await new Promise((done) => blocker.listen(4893, '127.0.0.1', done));
  const { child, url } = await startServer(dir, { port: '4893', scripts: path.join(skill, 'scripts'), env });
  await new Promise((done) => blocker.close(done));
  let restarted = null;
  try {
    check(new URL(url).port === '4894', 'update: with 4893 taken the server moved to 4894, and 4893 is free again before the update');
    const stateUrl = new URL('state', url).href;
    const before = await waitFor(async () => {
      const s = await (await fetch(stateUrl)).json();
      return s.update ? s : null;
    });
    check(before?.version === '1.0.0' && before.update === '9.9.9' && before.canUpdate === true, 'update: the page learns that 9.9.9 is out and may install it');
    const index = await (await fetch(new URL('/', url))).text();
    check(index.includes('explaining-visually 1.0.0 · 9.9.9 available'), 'update: the index shows the version and the newer one');
    check((await request(new URL('/_update', url).href, { method: 'POST', headers: { 'content-type': 'application/json', host: 'attacker.example' }, body: '{}' })) === 403, 'update: a foreign Host cannot trigger an install');
    const oldPid = (await (await fetch(new URL('/health', url))).json()).pid;
    const tab = await browser.newPage();
    await tab.goto(url);
    const button = tab.locator('#update');
    await button.waitFor({ state: 'visible', timeout: 10_000 });
    check((await button.textContent()) === 'v9.9.9 available · Update', 'update: the page shows an Update button');
    await Promise.all([tab.waitForEvent('load', { timeout: 30_000 }), button.click()]);
    const after = await waitFor(async () => {
      const health = await (await fetch(new URL('/health', url))).json();
      return health.pid !== oldPid ? health : null;
    });
    restarted = after?.pid ?? null;
    const state = await (await fetch(stateUrl)).json();
    check(Boolean(after) && state.version === '9.9.9' && !state.update, 'update: a new server on the same port runs 9.9.9 and offers nothing further');
    await tab.waitForTimeout(1500);
    check(await button.isHidden() && (await tab.locator('#status').getAttribute('title')).endsWith('explaining-visually 9.9.9'), 'update: the reloaded page runs 9.9.9 without an Update button');
    const previous = path.join(home, '.claude', 'explainers', '.update', 'previous', 'scripts', 'package.json');
    check(fs.readFileSync(previous, 'utf8').includes('"version": "1.0.0"'), 'update: the previous version is kept outside the skills folder');
    check(fs.existsSync(path.join(skill, 'scripts', 'node_modules', 'marker')) && fs.readdirSync(path.join(home, '.claude', 'skills')).length === 1, 'update: node_modules carries over and no second skill folder appears');
  } finally {
    child.kill();
    if (restarted) {
      process.kill(restarted);
    }
    github.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
}
