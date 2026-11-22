// New versions of the app. Only an installed copy looks for them (install.json), only a click applies them, and
// only a list signed by the publisher is accepted. Nothing about the person is sent: these are plain downloads.
import { createHash, createPublicKey, verify } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { APP, DATA, INSTALL, PORT, now } from './config.mjs';

const DIR = join(DATA, 'update');
const EVERY = 6 * 3600000;
const PATH = /^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:mjs|js|json|css|html|svg|woff2|txt)$/;
export const up = { version: INSTALL?.version ?? null, next: null, notes: '', running: false, problem: null };
let found = null, looked = 0;

const parts = (v) => (/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v) ? v.split('.').map(Number) : null);
export function newer(a, b) {
  const x = parts(a), y = parts(b);
  if (!x || !y) return false;
  const i = [0, 1, 2].find((k) => x[k] !== y[k]);
  return i !== undefined && x[i] > y[i];
}
async function get(path, max = 3e6) {
  const url = INSTALL.from + path;
  if (!/^https:\/\//.test(url) && !/^http:\/\/127\.0\.0\.1:/.test(url)) throw new Error('address'); // the second is for tests
  const r = await fetch(url, { signal: AbortSignal.timeout(45000), redirect: 'error', cache: 'no-store' });
  if (!r.ok) throw new Error('download');
  const parts = [];
  let size = 0;
  for await (const c of r.body) {
    if ((size += c.length) > max) throw new Error('size'); // stops reading, instead of keeping it all first
    parts.push(c);
  }
  return Buffer.concat(parts);
}
const signed = (list, sig) => verify(null, list, createPublicKey({ key: Buffer.from(INSTALL.key, 'base64'), format: 'der', type: 'spki' }), Buffer.from(String(sig).trim(), 'base64'));

export async function look() {
  if (!INSTALL || up.running || now() - looked < EVERY) return;
  looked = now();
  try {
    const list = await get('/main/manifest.json', 100000);
    if (!signed(list, await get('/main/manifest.sig', 1000))) throw new Error('signature');
    const m = JSON.parse(list), files = Object.entries(m.files ?? {});
    if (!parts(m.version) || !files.length || files.length > 200 || files.some(([p, h]) => !PATH.test(p) || !/^[0-9a-f]{64}$/.test(h))) throw new Error('list');
    if (up.running) return;
    const undone = lastSwap(); // a version that did not open here is not offered again
    found = newer(m.version, INSTALL.version) && !(undone?.ok === false && undone.version === m.version) && Number(process.versions.node.split('.')[0]) >= m.node ? m : null;
    up.next = found?.version ?? null;
    up.notes = String(found?.notes ?? '').slice(0, 300);
  } catch (e) {
    console.log(new Date().toISOString(), 'version check: ' + (['address', 'download', 'size', 'signature', 'list'].includes(e.message) ? e.message : 'no answer'));
  }
}

// Downloads everything, checks every file, and hands over to swap.mjs, which changes the files with the app closed.
export async function apply(close) {
  const want = found;
  if (!want || up.running) return false;
  Object.assign(up, { running: true, problem: null });
  try {
    const fresh = join(DIR, 'new');
    for (const n of ['new', 'old', 'data']) rmSync(join(DIR, n), { recursive: true, force: true }); // result.json stays: a version undone once is not offered again
    for (const [p, hash] of Object.entries(want.files)) {
      const b = await get(`/v${want.version}/app/${p}`);
      if (createHash('sha256').update(b).digest('hex') !== hash) throw new Error('hash');
      mkdirSync(dirname(join(fresh, p)), { recursive: true });
      writeFileSync(join(fresh, p), b);
    }
    if (JSON.parse(readFileSync(join(fresh, 'install.json'), 'utf8')).version !== want.version) throw new Error('version');
    mkdirSync(join(DIR, 'data'), { recursive: true });
    for (const n of readdirSync(DATA).filter((f) => /\.json(\.bak)?$/.test(f))) copyFileSync(join(DATA, n), join(DIR, 'data', n));
    cpSync(APP, join(DIR, 'old'), { recursive: true });
    copyFileSync(join(APP, 'lib/swap.mjs'), join(DIR, 'swap.mjs'));
    spawn(process.execPath, [join(DIR, 'swap.mjs'), APP, DATA, String(PORT), String(process.pid), want.version], { detached: true, stdio: 'ignore', windowsHide: true, cwd: DATA }).unref();
    close();
    return true;
  } catch (e) {
    Object.assign(up, { running: false, problem: 'update' });
    console.log(new Date().toISOString(), 'update failed: ' + (['address', 'download', 'size', 'hash', 'version'].includes(e.message) ? e.message : 'internal'));
    return false;
  }
}
// What the last change left: done or undone.
export function lastSwap() {
  try { return JSON.parse(readFileSync(join(DATA, 'update', 'result.json'), 'utf8')); } catch { return null; }
}
