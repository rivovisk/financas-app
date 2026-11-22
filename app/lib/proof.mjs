// Shows that what listens on the port is this person's app: it knows a secret that only this person's folder holds.
// Another account of the same computer can listen on the port and copy an answer, but cannot read that file.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sign = (secret, n) => createHmac('sha256', secret).update(n).digest('hex');
export function secretOf(data, make) {
  const p = join(data, 'local.key');
  if (make && !existsSync(p)) writeFileSync(p, randomBytes(32).toString('hex'), { mode: 0o600 });
  try { return readFileSync(p, 'utf8').trim(); } catch { return null; }
}
export const answer = (data, n) => (/^[0-9a-f]{32}$/.test(n ?? '') ? sign(secretOf(data, true), n) : undefined);
// null: nobody answers. false: someone else does. Otherwise the answer of the app.
export async function ask(port, data) {
  const n = randomBytes(16).toString('hex');
  let h;
  try { h = await (await fetch(`http://127.0.0.1:${port}/api/health?n=${n}`, { signal: AbortSignal.timeout(2000), redirect: 'error' })).json(); } catch (e) { return e.name === 'SyntaxError' ? false : null; }
  const secret = secretOf(data), want = secret && Buffer.from(sign(secret, n)), got = Buffer.from(String(h?.proof ?? ''));
  return want && got.length === want.length && timingSafeEqual(got, want) ? h : false;
}
