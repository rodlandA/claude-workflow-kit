#!/usr/bin/env node
// Explainer server, comment watcher and reply writer for every explainer of one repo.
//   node serve.mjs [<slug>] [--root .] [--dir D] [--port 4791] [--no-open]   serve all pages; reuses a running server
//   node serve.mjs [<slug>...] --watch           print each new comment on these pages (default: all) as one line
//   node serve.mjs --pending                     print every comment that has no reply yet, then exit
//   node serve.mjs --reply <id> "<text>"         answer a comment in its page
//   node serve.mjs <slug> --export <out.html>    standalone copy of one page
// <slug> is a page name or a path to its .body.html. D defaults to ~/.claude/explainers/<repo dir name>.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const VALUED = ['--port', '--export', '--root', '--dir', '--reply'];
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));

const HEARTBEAT_MS = 2000;
const IDLE_EXIT_MS = 4 * 60 * 60 * 1000;
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
  replies[id] = { text, at: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(replies, null, 2));
  console.log(`replied to ${id} in ${slug}`);
}

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

function renderIndex() {
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
    .replace('{{ROWS}}', () => rows.join('\n') || '<p class="empty">No explainers yet.</p>');
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
  const pages = new Map();
  const refresh = (slug) => {
    const page = pages.get(slug) ?? { versions: new Map(), current: '' };
    page.current = fs.readFileSync(bodyOf(slug), 'utf8');
    page.versions.set(String(fs.statSync(bodyOf(slug)).mtimeMs), page.current);
    pages.set(slug, page);
    return page;
  };
  const fresh = (file) => {
    try {
      return Date.now() - fs.statSync(file).mtimeMs < HEARTBEAT_MS * 3;
    } catch {
      return false;
    }
  };
  const isWatched = (slug) => fresh(heartbeat(slug)) || fresh(heartbeat(null));
  // Changed lines are relative to the version the tab last showed, however many saves ago.
  const state = (slug, since) => {
    const page = refresh(slug);
    const replies = readJson(sidecar(slug, 'replies.json'), {});
    return {
      v: String(fs.statSync(bodyOf(slug)).mtimeMs),
      listening: isWatched(slug),
      changed: page.versions.has(since) ? changedLines(page.versions.get(since), page.current) : [],
      sent: readComments(slug).map((c) => ({ ...c, reply: replies[c.id] ?? null })),
    };
  };
  return { refresh, state };
}

function serve() {
  const findCode = codeFinder();
  const store = pageStore();
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
  const receive = (slug, req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const sentAt = new Date().toISOString();
        const lines = (JSON.parse(raw).comments ?? []).map((c) => JSON.stringify({ sentAt, ...c }));
        fs.appendFileSync(sidecar(slug, 'comments.jsonl'), `${lines.join('\n')}\n`);
        json(res, { ok: true, count: lines.length });
      } catch (err) {
        json(res, { ok: false, error: String(err) }, 400);
      }
    });
  };

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
      json(res, store.state(slug, new URL(req.url, 'http://x').searchParams.get('since')));
      return;
    }
    if (rest === '/comments' && req.method === 'POST') {
      receive(slug, req, res);
      return;
    }
    res.writeHead(404);
    res.end();
  };

  const route = (req, res) => {
    const { pathname, searchParams } = new URL(req.url, 'http://x');
    if (pathname === '/') {
      html(res, renderIndex());
      return;
    }
    if (pathname === '/health') {
      json(res, { dir, root, polledAt });
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

  // Only this machine's own pages may talk to the server: a foreign Host is DNS rebinding, a foreign Origin a forged comment.
  const refusal = (req) => {
    const port = server.address()?.port;
    const own = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!own.includes(req.headers.host)) {
      return 'unknown host';
    }
    if (req.method !== 'POST') {
      return null;
    }
    const origin = req.headers.origin;
    if (origin && !own.some((h) => origin === `http://${h}`)) {
      return 'foreign origin';
    }
    return (req.headers['content-type'] ?? '').startsWith('application/json') ? null : 'not json';
  };

  const server = http.createServer((req, res) => {
    const refused = refusal(req);
    if (refused) {
      json(res, { ok: false, error: refused }, 403);
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
  });

  const announce = (port, polled) => {
    const base = `http://127.0.0.1:${port}/`;
    const url = isPage(targetSlug) ? `${base}${targetSlug}/` : base;
    console.log(`explainer: ${url}  (pages in ${dir}, code from ${root})`);
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
    if (running?.dir === dir && running.root === root) {
      announce(port, () => Date.now() - (running.polledAt[targetSlug] ?? 0) < 10_000);
      setTimeout(() => process.exit(0), 3600);
      return;
    }
    if (running && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
        listen(port + 1, attemptsLeft - 1);
        return;
      }
      throw err;
    });
    server.listen(port, '127.0.0.1', () => {
      announce(port, () => (isPage(targetSlug) ? Boolean(polledAt[targetSlug]) : Object.keys(polledAt).length > 0));
    });
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
