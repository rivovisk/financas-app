// Every number a screen shows, from classified entries. Pure, shared by the browser and the tests.
import { GROUPS, groupName } from './categories.mjs';
import { addDays, addMonths, dayOf, daysBetween, daysIn, diff, monthIn, monthName, monthOf, norm, reais, round2 } from './format.mjs';

export const sum = (list) => round2(list.reduce((s, e) => s + e.v, 0));
export const spent = (list) => round2(-sum(list));
// A filter is nothing (everything passes), one value, or a list. An empty list lets nothing pass.
export const inside = (want, v) => (Array.isArray(want) ? want.includes(v) : !want || want === v);
const inAcc = (acc) => (e) => inside(acc, e.acc);

// The current month goes up to today, against the same days of the month before.
export function period(month, today) {
  const open = month === monthOf(today);
  const to = open ? today : month + '-' + String(daysIn(month)).padStart(2, '0');
  const pm = addMonths(month, -1);
  const pto = pm + '-' + String(open ? Math.min(dayOf(today), daysIn(pm)) : daysIn(pm)).padStart(2, '0');
  return { month, open, from: month + '-01', to, prev: { month: pm, from: pm + '-01', to: pto } };
}
export const within = (list, from, to) => list.filter((e) => e.d >= from && e.d <= to);

// The first day the bank gave. A month that starts before it is not whole and is never compared.
export function firstDay(entries, acc) {
  const d = entries.filter(inAcc(acc)).reduce((m, e) => (e.d < m ? e.d : m), '9999-99-99');
  return d === '9999-99-99' ? null : d;
}
export function monthsWithData(entries, today) {
  const f = firstDay(entries) ?? today, out = [];
  for (let m = monthOf(f); m <= monthOf(today); m = addMonths(m, 1)) out.push(m);
  return out;
}

export function summary(entries, { month, acc, today }) {
  const p = period(month, today), f = firstDay(entries, acc);
  const mine = entries.filter(inAcc(acc));
  const cur = within(mine, p.from, p.to), old = within(mine, p.prev.from, p.prev.to);
  const flow = (L, x) => L.filter((e) => e.flow === x);
  const comparable = !!f && daysBetween(p.prev.from, f) <= 3;
  return { p, comparable, cur, old, out: flow(cur, 'out'), in: flow(cur, 'in'), oldOut: flow(old, 'out'), oldIn: flow(old, 'in'), spent: spent(flow(cur, 'out')), got: sum(flow(cur, 'in')) };
}

export function groupTotals(s) {
  return GROUPS.map((g) => ({ id: g.id, name: g.name, a: spent(s.out.filter((e) => e.g === g.id)), b: spent(s.oldOut.filter((e) => e.g === g.id)), n: s.out.filter((e) => e.g === g.id).length }))
    .filter((g) => g.n).sort((x, y) => y.a - x.a);
}
// Income has no category in the bank data, so each circle is who sent it: the two largest and the rest.
export function payerTotals(s) {
  const by = new Map();
  for (const e of s.in) (by.get(e.key || '') ?? by.set(e.key || '', { key: e.key || '', name: e.name || 'Sem nome', L: [] }).get(e.key || '')).L.push(e);
  const all = [...by.values()].map((p) => ({ ...p, a: sum(p.L) })).sort((x, y) => y.a - x.a);
  const old = (keys, inside) => sum(s.oldIn.filter((e) => keys.includes(e.key || '') === inside));
  const top = all.length > 3 ? all.slice(0, 2) : all;
  const rows = top.map((p, i) => ({ id: 'in' + (i || ''), key: p.key, name: p.name, a: p.a, b: old([p.key], true), tone: i }));
  if (all.length > 3) rows.push({ id: 'rest', key: null, name: 'Outras entradas', a: round2(all.slice(2).reduce((t, p) => t + p.a, 0)), b: old(top.map((p) => p.key), false), tone: 2 });
  return rows;
}

// Names who, what and compared with what.
export function sentence(s, rows, off, view, today, hide) {
  const out = view === 'out', month = monthName(s.p.month), prev = monthIn(s.p.prev.month, today);
  const list = out ? s.out : s.in;
  if (!list.length) return { h: out ? `Nenhum gasto em ${month}${s.p.open ? ' até agora' : ''}.` : `Nenhuma entrada em ${month}${s.p.open ? ' até agora' : ''}.`, s: '' };
  const vis = rows.filter((r) => !off.includes(r.id));
  const gone = rows.filter((r) => off.includes(r.id)).map((r) => r.name);
  const a = round2(vis.reduce((t, r) => t + r.a, 0));
  const word = out ? (s.p.open ? 'você gastou' : 'você gastou') : 'entrou';
  const start = gone.length ? 'Sem ' + gone.join(' e ') + ', ' + word : word[0].toUpperCase() + word.slice(1);
  if (!s.comparable) return { h: `${start} ${reais(a, hide)} em ${month}.`, s: 'Ainda não há um mês inteiro antes para comparar.' };
  const prevAll = out ? s.oldOut : s.oldIn;
  const hidden = rows.filter((r) => off.includes(r.id));
  const b = round2((out ? spent(prevAll) : sum(prevAll)) - hidden.reduce((t, r) => t + r.b, 0));
  const d = round2(a - b);
  const h = Math.abs(d) < 0.005 ? `${start} o mesmo que em ${prev}.` : `${start} ${diff(d, hide)} que em ${prev}.`;
  // The cause: one entry that explains most of the rise, or the group that moved most.
  if (out && d > 0 && !gone.length) {
    const big = s.out.filter((e) => e.v < 0).sort((x, y) => x.v - y.v)[0];
    const same = s.oldOut.some((e) => e.key && e.key === big.key && Math.abs(e.v - big.v) < Math.abs(big.v) * 0.2);
    if (big && !same && -big.v >= d * 0.6 && -big.v <= d * 1.6 && big.name) {
      const verb = big.pay === 'Pix' || big.pay === 'TED' ? `de um ${big.pay} de ${reais(big.v, hide)} que você enviou para ${big.name}` : `de ${reais(big.v, hide)} em ${big.name}`;
      return { h, s: (-big.v >= d * 0.9 ? 'Quase todo o aumento vem ' : 'A maior parte do aumento vem ') + verb + '.' };
    }
  }
  const top = vis.slice().sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b))[0];
  return { h, s: top && Math.abs(top.a - top.b) > 0.005 ? `A maior mudança foi em ${top.name}: ${diff(top.a - top.b, hide)}.` : '' };
}

export function byPay(list, out) {
  const by = new Map();
  for (const e of list) by.set(e.pay, round2((by.get(e.pay) ?? 0) + (out ? -e.v : e.v)));
  return [...by].map(([n, v]) => ({ n, v })).filter((x) => Math.abs(x.v) > 0.005).sort((a, b) => b.v - a.v);
}
export const largest = (list, n = 4) => list.filter((e) => (list[0]?.flow === 'in' ? e.v > 0 : e.v < 0)).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, n);

export function lastMonths(month, n) {
  return Array.from({ length: n }, (_, i) => addMonths(month, i - n + 1));
}
// The n months a card shows: the latest ones, or a window that still has months after the chosen one.
export function monthsAround(months, month, n) {
  const last = months.at(-1), first = months[0] ?? month;
  let end = month > addMonths(last, -n) ? last : addMonths(month, Math.floor(n / 2));
  if (addMonths(end, 1 - n) < first) end = addMonths(first, n - 1) > last ? last : addMonths(first, n - 1);
  return lastMonths(end, n);
}
// One or two months far above the rest would flatten all the others: those are cut at the top, with a mark.
export function barScale(values) {
  const v = values.filter((n) => n > 0.004).sort((a, b) => b - a);
  let i = -1;
  for (let k = 0; k < v.length / 3 && k + 3 < v.length; k++) if (v[k] > 3 * v[k + 1]) i = k;
  return i < 0 ? { top: v[0] ?? 1, cut: Infinity } : { top: v[i + 1] * 1.25, cut: v[i + 1] };
}
export function monthTotal(entries, month, { acc, today, flow = 'out', g, key }) {
  const p = period(month, today);
  const L = within(entries, p.from, p.to).filter((e) => inAcc(acc)(e) && e.flow === flow && (!g || e.g === g) && (!key || e.key === key));
  return flow === 'in' ? sum(L) : spent(L);
}

// ---- statements ------------------------------------------------------------------------------
const charge = (e) => e.card && e.why !== 'Pagamento de fatura' && e.why !== 'Já contado na fatura';

// The bank does not give the open statement's dates. The due day is the one that best explains the past
// due dates (weekends and holidays only push forward); closing is a fixed number of days before it.
export function nextDates(bills) {
  const list = bills.filter((b) => b.close).sort((a, b) => (a.due < b.due ? -1 : 1));
  if (list.length < 2) return null;
  const at = (m, D) => m + '-' + String(Math.min(D, daysIn(m))).padStart(2, '0');
  const nominal = (due, D) => {
    const n = at(monthOf(due), D);
    return n <= due ? n : at(addMonths(monthOf(due), -1), D);
  };
  let best = null;
  for (let D = 1; D <= 31; D++) {
    const shift = list.map((b) => daysBetween(nominal(b.due, D), b.due));
    const score = shift.filter((x) => x <= 4).length * 1000 - shift.reduce((a, x) => a + x, 0);
    if (!best || score > best.score) best = { D, score };
  }
  const count = new Map();
  for (const b of list) {
    const k = daysBetween(b.close, nominal(b.due, best.D));
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const lead = [...count].sort((a, b) => b[1] - a[1])[0][0];
  const m = addMonths(monthOf(nominal(list.at(-1).due, best.D)), 1);
  const n = at(m, best.D), wd = new Date(n + 'T00:00:00Z').getUTCDay();
  return { close: addDays(n, -lead), due: addDays(n, wd === 6 ? 2 : wd === 0 ? 1 : 0), hits: count.get(lead), of: list.length };
}

export function statements(entries, bills, account, today) {
  const mine = entries.filter((e) => e.acc === account.key && e.special !== 'nameless');
  const closed = bills.filter((b) => b.acc === account.key).sort((a, b) => (a.due < b.due ? -1 : 1));
  const next = nextDates(closed), last = closed.at(-1);
  const un = mine.filter((e) => e.card && !e.bill && (!next || e.d <= next.close || e.d <= today));
  const sent = sum(un.filter((e) => e.why === 'Pagamento de fatura'));
  const owed = last?.total ?? 0;
  const paid = sent > 0 ? sent : round2((last?.paid ?? []).reduce((s, p) => s + p.v, 0));
  const charges = un.filter(charge);
  const open = round2(spent(charges) - Math.max(0, round2(paid - owed)));
  return {
    account, next, last, open, charges, has: charges.length > 0 || !!next,
    unpaid: last ? Math.max(0, round2(owed - paid)) : 0,
    month: next ? monthOf(next.close) : monthOf(today),
    closed: closed.map((b) => {
      const got = round2(b.paid.reduce((s, p) => s + p.v, 0));
      return { ...b, month: monthOf(b.close ?? addDays(b.due, -7)), when: b.paid.map((p) => p.d).sort().at(-1) ?? null, part: got > 0 && got < b.total - 0.01, got };
    }).reverse(),
  };
}

export function subscriptions(entries, { acc, today }) {
  const by = new Map();
  for (const e of entries) {
    if (e.flow !== 'out' || e.v >= 0 || !e.key || e.inst || !['Crédito', 'Débito', 'Boleto'].includes(e.pay) || (acc && e.acc !== acc)) continue;
    (by.get(e.key) ?? by.set(e.key, []).get(e.key)).push(e);
  }
  const out = [];
  for (const [key, L] of by) {
    L.sort((a, b) => (a.d < b.d ? 1 : -1));
    const last = L[0];
    if (daysBetween(last.d, today) > 40) continue;
    if (L.filter((e) => daysBetween(e.d, last.d) <= 62).length > 3) continue;
    const tol = last.cur ? 0.2 : 0.1;
    const before = L.find((e) => e !== last && daysBetween(e.d, last.d) >= 25 && daysBetween(e.d, last.d) <= 36 && Math.abs(e.v - last.v) <= Math.abs(last.v) * tol);
    if (!before) continue;
    out.push({ key, name: last.name, g: last.g, v: -last.v, d: last.d, fixedDay: Math.abs(dayOf(last.d) - dayOf(before.d)) <= 2 });
  }
  return out.sort((a, b) => b.v - a.v);
}

// ---- wealth ----------------------------------------------------------------------------------
export function wealthNow({ accounts, investments, entries, bills, today }) {
  const banks = accounts.filter((a) => a.type === 'BANK' && !a.gone);
  const cards = accounts.filter((a) => a.type === 'CARD' && !a.gone).map((a) => statements(entries, bills, a, today));
  const inv = investments.filter((i) => i.balance >= 0.01).sort((a, b) => b.balance - a.balance);
  const inAccounts = round2(banks.reduce((s, a) => s + a.balance, 0));
  const invested = round2(inv.reduce((s, i) => s + i.balance, 0));
  const open = round2(cards.reduce((s, c) => s + c.open, 0)), unpaid = round2(cards.reduce((s, c) => s + c.unpaid, 0));
  return { banks, cards, inv, inAccounts, invested, open, unpaid, total: round2(inAccounts + invested - open - unpaid) };
}
export function photo(w, d) {
  return { d, total: w.total, accounts: w.inAccounts, invested: w.invested, owed: round2(w.open + w.unpaid), by: Object.fromEntries([...w.banks.map((a) => [a.key, a.balance]), ...w.cards.map((c) => [c.account.key, round2(-c.open - c.unpaid)])]) };
}
export function wealthLine(photos, months, today, acc) {
  const from = months ? addMonths(monthOf(today), -months + 1) + '-01' : '0000';
  const want = acc ? [].concat(acc) : null, keys = want?.filter((k) => k !== 'inv');
  if (want && !want.length) return [];
  const v = (p) => (want ? round2(keys.reduce((s, k) => s + p.by[k], want.includes('inv') ? p.invested : 0)) : p.total);
  return photos.filter((p) => p.d >= from && (!want || keys.every((k) => p.by?.[k] !== undefined))).map((p) => ({ d: p.d, v: v(p), accounts: p.accounts, invested: p.invested, owed: p.owed }));
}

// ---- statement screen ------------------------------------------------------------------------
export function filter(entries, f, today) {
  const q = norm(f.q ?? ''), qn = (f.q ?? '').replace(/[^\d,]/g, '');
  return entries.filter((e) => {
    if (!inside(f.acc, e.acc)) return false;
    if (f.bill) {
      if (f.bill === 'open' ? !f.openIds?.has(e.id) : e.bill !== f.bill || !charge(e)) return false;
    } else if (f.month !== 'all') {
      const p = period(f.month, today);
      if (e.d < p.from || e.d > p.to) return false;
    } else if (e.d > today) return false;
    if (f.flow !== 'all' && !inside(f.flow, e.flow ?? 'none')) return false;
    if (!inside(f.g, e.g)) return false;
    if (!inside(f.pay, e.pay)) return false;
    if (f.key && e.key !== f.key) return false;
    if (f.min && Math.abs(e.v) < f.min) return false;
    if (f.max && Math.abs(e.v) > f.max) return false;
    if (f.day && e.d !== f.day) return false;
    if (q || qn) {
      const amount = Math.abs(e.v).toFixed(2).replace('.', ',');
      const name = q && norm(e.name + ' ' + e.head + ' ' + (e.sub ?? '')).includes(q);
      if (!name && !(qn && /^[\d.,\sR$]+$/.test(f.q.trim()) && amount.startsWith(qn))) return false;
    }
    return true;
  });
}
export { groupName };
