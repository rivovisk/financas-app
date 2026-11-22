// Read-only client: one POST /auth, then GET. Never /identity, never PATCH, never DELETE.
import { API } from './config.mjs';

export class Problem extends Error {
  constructor(kind, status) {
    super(kind);
    this.kind = kind; // keys | bank | expired | item | empty
    this.status = status;
  }
}
async function call(path, init) {
  let r;
  try {
    r = await fetch(API + path, { ...init, signal: AbortSignal.timeout(45000), redirect: 'error' });
  } catch {
    throw new Problem('bank');
  }
  if (r.ok) return r.json().catch(() => { throw new Problem('bank'); });
  throw new Problem(r.status === 401 || r.status === 403 ? 'keys' : r.status === 404 || r.status === 400 ? 'item' : 'bank', r.status);
}
export async function connect({ id, secret }) {
  let apiKey;
  try {
    ({ apiKey } = await call('/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: id, clientSecret: secret }) }));
  } catch (e) {
    throw e.kind === 'item' ? new Problem('keys', e.status) : e; // /auth answers 400 to a malformed id
  }
  const get = (path) => call(path, { headers: { 'X-API-KEY': apiKey } });
  const E = encodeURIComponent;
  return {
    item: (i) => get('/items/' + E(i)),
    accounts: async (i) => (await get('/accounts?itemId=' + E(i))).results,
    bills: async (a) => (await get('/bills?accountId=' + E(a))).results,
    investments: async (i) => (await get('/investments?itemId=' + E(i))).results,
    movements: async (i) => (await get('/investments/' + E(i) + '/transactions')).results,
    async transactions(a) {
      const all = [];
      for (let q = '?accountId=' + E(a); q;) {
        const page = await get('/v2/transactions' + q);
        all.push(...page.results);
        q = page.next ? page.next.slice(page.next.indexOf('?')) : null;
        if (all.length > 50000) throw new Problem('bank');
      }
      return all;
    },
  };
}
