#!/usr/bin/env node
// Explainer server, comment watcher and reply writer for every explainer of one repo.
//   node serve.mjs [<slug>] [--root .] [--dir D] [--port 4791] [--no-open]   serve all pages; reuses a running server
//   node serve.mjs [<slug>...] --watch           print each new comment on these pages (default: all) as one line
//   node serve.mjs --pending                     print every comment that has no reply yet, then exit
//   node serve.mjs --reply <id> "<text>"         answer a comment in its page
//   node serve.mjs <slug> --export <out.html>    standalone copy of one page
//   node serve.mjs <slug> --remote tailnet|lan|tunnel   also reachable from another device, behind a token
//   node serve.mjs ... --no-update-check        never ask GitHub for a newer version of this skill
// <slug> is a page name or a path to its .body.html. D defaults to ~/.claude/explainers/<repo dir name>.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const VALUED = ['--port', '--export', '--root', '--dir', '--reply', '--remote'];
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));

const HEARTBEAT_MS = 2000;
const IDLE_EXIT_MS = 4 * 60 * 60 * 1000;
const UPDATE_CHECK_MS = 60 * 60 * 1000;
const SKILL_DIR = path.dirname(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))));
const GITHUB_API = process.env.EXPLAINER_GITHUB_API ?? 'https://api.github.com';
const GITHUB_RAW = process.env.EXPLAINER_GITHUB_RAW ?? 'https://raw.githubusercontent.com';
const SLUG = /^[\w.-]+$/;

const gitTop = () => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const targetFile = positional.find((p) => p.endsWith('.html')) ? path.resolve(positional.find((p) => p.endsWith('.html'))) : null;
const toSlug = (p) => path.basename(p).replace(/\.body\.html$/, '');
const named = flag('reply') ? [] : positional.map(toSlug);
const repo = gitTop();
const root = path.resolve(option('root', repo ?? process.cwd()));
const dir = path.resolve(option('dir', targetFile ? path.dirname(targetFile) : path.join(os.homedir(), '.claude', 'explainers', repo ? path.basename(root) : 'misc')));
const targetSlug = named[0] ?? null;
const heartbeat = (slug) => path.join(dir, slug ? `${slug}.watching` : '.watching');

const sidecar = (slug, ext) => path.join(dir, `${slug}.${ext}`);
const bodyOf = (slug) => sidecar(slug, 'body.html');
const slugs = () => (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => f.endsWith('.body.html')).map((f) => f.replace(/\.body\.html$/, '')).filter((slug) => SLUG.test(slug)).sort().reverse();
const isPage = (slug) => SLUG.test(slug ?? '') && fs.existsSync(bodyOf(slug));

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

const readComments = (slug) => {
  const file = sidecar(slug, 'comments.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => readJsonText(l)).filter(Boolean) : [];
};

// Every field stays on one line, so a comment can never print a second, forged event.
const flat = (v) => String(v ?? '').replace(/\s*[\r\n]+\s*/g, ' ⏎ ');

const oneLine = (slug, c) => {
  const id = flat(c.id);
  const line = Number(c.line) || '?';
  if (c.kind === 'approve') {
    return `[${slug}] APPROVE ${id} :: the user approved the plan as the page showed it`;
  }
  if (c.kind === 'answer') {
    const answer = [c.choice, c.text].filter(Boolean).map(flat).join(' — ');
    return `[${slug}] ANSWER ${id} L${line} [#${flat(c.qid)}] "${flat(c.quote).replace(/\s+/g, ' ')}" :: ${answer}`;
  }
  const kind = c.kind === 'expand' ? 'EXPAND' : 'COMMENT';
  const where = c.target === 'document' ? 'GENERAL' : `L${line} [${flat(c.target)}]`;
  const quote = c.quote ? ` "${flat(c.quote).replace(/\s+/g, ' ')}"` : '';
  const text = c.text ? flat(c.text) : '(no question)';
  return `[${slug}] ${kind} ${id} ${where}${quote} :: ${text}`;
};

function reply(id, text) {
  const slug = slugs().find((s) => readComments(s).some((c) => c.id === id));
  if (!slug || !text) {
    console.error(`no comment ${id} in ${dir}, or no reply text`);
    process.exit(2);
  }
  const file = sidecar(slug, 'replies.json');
  const replies = readJson(file, {});
  replies[id] = { text, at: new Date().toISOString(), changed: attributeReply(slug) };
  fs.writeFileSync(file, JSON.stringify(replies, null, 2));
  console.log(`replied to ${id} in ${slug}`);
}

const snapshotOf = (slug) => sidecar(slug, 'replied.html');

function keepSnapshot(slug) {
  if (!fs.existsSync(snapshotOf(slug))) {
    fs.copyFileSync(bodyOf(slug), snapshotOf(slug));
  }
}

// The body as of the last reply: every line that changed since belongs to this reply.
function attributeReply(slug) {
  const current = fs.readFileSync(bodyOf(slug), 'utf8');
  const previous = fs.existsSync(snapshotOf(slug)) ? fs.readFileSync(snapshotOf(slug), 'utf8') : current;
  fs.writeFileSync(snapshotOf(slug), current);
  const lines = current.split('\n');
  return changedLines(previous, current).map((n) => lines[n - 1]);
}

// Lines are stored by content, so they still point at the right place after later edits move them.
function locateLines(body, texts) {
  const at = new Map();
  body.split('\n').forEach((line, i) => at.set(line, [...(at.get(line) ?? []), i + 1]));
  return texts.flatMap((text) => at.get(text)?.shift() ?? []);
}

const replyView = (r, body) => (r ? { text: r.text, at: r.at, lines: locateLines(body, r.changed ?? []) } : null);

function pending() {
  const lines = slugs().flatMap((slug) => {
    const replies = readJson(sidecar(slug, 'replies.json'), {});
    return readComments(slug).filter((c) => !replies[c.id]).map((c) => oneLine(slug, c));
  });
  console.log(lines.length ? lines.join('\n') : `no unanswered comments in ${dir}`);
}

function watch() {
  const watched = () => (named.length ? named.filter(isPage) : slugs());
  const beats = named.length ? named.map(heartbeat) : [heartbeat(null)];
  const tick = () => {
    watched().forEach((slug) => {
      const all = readComments(slug);
      const cursor = sidecar(slug, 'cursor');
      const seen = Number(readJson(cursor, 0));
      all.slice(seen).forEach((c) => console.log(oneLine(slug, c)));
      if (all.length > seen) {
        fs.writeFileSync(cursor, String(all.length));
      }
    });
  };
  const beat = () => beats.forEach((file) => fs.writeFileSync(file, String(Date.now())));
  const stop = () => {
    beats.forEach((file) => fs.rmSync(file, { force: true }));
    process.exit(0);
  };
  ['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((sig) => process.on(sig, stop));
  fs.mkdirSync(dir, { recursive: true });
  tick();
  beat();
  setInterval(tick, 500);
  setInterval(beat, HEARTBEAT_MS);
}

function exportPage(out) {
  if (!isPage(targetSlug)) {
    console.error(`no page ${targetSlug} in ${dir}`);
    process.exit(2);
  }
  // A standalone copy has no server behind it, so the fonts travel inside it.
  const inlineFont = (_, file) => `url("data:font/woff2;base64,${fs.readFileSync(new URL(`./fonts/${file}`, import.meta.url)).toString('base64')}")`;
  const page = render(targetSlug, fs.readFileSync(bodyOf(targetSlug), 'utf8')).replace(/url\("\/_fonts\/([\w-]+\.woff2)"\)/g, inlineFont);
  fs.writeFileSync(out, page);
  console.log(`exported ${out}`);
}

function withSourceLines(body) {
  return body
    .split('\n')
    .map((line, i) => line.replace(/<([a-zA-Z][\w-]*)(?=[\s>/])/g, `<$1 data-line="${i + 1}"`))
    .join('\n');
}

const titleOf = (slug, body) => {
  const h1 = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : slug;
};

function render(slug, body) {
  return fs
    .readFileSync(new URL('./shell.html', import.meta.url), 'utf8')
    .replace('{{TITLE}}', () => titleOf(slug, body).replace(/[<&]/g, ''))
    .replace('{{DOC}}', () => slug)
    .replace('{{VERSION}}', () => String(fs.statSync(bodyOf(slug)).mtimeMs))
    .replace('{{BODY}}', () => withSourceLines(body));
}

const escapeHtml = (s) => s.replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]);

function renderIndex(updates) {
  const rows = slugs().map((slug) => {
    const body = fs.readFileSync(bodyOf(slug), 'utf8');
    const mode = body.match(/<h1[^>]*data-mode="([\w-]+)"/)?.[1] ?? '';
    const replies = readJson(sidecar(slug, 'replies.json'), {});
    const comments = readComments(slug);
    const waiting = comments.filter((c) => !replies[c.id]).length;
    const v = String(fs.statSync(bodyOf(slug)).mtimeMs);
    const approved = comments.some((c) => c.kind === 'approve' && c.version === v);
    const chips = [mode && `<span class="mode">${escapeHtml(mode)}</span>`, approved && '<span class="ok">approved</span>', waiting && `<span class="wait">${waiting} waiting</span>`].filter(Boolean).join('');
    return `<a href="${slug}/"><b>${escapeHtml(titleOf(slug, body))}</b><small>${escapeHtml(slug)}</small><span class="chips">${chips}</span></a>`;
  });
  return fs
    .readFileSync(new URL('./index.html', import.meta.url), 'utf8')
    .replaceAll('{{REPO}}', () => escapeHtml(path.basename(dir)))
    .replace('{{ROWS}}', () => rows.join('\n') || '<p class="empty">No explainers yet.</p>')
    .replace('{{VERSION}}', () => escapeHtml(versionLine(updates)));
}

function versionLine(updates) {
  const current = `explaining-visually ${updates.version ?? '(unknown version)'}`;
  const latest = updates.available();
  return latest ? `${current} · ${latest} available, update from any page` : current;
}

// Lines of the current body that did not exist in the previous version, by content.
function changedLines(prev, next) {
  const pool = new Map();
  prev.split('\n').forEach((l) => pool.set(l, (pool.get(l) ?? 0) + 1));
  const changed = [];
  next.split('\n').forEach((l, i) => {
    if (pool.get(l)) {
      pool.set(l, pool.get(l) - 1);
    } else if (l.trim()) {
      changed.push(i + 1);
    }
  });
  return changed;
}

// Resolves a `file:line` reference from the page against the repo: exact path first, then a unique-enough suffix.
function codeFinder() {
  let tracked = null;
  const listFiles = () => {
    try {
      return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
    } catch {
      return [];
    }
  };
  const realRoot = fs.realpathSync(root);
  // realpath, so a symlink inside the repo cannot lead a reference out of it.
  const isFile = (rel) => {
    const abs = path.resolve(root, rel);
    if (!fs.existsSync(abs)) {
      return false;
    }
    const real = fs.realpathSync(abs);
    return real.startsWith(realRoot + path.sep) && fs.statSync(real).isFile();
  };
  const resolve = (file) => {
    if (isFile(file)) {
      return [path.normalize(file)];
    }
    tracked ??= listFiles();
    let hits = tracked.filter((f) => f.endsWith(`/${file}`));
    if (!hits.length) {
      tracked = listFiles();
      hits = tracked.filter((f) => f.endsWith(`/${file}`));
    }
    return hits.filter(isFile);
  };
  const snippet = (rel, from, to) => {
    const lines = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
    const focus = Math.min(from ?? 1, lines.length);
    const start = Math.max(1, focus - 6);
    const end = Math.min(lines.length, Math.max(to ?? focus, focus) + 18);
    return { path: rel, abs: path.join(root, rel), from, to: to ?? from, start, lines: lines.slice(start - 1, end) };
  };
  return (ref) => {
    const m = ref.match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/) ?? [];
    const from = m[2] ? Number(m[2]) : null;
    const to = m[3] ? Number(m[3]) : null;
    const hits = resolve(m[1]);
    return { ref, total: hits.length, matches: hits.slice(0, 3).map((rel) => snippet(rel, from, to)) };
  };
}

function pageStore() {
  const refresh = (slug) => ({ current: fs.readFileSync(bodyOf(slug), 'utf8') });
  const fresh = (file) => {
    try {
      return Date.now() - fs.statSync(file).mtimeMs < HEARTBEAT_MS * 3;
    } catch {
      return false;
    }
  };
  const isWatched = (slug) => fresh(heartbeat(slug)) || fresh(heartbeat(null));
  const state = (slug) => {
    const { current } = refresh(slug);
    const replies = readJson(sidecar(slug, 'replies.json'), {});
    return {
      v: String(fs.statSync(bodyOf(slug)).mtimeMs),
      listening: isWatched(slug),
      sent: readComments(slug).map((c) => ({ ...c, reply: replyView(replies[c.id], current) })),
      resolved: readJson(sidecar(slug, 'resolved.json'), {}),
    };
  };
  return { refresh, state };
}

const semver = (v) => String(v ?? '').split('.').map(Number);

function isNewer(candidate, current) {
  const [a, b] = [semver(candidate), semver(current)];
  const i = [0, 1, 2].find((n) => a[n] !== b[n]);
  return i !== undefined && a[i] > b[i];
}

// Releases are tags named <skill>-v<x.y.z> in the repository package.json points at.
function releaseSource() {
  const pkg = readJson(path.join(SKILL_DIR, 'scripts', 'package.json'), {});
  const repo = pkg.repository?.url?.match(/github\.com\/([^/]+\/[^/.]+)/)?.[1];
  const subdir = pkg.repository?.directory;
  if (!pkg.version || !repo || !subdir) {
    return null;
  }
  return { version: pkg.version, repo, subdir, prefix: `${path.basename(subdir)}-v` };
}

async function github(url) {
  const res = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'explaining-visually' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    throw new Error(`${res.status} from ${new URL(url).host}`);
  }
  return res;
}

async function latestRelease(src) {
  const refs = await (await github(`${GITHUB_API}/repos/${src.repo}/git/matching-refs/tags/${src.prefix}`)).json();
  const versions = refs.map((r) => r.ref.slice(`refs/tags/${src.prefix}`.length)).filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  return versions.reduce((best, v) => (isNewer(v, best ?? '0.0.0') ? v : best), null);
}

const gitTopOf = (dir) => {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

// A git checkout is the user's own repo: fast-forward its default branch, never anything else.
function pullCheckout(top) {
  const git = (...a) => execFileSync('git', ['-C', top, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const branch = git('branch', '--show-current');
  const main = readDefaultBranch(git);
  if (branch !== main) {
    return { ok: false, error: `${top} is on ${branch || 'a detached HEAD'}: switch to ${main} and run git pull` };
  }
  try {
    git('pull', '--ff-only');
    return { ok: true };
  } catch {
    return { ok: false, error: `git pull --ff-only failed in ${top}: pull it yourself` };
  }
}

function readDefaultBranch(git) {
  try {
    return git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD').replace(/^origin\//, '');
  } catch {
    return 'main';
  }
}

// Staging and the previous copy live outside ~/.claude/skills, or Claude Code would load them as skills.
async function replaceFiles(src, tag) {
  const base = path.join(os.homedir(), '.claude', 'explainers', '.update');
  const staging = path.join(base, 'next');
  const previous = path.join(base, 'previous');
  fs.rmSync(staging, { recursive: true, force: true });
  const tree = await (await github(`${GITHUB_API}/repos/${src.repo}/git/trees/${tag}?recursive=1`)).json();
  const files = (tree.tree ?? []).filter((e) => e.type === 'blob' && e.path.startsWith(`${src.subdir}/`));
  for (const file of files) {
    const out = path.resolve(staging, file.path.slice(src.subdir.length + 1));
    if (!out.startsWith(staging + path.sep)) {
      throw new Error(`refusing ${file.path}`);
    }
    const res = await github(`${GITHUB_RAW}/${src.repo}/${tag}/${file.path}`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  }
  if (!fs.existsSync(path.join(staging, 'SKILL.md')) || !fs.existsSync(path.join(staging, 'scripts', 'serve.mjs'))) {
    throw new Error(`${tag} does not contain this skill`);
  }
  const modules = path.join(SKILL_DIR, 'scripts', 'node_modules');
  if (fs.existsSync(modules)) {
    fs.renameSync(modules, path.join(staging, 'scripts', 'node_modules'));
  }
  fs.rmSync(previous, { recursive: true, force: true });
  fs.renameSync(SKILL_DIR, previous);
  try {
    fs.renameSync(staging, SKILL_DIR);
  } catch (err) {
    fs.renameSync(previous, SKILL_DIR);
    throw err;
  }
  return { ok: true };
}

function updater() {
  const src = releaseSource();
  const off = flag('no-update-check') || process.env.EXPLAINER_NO_UPDATE_CHECK === '1' || !src;
  let latest = null;
  let busy = false;
  const check = async () => {
    try {
      latest = await latestRelease(src);
    } catch {
      latest = null;
    }
  };
  if (!off) {
    check();
    setInterval(check, UPDATE_CHECK_MS).unref();
  }
  const available = () => (latest && src && isNewer(latest, src.version) ? latest : null);
  const install = async () => {
    if (!available() || busy) {
      return { ok: false, error: 'no update to install' };
    }
    busy = true;
    const top = gitTopOf(SKILL_DIR);
    const attempt = async () => (top ? pullCheckout(top) : replaceFiles(src, `${src.prefix}${latest}`));
    const result = await attempt().catch((err) => ({ ok: false, error: err.message }));
    busy = result.ok;
    return result;
  };
  return { version: src?.version ?? null, available, install };
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const CGNAT = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./;

function lanAddress() {
  const all = Object.values(os.networkInterfaces()).flat();
  return all.find((a) => a.family === 'IPv4' && !a.internal && !CGNAT.test(a.address))?.address ?? null;
}

function tailnetAddress() {
  try {
    return execFileSync('tailscale', ['ip', '-4'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')[0].trim() || null;
  } catch {
    return null;
  }
}

// A tunnel connects to 127.0.0.1 itself, so it needs no listener of its own: only the token.
function remoteListenAddress(mode) {
  const resolvers = { tailnet: tailnetAddress, lan: lanAddress, tunnel: () => null };
  if (!resolvers[mode]) {
    console.error(`--remote takes tailnet, lan or tunnel, not ${mode}`);
    process.exit(2);
  }
  const address = resolvers[mode]();
  if (mode !== 'tunnel' && !address) {
    console.error(`no ${mode} address found on this machine`);
    process.exit(2);
  }
  return address;
}

function serve() {
  const findCode = codeFinder();
  const remoteMode = option('remote');
  const remoteHost = remoteMode ? remoteListenAddress(remoteMode) : null;
  const token = remoteMode ? process.env.EXPLAINER_TOKEN || crypto.randomBytes(24).toString('base64url') : null;
  const store = pageStore();
  const updates = updater();
  const polledAt = {};
  let lastPoll = Date.now();

  const json = (res, data, status = 200) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  const html = (res, body) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
  };
  const readBody = (req, res, use) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        json(res, use(JSON.parse(raw)));
      } catch (err) {
        json(res, { ok: false, error: String(err) }, 400);
      }
    });
  };
  const receive = (slug, req, res) => readBody(req, res, (data) => {
    const sentAt = new Date().toISOString();
    const lines = (data.comments ?? []).map((c) => JSON.stringify({ sentAt, ...c }));
    keepSnapshot(slug);
    fs.appendFileSync(sidecar(slug, 'comments.jsonl'), `${lines.join('\n')}\n`);
    return { ok: true, count: lines.length };
  });
  const resolveThread = (slug, req, res) => readBody(req, res, ({ target, resolved }) => {
    if (typeof target !== 'string' || !target) {
      throw new Error('target is required');
    }
    const file = sidecar(slug, 'resolved.json');
    const all = readJson(file, {});
    if (resolved) {
      all[target] = new Date().toISOString();
    } else {
      delete all[target];
    }
    fs.writeFileSync(file, JSON.stringify(all, null, 2));
    return { ok: true };
  });

  const routePage = (slug, rest, req, res) => {
    if (rest === '' && req.method === 'GET') {
      res.writeHead(301, { location: `/${slug}/` });
      res.end();
      return;
    }
    if (rest === '/' && req.method === 'GET') {
      html(res, render(slug, store.refresh(slug).current));
      return;
    }
    if (rest === '/state' && req.method === 'GET') {
      lastPoll = Date.now();
      polledAt[slug] = lastPoll;
      json(res, { ...store.state(slug), version: updates.version, update: updates.available(), canUpdate: isLocal(req) });
      return;
    }
    if (rest === '/comments' && req.method === 'POST') {
      receive(slug, req, res);
      return;
    }
    if (rest === '/resolve' && req.method === 'POST') {
      resolveThread(slug, req, res);
      return;
    }
    res.writeHead(404);
    res.end();
  };

  const route = (req, res) => {
    const { pathname, searchParams } = new URL(req.url, 'http://x');
    if (pathname === '/') {
      html(res, renderIndex(updates));
      return;
    }
    if (pathname === '/health') {
      json(res, { dir, root, polledAt, pid: process.pid, remote: token && isLocal(req) ? { host: remoteHost, token } : null });
      return;
    }
    if (pathname === '/_update' && req.method === 'POST') {
      installUpdate(req, res);
      return;
    }
    const font = pathname.match(/^\/_fonts\/([\w-]+\.woff2)$/)?.[1];
    if (font && fs.existsSync(new URL(`./fonts/${font}`, import.meta.url))) {
      res.writeHead(200, { 'content-type': 'font/woff2', 'cache-control': 'max-age=86400' });
      res.end(fs.readFileSync(new URL(`./fonts/${font}`, import.meta.url)));
      return;
    }
    if (pathname === '/code') {
      const ref = searchParams.get('ref');
      if (!ref) {
        json(res, { ok: false, error: 'ref is required' }, 400);
        return;
      }
      json(res, findCode(ref));
      return;
    }
    const [, slug, rest] = pathname.match(/^\/([^/]+)(\/.*)?$/) ?? [];
    if (isPage(slug)) {
      routePage(slug, rest ?? '', req, res);
      return;
    }
    res.writeHead(404);
    res.end();
  };

  const ownHosts = (req) => [`127.0.0.1:${req.socket.localPort}`, `localhost:${req.socket.localPort}`];
  const isLocal = (req) => LOOPBACK.has(req.socket.remoteAddress) && ownHosts(req).includes(req.headers.host);
  const cookieName = (req) => `explainer_${req.socket.localPort}`;
  const tokenIn = (req) => {
    const cookies = Object.fromEntries((req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')));
    return cookies[cookieName(req)] ?? new URL(req.url, 'http://x').searchParams.get('t');
  };
  const hasToken = (req) => Boolean(token) && tokenIn(req) === token;

  // Only this machine's own pages, or a device holding the --remote token, may talk to the server:
  // a foreign Host is DNS rebinding, a foreign Origin a forged comment.
  const refusal = (req) => {
    const local = isLocal(req);
    if (!local && !hasToken(req)) {
      return 'unknown host';
    }
    if (req.method !== 'POST') {
      return null;
    }
    const origin = req.headers.origin;
    const allowed = local ? ownHosts(req) : [req.headers.host];
    if (origin && !allowed.some((h) => origin === `http://${h}`)) {
      return 'foreign origin';
    }
    return (req.headers['content-type'] ?? '').startsWith('application/json') ? null : 'not json';
  };

  const enterWithToken = (req, res) => {
    const url = new URL(req.url, 'http://x');
    url.searchParams.delete('t');
    res.writeHead(302, {
      // Lax, not Strict: a link opened from another app is a cross-site navigation, and Strict drops the cookie on this very redirect.
      'set-cookie': `${cookieName(req)}=${token}; HttpOnly; SameSite=Lax; Path=/`,
      location: url.pathname + url.search,
    });
    res.end();
  };

  const handle = (req, res) => {
    const refused = refusal(req);
    if (refused) {
      json(res, { ok: false, error: refused }, 403);
      return;
    }
    if (token && req.method === 'GET' && new URL(req.url, 'http://x').searchParams.get('t') === token) {
      enterWithToken(req, res);
      return;
    }
    try {
      route(req, res);
    } catch (err) {
      console.error(`explainer: ${req.method} ${req.url} failed: ${err.message}`);
      if (!res.headersSent) {
        json(res, { ok: false, error: 'server error' }, 500);
      }
    }
  };
  const server = http.createServer(handle);
  const remoteServer = remoteHost ? http.createServer(handle) : null;

  // The running process still holds the old code, so it hands its port and token to a fresh one.
  const restart = () => {
    const port = String(server.address().port);
    const servers = [server, remoteServer].filter(Boolean);
    let open = servers.length;
    const relaunch = () => {
      open -= 1;
      if (open > 0) {
        return;
      }
      const kept = args.filter((a, i) => a !== '--no-open' && a !== '--port' && args[i - 1] !== '--port');
      const again = [...kept, '--port', port, '--no-open'];
      spawn(process.execPath, [process.argv[1], ...again], { detached: true, stdio: 'ignore', env: { ...process.env, EXPLAINER_TOKEN: token ?? '' } }).unref();
      process.exit(0);
    };
    servers.forEach((s) => {
      s.close(relaunch);
      s.closeAllConnections();
    });
  };

  const installUpdate = async (req, res) => {
    if (!isLocal(req)) {
      json(res, { ok: false, error: 'update from the computer that runs the server' }, 403);
      return;
    }
    const result = await updates.install();
    if (result.ok) {
      res.on('finish', restart);
    }
    json(res, result);
  };

  const announceRemote = (port, remote) => {
    const page = isPage(targetSlug) ? `${targetSlug}/` : '';
    const note = remote.host ? '' : `  (point your tunnel at 127.0.0.1:${port})`;
    console.log(`remote: http://${remote.host ?? '127.0.0.1'}:${port}/${page}?t=${remote.token}${note}`);
  };

  const announce = (port, polled, remote) => {
    const base = `http://127.0.0.1:${port}/`;
    const url = isPage(targetSlug) ? `${base}${targetSlug}/` : base;
    console.log(`explainer: ${url}  (pages in ${dir}, code from ${root})`);
    if (remote) {
      announceRemote(port, remote);
      return;
    }
    // An already-open tab polls and reloads by itself; only open a new one if none has.
    setTimeout(() => {
      if (!polled() && !flag('no-open')) {
        const cmd = { darwin: 'open', win32: 'explorer' }[process.platform] ?? 'xdg-open';
        execFile(cmd, [url], () => {});
      }
    }, 3500);
  };

  const listen = async (port, attemptsLeft) => {
    const running = await probe(port);
    const sameRemote = !remoteMode || (running?.remote && running.remote.host === remoteHost);
    if (running?.dir === dir && running.root === root && sameRemote) {
      announce(port, () => Date.now() - (running.polledAt[targetSlug] ?? 0) < 10_000, remoteMode ? running.remote : null);
      setTimeout(() => process.exit(0), 3600);
      return;
    }
    if (running && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    const polled = () => (isPage(targetSlug) ? Boolean(polledAt[targetSlug]) : Object.keys(polledAt).length > 0);
    const onListening = () => {
      if (!remoteServer) {
        announce(port, polled, token ? { host: null, token } : null);
        return;
      }
      remoteServer.listen(port, remoteHost, () => announce(port, polled, { host: remoteHost, token }));
    };
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
        // A failed listen keeps its callback registered, and it would announce the busy port too.
        server.off('listening', onListening);
        listen(port + 1, attemptsLeft - 1);
        return;
      }
      throw err;
    });
    server.listen(port, '127.0.0.1', onListening);
  };

  setInterval(() => {
    if (Date.now() - lastPoll > IDLE_EXIT_MS) {
      console.log('no tab open for 4 hours, stopping');
      process.exit(0);
    }
  }, 60_000);

  fs.mkdirSync(dir, { recursive: true });
  listen(Number(option('port', 4791)), 20);
}

function probe(port) {
  return new Promise((done) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 800 }, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => done(readJsonText(raw)));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => done(null));
  });
}

function readJsonText(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

if (flag('reply')) {
  reply(option('reply'), args[args.indexOf('--reply') + 2]);
} else if (flag('pending')) {
  pending();
} else if (flag('watch')) {
  watch();
} else if (option('export')) {
  exportPage(option('export'));
} else {
  serve();
}
