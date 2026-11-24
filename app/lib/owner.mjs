// The owner password and the first-run proof stay in the data directory.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const hex = (n) => randomBytes(n).toString('hex');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  a.length === b.length && timingSafeEqual(Buffer.from(a, 'ascii'), Buffer.from(b, 'ascii'));
const proofPath = (data) => join(data, 'owner-setup.json');
const ownerPath = (data) => join(data, 'owner.json');
const read = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };
function write(path, value) {
  const temp = path + '.' + hex(8) + '.new';
  try {
    writeFileSync(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
    renameSync(temp, path);
  } finally { rmSync(temp, { force: true }); }
}

// Only the desktop launcher issues a proof. A corrupt password file still counts as configured.
export function setupCode(data) {
  if (existsSync(ownerPath(data))) return null;
  const code = hex(32);
  write(proofPath(data), { hash: hash(code), until: Date.now() + 15 * 60_000 });
  return code;
}

export function ownerAuth(data) {
  const path = ownerPath(data), proof = proofPath(data), sessions = new Map();
  let busy = false, retryAt = 0;
  const needsSetup = () => !existsSync(path);
  const sessionKey = (req) => {
    const token = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization ?? '')?.[1];
    return token ? hash(token) : null;
  };
  function allows(req) {
    const key = sessionKey(req), session = sessions.get(key);
    if (!session) return false;
    if (Date.now() >= session.until) { sessions.delete(key); return false; }
    return session.host === req.headers.host;
  }
  function issue(host) {
    const now = Date.now(), token = hex(32);
    for (const [key, value] of sessions) if (value.until <= now) sessions.delete(key);
    if (sessions.size >= 32) sessions.delete(sessions.keys().next().value);
    sessions.set(hash(token), { host, until: now + 8 * 60 * 60_000 });
    return { token };
  }

  async function enter(req, body, first) {
    const password = body?.password;
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) return { status: 400, error: 'password-length' };
    if (busy || Date.now() < retryAt) return { status: 429, error: 'wait' };
    if (first !== needsSetup()) return { status: 409, error: 'setup-state' };
    const code = body?.code;
    const pending = () => {
      const p = read(proof);
      return p?.until > Date.now() && typeof code === 'string' && /^[0-9a-f]{64}$/.test(code) && equal(p.hash, hash(code));
    };
    if (first && !pending()) return { status: 403, error: 'setup-code' };
    const owner = first ? { salt: hex(16) } : read(path);
    if (!/^[0-9a-f]{32}$/.test(owner?.salt ?? '')) return { status: 503, error: 'owner-file' };

    busy = true;
    try {
      const digest = (await derive(password, owner.salt, 64, { N: 32768, maxmem: 64 * 1024 * 1024 })).toString('hex');
      if (first) {
        if (!needsSetup() || !pending()) return { status: 403, error: 'setup-code' };
        write(path, { salt: owner.salt, digest });
        rmSync(proof, { force: true });
      } else if (!equal(owner.digest, digest)) {
        retryAt = Date.now() + 2000;
        return { status: 401, error: 'password' };
      }
      return { status: 200, ...issue(req.headers.host) };
    } finally { busy = false; }
  }
  return { needsSetup, allows, enter, leave: (req) => sessions.delete(sessionKey(req)) };
}
