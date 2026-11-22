// Changes the files of the app while it is closed. A version that does not open is undone, data included.
//   node swap.mjs <app folder> <data folder> <port> <pid of the app> <new version>
// update.mjs runs a copy of this file from the data folder, so it can replace the app whole.
import { spawn } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [app, data, port, pid, version] = process.argv.slice(2);
const dir = join(data, 'update');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (p) => { try { process.kill(p, 0); return true; } catch { return false; } };
// The app answers with a proof made from the secret of this data folder, so nothing else on the port passes for it.
async function health() {
  const n = randomBytes(16).toString('hex');
  try {
    const h = await (await fetch(`http://127.0.0.1:${port}/api/health?n=${n}`, { signal: AbortSignal.timeout(2000) })).json();
    return h.proof === createHmac('sha256', readFileSync(join(data, 'local.key'), 'utf8').trim()).update(n).digest('hex') ? h : null;
  } catch { return null; }
}
async function start(want) {
  const c = spawn(process.execPath, [join(app, 'server.mjs')], { detached: true, stdio: 'ignore', windowsHide: true, cwd: app });
  let failed = false;
  c.on('error', () => { failed = true; });
  c.unref();
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    if (failed || !alive(c.pid)) return false;
    const h = await health();
    if (h && (!want || h.version === want)) return true;
  }
  try { process.kill(c.pid); } catch { /* already gone */ }
  return false;
}
function put(from) {
  for (const n of readdirSync(app)) if (existsSync(join(from, n))) rmSync(join(app, n), { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  cpSync(from, app, { recursive: true });
}
// Antivirus and indexing hold files for a moment: undoing is tried again instead of stopping half way.
async function again(f) {
  for (let i = 0; i < 10; i++) {
    try { return f(); } catch { await sleep(1000); }
  }
}

for (let i = 0; i < 60 && alive(+pid); i++) await sleep(250);
let ok = false;
try {
  put(join(dir, 'new'));
  ok = await start(version);
} catch { /* undone below */ }
if (!ok) {
  await sleep(500);
  await again(() => put(join(dir, 'old')));
  await again(() => {
    for (const n of readdirSync(data)) if (/[.]json([.]bak)?$/.test(n) && !existsSync(join(dir, 'data', n))) rmSync(join(data, n)); // made by the version being undone
    cpSync(join(dir, 'data'), data, { recursive: true });
  });
  await start();
}
writeFileSync(join(dir, 'result.json'), JSON.stringify({ version, ok }));
