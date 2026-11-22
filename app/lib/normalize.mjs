// Turns Pluggy answers into the few fields the app keeps. Everything not listed here is dropped at the
// door: tax ids, owner, addresses, account numbers, limits. Never spread a Pluggy object.
import { createHash } from 'node:crypto';
import { splitDate, round2, norm } from '../web/core/format.mjs';

export const hash = (s, n = 16) => createHash('sha256').update(String(s)).digest('hex').slice(0, n);

const BANKS = { '001': 'Banco do Brasil', '033': 'Santander', '041': 'Banrisul', '077': 'Inter', '102': 'XP', '104': 'Caixa', '208': 'BTG Pactual', '212': 'Original', '237': 'Bradesco', '260': 'Nubank', '290': 'PagBank', '323': 'Mercado Pago', '336': 'C6 Bank', '341': 'Itaú', '380': 'PicPay', '422': 'Safra', '748': 'Sicredi', '756': 'Sicoob' };

// A tax id in any form, whole or masked, never reaches the disk.
// CNPJ before CPF, so that the longer one goes whole; with or without dots, dashes and spaces, glued to a word or not.
const TAX_ID = /(?<![\d•*])[\d•*]{2}[ .-]?[\d•*]{3}[ .-]?[\d•*]{3}[ .\/-]{0,2}[\d•*]{4}[ .-]?[\d•*]{2}(?![\d•*])|(?:[\d•*xX]{3}\.){2}[\d•*xX]{3}-[\d•*xX]{2}|(?<![\d•*])[\d•*]{3}[ .-]?[\d•*]{3}[ .-]?[\d•*]{3}[ .\/-]?[\d•*]{2}(?![\d•*])|[A-Z\d]{2}\.[A-Z\d]{3}\.[A-Z\d]{3}\/[A-Z\d]{4}-\d{2}/g;
export function cleanName(s) {
  return String(s ?? '').replace(/\s+/g, ' ').split(/ - [•*.\d]| ?Ag[êe]ncia:/)[0].replace(TAX_ID, '').replace(/\s+/g, ' ').replace(/^[\s-]+|[\s-]+$/g, '');
}
// "LOJA PASSO" becomes "Loja Passo"; a name already in mixed case is kept.
export function niceName(s) {
  if (!s || s !== s.toUpperCase() || !/[A-ZÀ-Ú]{4}/.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s*/.&-])([a-zà-ú])/g, (_, a, b) => a + b.toUpperCase()).replace(/ (De|Da|Do|Das|Dos|E)(?= )/g, (w) => w.toLowerCase());
}

const HEADS = /^(Transfer[êe]ncia|Valor|Compra|Resgate|Pagamento|Aplica|Estorno|Venda|Dep[óo]sito|Saque|Rendimento|TED|DOC|PIX|Boleto)/i;

export function accountKey(a) {
  return 'a' + hash([a.type, a.subtype, a.bankData?.transferNumber ?? '', a.number ?? '', a.currencyCode].join('|'), 10);
}
export function bankOf(accounts) {
  for (const a of accounts) {
    const compe = String(a.bankData?.transferNumber ?? '').slice(0, 3);
    if (BANKS[compe]) return BANKS[compe];
  }
  const a = accounts.find((x) => x.type === 'BANK') ?? accounts[0];
  return a ? cleanName(a.marketingName || a.name) || 'Banco' : 'Banco';
}
export function account(a, bank, item) {
  const card = a.type === 'CREDIT';
  return { key: accountKey(a), item, type: card ? 'CARD' : 'BANK', bank, label: card ? 'Cartão' : a.subtype === 'SAVINGS_ACCOUNT' ? 'Poupança' : 'Conta corrente', balance: card ? null : round2(a.balance ?? 0) };
}

export function entry(t, accKey, card) {
  const { d, t: time } = splitDate(t.date);
  const meta = t.creditCardMetadata ?? {};
  const inReais = t.amountInAccountCurrency ?? t.amount;
  const foreign = t.amountInAccountCurrency !== null && t.amountInAccountCurrency !== undefined && t.currencyCode !== 'BRL';
  const raw = String(t.description ?? '');
  let head = '', name = '';
  if (card) name = cleanName(raw);
  else if (raw.includes('|')) {
    head = cleanName(raw.split('|')[0]);
    name = cleanName(raw.split('|').slice(1).join(' '));
  } else if (HEADS.test(raw)) head = cleanName(raw);
  else name = cleanName(raw);
  const kind = t.type === 'DEBIT' ? t.paymentData?.receiver : t.paymentData?.payer;
  return {
    id: '', acc: accKey, card: card || undefined, d, t: time,
    v: round2(card ? -inReais : t.amount < 0 && t.type === 'CREDIT' ? -t.amount : t.type === 'DEBIT' ? -Math.abs(t.amount) : t.amount),
    head, name: niceName(name), key: norm(name), cat: t.category ?? null, op: t.operationType ?? null, type: t.type,
    pend: t.status === 'PENDING' || undefined,
    who: kind?.documentNumber?.type ?? undefined, // only whether it is a person or a company, never the number
    inst: meta.totalInstallments ? [Number(meta.installmentNumber), Number(meta.totalInstallments)] : undefined,
    bought: meta.purchaseDate ? splitDate(meta.purchaseDate).d : undefined,
    bill: meta.billId ? 'b' + hash(meta.billId, 10) : undefined,
    cur: foreign ? t.currencyCode : undefined, orig: foreign ? round2(Math.abs(t.amount)) : undefined,
  };
}
// The app's own id: made of what the entry is, never of Pluggy's id, which changes near the closing.
export function withIds(entries) {
  const seen = new Map();
  for (const e of entries) {
    const base = [e.acc, e.d, e.t ?? '', e.v, e.key || norm(e.head), e.inst?.[0] ?? ''].join('|');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    e.id = 'e' + hash(base + '|' + n, 14);
  }
  return entries;
}
export function bill(b, accKey) {
  return {
    key: 'b' + hash(b.id, 10), acc: accKey, due: splitDate(b.dueDate).d, close: b.billClosingDate ? splitDate(b.billClosingDate).d : null,
    total: round2(b.totalAmount), paid: (b.payments ?? []).map((p) => ({ d: splitDate(p.paymentDate).d, v: round2(p.amount) })),
  };
}
const KINDS = { CDB: 'CDB', TREASURY: 'Tesouro Direto', LCI: 'LCI', LCA: 'LCA', CRI: 'CRI', CRA: 'CRA', DEBENTURES: 'Debênture', INVESTMENT_FUND: 'Fundo', STOCK_FUND: 'Fundo de ações', MULTIMARKET_FUND: 'Fundo multimercado', FIXED_INCOME_FUND: 'Fundo de renda fixa', ETF: 'ETF', STOCK: 'Ação', BDR: 'BDR', REAL_ESTATE_FUND: 'Fundo imobiliário', PGBL: 'PGBL', VGBL: 'VGBL' };
const TYPES = { FIXED_INCOME: 'Renda fixa', MUTUAL_FUND: 'Fundo', EQUITY: 'Renda variável', ETF: 'ETF', SECURITY: 'Previdência', COE: 'COE' };
export function investment(i, bank, item) {
  const kind = KINDS[i.subtype] ?? TYPES[i.type] ?? 'Investimento';
  return {
    key: 'i' + hash(i.id, 10), item, bank, kind, name: niceName(cleanName(i.name)) || kind, balance: round2(i.balance ?? 0),
    rate: i.rate ? round2(i.rate) : undefined, index: i.rateType ?? undefined, fixed: i.fixedAnnualRate ?? undefined,
    due: i.dueDate ? splitDate(i.dueDate).d : undefined, date: i.date ? splitDate(i.date).d : undefined,
  };
}
export const movement = (m) => ({ d: splitDate(m.date).d, v: round2(Math.abs(m.netAmount ?? m.amount ?? 0)), out: m.movementType === 'DEBIT' || m.type === 'SELL' });
