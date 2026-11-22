// Reads every bank and merges the answer with what is stored. All or nothing per bank: a half answer, an
// empty answer or an expired authorization never replaces good data.
import { connect, Problem } from './pluggy.mjs';
import { account, bankOf, bill, entry, hash, investment, movement, withIds } from './normalize.mjs';
import { daysBetween, today } from '../web/core/format.mjs';

const EXPIRED = /AUTHORIZATION_EXPIRED|CONSENT_(EXPIRED|REVOKED)|USER_AUTHORIZATION/i;

export function itemProblem(item, now) {
  if (item.consentExpiresAt && Date.parse(item.consentExpiresAt) <= now) return 'expired';
  if (EXPIRED.test(item.error?.code ?? '')) return 'expired';
  if (item.status === 'LOGIN_ERROR' || item.status === 'OUTDATED') return 'bank';
  return null;
}

// Stored entries older than the new answer stay (Pluggy only gives about 12 months). From its first day
// on, the new answer replaces the stored one whole, so an entry with a new Pluggy id is never repeated.
export function mergeEntries(stored, fresh) {
  if (!fresh.length) return stored;
  const start = fresh.reduce((m, e) => (e.d < m ? e.d : m), '9999');
  const ids = new Set(fresh.map((e) => e.id));
  const older = stored.some((e) => e.d < start);
  return [...stored.filter((e) => e.d < start || (older && e.d === start && !ids.has(e.id))), ...fresh];
}
// The stored part of the same window must not shrink to less than half: that is a broken read.
export function shrank(stored, fresh, day) {
  const win = stored.filter((e) => daysBetween(e.d, day) <= 330);
  return win.length >= 10 && fresh.length < win.length / 2;
}

// A bank may not offer statements or investments (400, 403 or 404). Any other failure stops the read.
function softly(e) {
  if (e instanceof Problem && e.status && e.status < 500 && e.status !== 429) return [];
  throw e;
}

async function readItem(api, id, now) {
  const item = await api.item(id);
  const info = { key: 'k' + hash(id, 10), readAt: item.lastUpdatedAt ?? null, next: item.nextAutoSyncAt ?? null, until: item.consentExpiresAt ?? null, problem: itemProblem(item, now) };
  if (info.problem === 'expired') return { info };
  const raw = await api.accounts(id);
  if (!raw.length) return { info: { ...info, problem: info.problem ?? 'empty' } };
  info.bank = bankOf(raw);
  const out = { info, accounts: [], entries: {}, bills: [], investments: [] };
  for (const a of raw) {
    const acc = account(a, info.bank, info.key);
    out.accounts.push(acc);
    out.entries[acc.key] = withIds((await api.transactions(a.id)).map((t) => entry(t, acc.key, acc.type === 'CARD')));
    if (acc.type === 'CARD') out.bills.push(...(await api.bills(a.id).catch(softly)).map((b) => bill(b, acc.key)));
  }
  for (const i of await api.investments(id).catch(softly)) {
    const inv = investment(i, info.bank, info.key);
    if (inv.balance < 0.01 || i.status === 'TOTAL_WITHDRAWAL') continue;
    inv.moves = (await api.movements(i.id).catch(softly)).map(movement).sort((x, y) => (x.d < y.d ? 1 : -1));
    out.investments.push(inv);
  }
  return out;
}

export async function collect(keys, stored, now, step = () => {}) {
  const api = await connect(keys);
  step(1);
  const reads = [];
  for (const id of keys.items) {
    try {
      reads.push(await readItem(api, id, now));
    } catch (e) {
      if (!(e instanceof Problem)) throw e;
      reads.push({ info: { key: 'k' + hash(id, 10), problem: e.kind } });
    }
  }
  step(2);
  return merge(stored, reads, now);
}

export function merge(stored, reads, now) {
  const day = today(now);
  const next = structuredClone(stored);
  const before = new Map(stored.items.map((i) => [i.key, i]));
  next.items = [];
  let good = 0;
  for (const r of reads) {
    let problem = r.info.problem;
    if (r.accounts) {
      if (r.accounts.some((a) => shrank(stored.entries.filter((e) => e.acc === a.key), r.entries[a.key], day))) problem = 'empty';
      if (!r.bills.length && stored.bills.some((b) => r.accounts.some((a) => a.key === b.acc))) problem = 'empty';
    }
    if (!r.accounts || problem === 'empty') {
      const old = before.get(r.info.key);
      next.items.push({ ...old, key: r.info.key, readAt: old?.readAt ?? null, next: r.info.next ?? old?.next ?? null, until: r.info.until ?? old?.until ?? null, problem: problem === 'empty' ? 'bank' : problem });
      continue;
    }
    good++;
    next.items.push({ ...r.info, problem });
    const mine = new Set(r.accounts.map((a) => a.key));
    // The same bank authorized again can come back as another item: its accounts move to the new one.
    const moved = new Set(stored.accounts.filter((a) => mine.has(a.key)).map((a) => a.item));
    next.accounts = [...next.accounts.filter((a) => !mine.has(a.key)), ...r.accounts];
    for (const k of mine) next.entries = [...next.entries.filter((e) => e.acc !== k), ...mergeEntries(stored.entries.filter((e) => e.acc === k), r.entries[k])];
    const same = (b) => r.bills.some((n) => n.key === b.key || (n.acc === b.acc && n.due === b.due));
    next.bills = [...next.bills.filter((b) => !same(b)), ...r.bills];
    next.investments = [...next.investments.filter((i) => i.item !== r.info.key && !moved.has(i.item)), ...r.investments];
  }
  // A bank no longer configured keeps its history and leaves the balance.
  const live = new Set(next.items.map((i) => i.key));
  next.accounts = next.accounts.map((a) => ({ ...a, gone: live.has(a.item) ? undefined : true }));
  next.investments = next.investments.filter((i) => live.has(i.item));
  if (good) next.readAt = new Date(now).toISOString();
  const worst = ['keys', 'expired', 'item', 'bank'].find((p) => next.items.some((i) => i.problem === p)) ?? null;
  return { data: next, good, problem: worst };
}
