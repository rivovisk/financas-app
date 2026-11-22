// Decides what each entry is. Pure: entries + rules in, the same entries with a meaning out. Nothing
// about an entry is stored, so undoing a rule is exact.
//   flow  'out'  spending (a return is a positive amount inside spending)
//         'in'   income
//         null   neither (own transfer, investment, statement payment, rule)
//   g     group id, for spending
import { groupOf, isTransferCategory, labelOf } from './categories.mjs';
import { daysBetween, round2 } from './format.mjs';

export const NO_NAME_CHARGE = 'COBRANCA SEM NOME NA FATURA';

const INVEST_OP = /APLIC|RESGATE|INVEST/i;
const INVEST_HEAD = /^(Valor (recebido de|transferido para) Invest|Resgate|Aplica[çc]|Compra de (Renda|criptom|Cripto)|Venda de (Renda|criptom|Cripto)|Rendimento)/i;
const BILL_HEAD = /^Pagamento (de|da) fatura/i;
// On an overdue statement these rows repeat money already counted: the carried purchases, and the
// "dívida encerrada" interest, which is the sum of the fine, interest and IOF listed one by one.
const CARRIED = /^(saldo em atraso|cr[ée]dito de atraso|encerramento de d[íi]vida|juros de d[íi]vida encerrada|saldo (restante|anterior) da fatura|cr[ée]dito de rotativo|saldo em rotativo)/i;
const OP_TYPE = { PIX: 'Pix', CARTAO: 'Débito', BOLETO: 'Boleto', CONVENIO_ARRECADACAO: 'Boleto', TED: 'TED', DOC: 'TED', SAQUE: 'Saque' };

export function payType(e) {
  if (e.card) return 'Crédito';
  if (OP_TYPE[e.op]) return OP_TYPE[e.op];
  if (/Pix/i.test(e.head)) return 'Pix';
  if (/d[ée]bito|NuPay/i.test(e.head)) return 'Débito';
  if (/boleto/i.test(e.head)) return 'Boleto';
  return /^Transfer/i.test(e.head) ? 'TED' : 'Outros';
}

function baseline(e) {
  if (e.special === 'nameless') return { flow: 'out', g: 'outros', sub: 'Cobrança sem nome' };
  if (e.card && (e.op === 'PAGAMENTO_FATURA' || e.cat === 'Credit card payment')) return { flow: null, why: 'Pagamento de fatura' };
  if (BILL_HEAD.test(e.head) || e.cat === 'Credit card payment') return { flow: null, why: 'Pagamento de fatura' };
  if (e.card && CARRIED.test(e.name)) return { flow: null, why: 'Já contado na fatura' };
  if (!e.card && (INVEST_OP.test(e.op ?? '') || INVEST_HEAD.test(e.head))) return { flow: null, why: 'Investimento' };
  const g = groupOf(e.cat);
  if (/^Same person/.test(e.cat ?? '')) return { flow: null, why: 'Transferência própria' };
  if (g === null) return { flow: null, why: labelOf(e.cat), soft: true };
  if (!e.card && e.v > 0 && !/^Estorno/i.test(e.head)) return { flow: 'in' };
  // A transfer to a company, or a card purchase, that Pluggy could not name is not "Pessoas".
  const transfer = isTransferCategory(e.cat);
  if (transfer && (e.card || e.who === 'CNPJ')) return { flow: 'out', g: 'outros', sub: 'Sem categoria' };
  return { flow: 'out', g, sub: labelOf(e.cat) };
}

// A card return takes the group of the charge it gives back: same amount, within 15 days.
function matchReturns(list) {
  const charges = list.filter((e) => e.card && e.v < 0 && e.flow === 'out');
  const used = new Set();
  for (const r of list) {
    if (!r.card || r.v <= 0 || r.flow !== 'out') continue;
    const tax = /IOF/i.test(r.name) || r.cat === 'Tax on financial operations';
    const hit = charges.filter((c) => !used.has(c) && Math.abs(c.v + r.v) < 0.005 && Math.abs(daysBetween(c.d, r.d)) <= 15 && c.acc === r.acc && (!tax || c.g === 'taxas'))
      .sort((a, b) => (b.op === 'TARIFA') - (a.op === 'TARIFA') || Math.abs(daysBetween(a.d, r.d)) - Math.abs(daysBetween(b.d, r.d)))[0];
    if (hit) {
      used.add(hit);
      r.g = hit.g;
      r.sub = hit.sub;
      r.returned = true;
    } else if (r.g === 'pessoas' || r.cat === 'Income') {
      r.g = 'outros';
      r.sub = 'Estorno';
    } else r.returned = true;
  }
}

// The statement total can be above the sum of its entries. The gap becomes one dated line.
export function namelessCharges(entries, bills) {
  const out = [];
  const byAcc = new Map();
  for (const b of bills) (byAcc.get(b.acc) ?? byAcc.set(b.acc, []).get(b.acc)).push(b);
  for (const [acc, list] of byAcc) {
    list.sort((a, b) => (a.due < b.due ? -1 : 1));
    const first = entries.filter((e) => e.acc === acc).reduce((m, e) => (e.d < m ? e.d : m), '9999');
    for (let i = 1; i < list.length; i++) {
      const b = list[i], p = list[i - 1];
      if (!b.close || !p.close || p.close < first || daysBetween(p.close, b.close) > 40) continue;
      const rows = entries.filter((e) => e.bill === b.key);
      if (!rows.length) continue;
      const gap = round2(b.total - p.total + rows.reduce((s, e) => s + e.v, 0));
      if (gap < 0.01 || gap > b.total * 0.2) continue;
      out.push({ id: 'n' + b.key, acc, card: true, d: b.close, t: null, v: -gap, head: '', name: 'Cobrança sem nome na fatura', key: NO_NAME_CHARGE, cat: null, op: null, type: 'DEBIT', bill: b.key, special: 'nameless' });
    }
  }
  return out;
}

export function classify(entries, rules = [], bills = []) {
  const list = [...entries, ...namelessCharges(entries, bills)].map((e) => {
    const b = baseline(e);
    return { ...e, flow: b.flow, g: b.g ?? null, sub: b.sub ?? null, why: b.why ?? null, soft: b.soft, pay: payType(e), base: b.g ?? null, baseFlow: b.flow };
  });
  matchReturns(list);
  const map = new Map(rules.map((r) => [r.dir + '|' + r.key, r]));
  for (const e of list) {
    e.base = e.g;
    if (!e.key || (e.flow === null && !(e.soft && e.v < 0))) continue;
    if (e.flow === 'in') {
      const r = map.get('in|' + e.key) ?? (map.get('out|' + e.key)?.treat === 'none' ? map.get('out|' + e.key) : null);
      if (r?.treat === 'none') Object.assign(e, { flow: null, why: 'Regra: não é entrada', rule: r.id });
      continue;
    }
    const r = map.get('out|' + e.key);
    if (!r) continue;
    if (r.treat === 'none') Object.assign(e, { flow: null, why: 'Regra: não é gasto', rule: r.id });
    else Object.assign(e, { flow: 'out', g: r.treat, rule: r.id });
  }
  const when = (e) => e.d + (e.t ?? '') + e.id;
  return list.sort((a, b) => (when(a) < when(b) ? 1 : -1));
}
