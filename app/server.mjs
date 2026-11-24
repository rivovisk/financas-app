// Finanças: a personal finance app that only reads. node server.mjs (Node 20 or newer, no packages).
// Binds to 127.0.0.1 only; `tailscale serve` is what puts it on a private network.
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { APP, DATA, PORT, NAMES, keys, now, saveKeys } from './lib/config.mjs';
import { addRule, job, refresh, restoreRule, state, tick, undoRule } from './lib/brain.mjs';
import { apply, lastSwap, look, up } from './lib/update.mjs';
import { answer } from './lib/proof.mjs';
import { ownerAuth } from './lib/owner.mjs';
import { today } from './web/core/format.mjs';

const WEB = join(APP, 'web');
const owner = ownerAuth(DATA);
const FILES = new Set(['app.mjs', 'screens.mjs', 'boot.js', 'style.css', 'theme.css', 'icon.svg', 'fonts/outfit.woff2', 'fonts/figtree.woff2', ...['categories', 'format', 'classify', 'views', 'balls'].map((n) => 'core/' + n + '.mjs')]);
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

// settings.json in the data folder: hosts this app may be opened as, and pages that may frame it.
const hosts = () => new Set(['localhost', '127.0.0.1', ...(state.settings.hosts ?? [])]);
const frames = () => ["'self'", ...(state.settings.frames ?? [])].join(' ');

function headers(type) {
  return {
    'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors ${frames()}`,
  };
}
function send(req, res, code, type, body) {
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const h = headers(type);
  if (type.startsWith('application/json')) h['Cache-Control'] = 'no-store';
  else if (code === 200) {
    h.ETag = '"' + createHash('sha1').update(buf).digest('hex').slice(0, 20) + '"';
    if (req.headers['if-none-match'] === h.ETag) {
      res.writeHead(304, h);
      return res.end();
    }
  }
  if (!type.startsWith('font') && buf.length > 1400 && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    buf = gzipSync(buf);
    h['Content-Encoding'] = 'gzip';
  }
  h.Vary = 'Accept-Encoding';
  h['Content-Length'] = buf.length;
  res.writeHead(code, h);
  res.end(req.method === 'HEAD' ? undefined : buf);
}
const json = (req, res, obj, code = 200) => send(req, res, code, 'application/json; charset=utf-8', JSON.stringify(obj));

// tailscale serve adds these headers; a request without them, asking for this computer by its own name, came from it.
const isHere = (req) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '') && !req.headers['x-forwarded-for'] && !req.headers['tailscale-user-login'] && !req.headers['x-forwarded-host'];

const upState = () => { const s = lastSwap(); return { ...up, undone: up.version && s?.ok === false ? s.version : null }; };
function snapshot(req) {
  const d = state.data;
  return {
    today: today(now()), now: new Date(now()).toISOString(), hasKeys: !!keys(), here: isHere(req),
    version: up.version, up: upState(), job: { ...job }, sync: state.sync, readAt: d.readAt, items: d.items, accounts: d.accounts, bills: d.bills, investments: d.investments,
    entries: d.entries, rules: state.rules.rules, undone: state.rules.undone, photos: state.wealth.photos,
  };
}

function body(req) {
  return new Promise((ok, no) => {
    let s = '';
    req.on('data', (c) => {
      s += c;
      if (s.length > 20000) {
        req.removeAllListeners('data').resume(); // the rest is thrown away, not kept
        no(new Error('large'));
      }
    });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch { no(new Error('json')); } });
    req.on('error', no);
  });
}

async function post(req, res, path) {
  // A page of another site can send a form to a local port, but not this content type nor this origin.
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return json(req, res, { error: 'origin' }, 403);
  if (!/^application\/json\b/.test(req.headers['content-type'] ?? '')) return json(req, res, { error: 'type' }, 415);
  const b = await body(req);
  if (path === '/api/owner/setup' || path === '/api/owner/login') {
    const first = path.endsWith('/setup');
    if (first && !isHere(req)) return json(req, res, { error: 'here' }, 403);
    const { status, ...result } = await owner.enter(req, b, first);
    return json(req, res, result, status);
  }
  if (path === '/api/owner/logout') {
    owner.leave(req);
    return json(req, res, { ok: true });
  }
  if (path === '/api/refresh') {
    if (!up.running) refresh(); // an update keeps a copy of the data: nothing changes it meanwhile
    return json(req, res, { job });
  }
  if (path === '/api/rules') {
    const rule = addRule(b);
    return rule ? json(req, res, { rule }) : json(req, res, { error: 'rule' }, 400);
  }
  if (path === '/api/rules/undo' || path === '/api/rules/restore') {
    const rule = path.endsWith('undo') ? undoRule(b.id) : restoreRule(b.id);
    return rule ? json(req, res, { rule }) : json(req, res, { error: 'rule' }, 404);
  }
  if (path === '/api/update') {
    if (!isHere(req)) return json(req, res, { error: 'here' }, 403);
    if (job.running || up.running) return json(req, res, { error: 'busy' }, 409);
    if (!up.next) return json(req, res, { error: 'none' }, 404);
    apply(close);
    return json(req, res, { up: upState() });
  }
  if (path === '/api/connect') {
    if (!isHere(req)) return json(req, res, { error: 'here' }, 403); // keys are typed only on this computer
    if (job.running || up.running) return json(req, res, { error: 'busy' }, 409); // or keys nobody checked would be saved
    const v = { PLUGGY_CLIENT_ID: b.id, PLUGGY_CLIENT_SECRET: b.secret, PLUGGY_ITEM_ID: b.item };
    if (NAMES.some((n) => typeof v[n] !== 'string' || !/^[A-Za-z0-9._,\- ]{8,400}$/.test(v[n].trim()))) return json(req, res, { error: 'keys' }, 400);
    for (const n of NAMES) v[n] = v[n].trim();
    // The keys are saved only after Pluggy accepts them.
    refresh({ id: v.PLUGGY_CLIENT_ID, secret: v.PLUGGY_CLIENT_SECRET, items: v.PLUGGY_ITEM_ID.split(',').map((s) => s.trim()).filter(Boolean) })
      .then((j) => { if (j.accepted && !['keys', 'item', 'nokeys'].includes(j.problem) && state.data.readAt) saveKeys(v); });
    return json(req, res, { job });
  }
  return json(req, res, { error: 'not found' }, 404);
}

const server = http.createServer(async (req, res) => {
  try {
    const host = String(req.headers.host ?? '').replace(/:\d+$/, '');
    if (!hosts().has(host)) return send(req, res, 403, 'text/plain; charset=utf-8', 'Endereço não autorizado.');
    if (req.headers['tailscale-funnel-request']) return send(req, res, 403, 'text/plain; charset=utf-8', 'Endereço não autorizado.'); // never the open internet
    const url = new URL(req.url, 'http://x'), path = url.pathname;
    // A page of another site, or of another port of this computer, has no business here.
    if (path.startsWith('/api/') && !['same-origin', 'none', undefined].includes(req.headers['sec-fetch-site'])) return json(req, res, { error: 'origin' }, 403);
    const health = path === '/api/health' && (req.method === 'GET' || req.method === 'HEAD');
    const login = req.method === 'POST' && (path === '/api/owner/setup' || path === '/api/owner/login');
    if (path.startsWith('/api/') && !health && !login && !owner.allows(req)) {
      // The prior version reads up.version here while waiting for an update to restart.
      const status = path === '/api/job' ? { up: { version: up.version } } : {};
      return json(req, res, { error: 'owner', setup: owner.needsSetup(), ...status }, 401);
    }
    if (req.method === 'POST') return await post(req, res, path);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405, 'text/plain', '');
    if (path === '/' || path === '/index.html') return send(req, res, 200, MIME['.html'], readFileSync(join(WEB, 'index.html')));
    if (path === '/api/health') return json(req, res, { ok: true, app: 'financas', port: PORT, version: up.version, proof: answer(DATA, url.searchParams.get('n')) });
    if (path === '/api/job') return json(req, res, { job, readAt: state.data.readAt, up: upState() });
    if (path === '/api/state') return json(req, res, snapshot(req));
    if (FILES.has(path.slice(1))) return send(req, res, 200, MIME[extname(path)], readFileSync(join(WEB, path.slice(1))));
    return send(req, res, 404, 'text/plain; charset=utf-8', 'Não encontrado.');
  } catch (e) {
    console.error('request failed: ' + e.name); // never the message: it could carry data
    if (!res.headersSent) json(req, res, { error: 'server' }, 500);
  }
});
let timer;
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is taken. Not starting.` : 'server: ' + e.code);
  process.exitCode = 1;
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('Finanças on http://localhost:' + PORT);
  if (process.env.FIN_NO_TIMER) return;
  const every = () => { if (!up.running) tick(); look(); };
  setTimeout(every, 1500);
  timer = setInterval(every, 5 * 60000);
});
// Closes so that swap.mjs can change the files. Never process.exit() right after a fetch: on Windows it crashes.
function close() {
  clearInterval(timer);
  server.close();
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 4000).unref();
}
