// Money, dates and words. Brasília time is fixed at GMT-3 (no daylight saving since 2019).
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const WEEK = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const NB = ' ';
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const digits = (n) => Math.abs(round2(n)).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// With hide on, the amount becomes dots and the sign stays.
export const reais = (n, hide = false) => 'R$' + NB + (hide ? '••••' : digits(n));

export const localDate = (iso) => new Date(new Date(iso).getTime() - 3 * 36e5).toISOString();
// Exactly 00:00:00.000 UTC means the bank sent a day with no time: it must not move to the day before.
export function splitDate(iso) {
  const s = new Date(iso).toISOString();
  if (s.slice(11) === '00:00:00.000Z') return { d: s.slice(0, 10), t: null };
  const l = localDate(s);
  return { d: l.slice(0, 10), t: l.slice(11, 19) === '00:00:00' ? null : l.slice(11, 16) };
}
export const today = (now) => localDate(now ?? Date.now()).slice(0, 10);
export const monthOf = (d) => d.slice(0, 7);
export const dayOf = (d) => +d.slice(8, 10);
export function addMonths(m, n) {
  const i = +m.slice(0, 4) * 12 + +m.slice(5, 7) - 1 + n;
  return Math.floor(i / 12) + '-' + String((i % 12) + 1).padStart(2, '0');
}
export const daysIn = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
export const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
export const weekdayOf = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
export const monthName = (m) => MONTHS[+m.slice(5, 7) - 1];
export const monthShort = (m) => monthName(m).slice(0, 3);
export const cap = (s) => s[0].toUpperCase() + s.slice(1);
// "novembro" in the current year, "novembro de 2025" in another.
export const monthIn = (m, ref) => monthName(m) + (ref && ref.slice(0, 4) !== m.slice(0, 4) ? ' de ' + m.slice(0, 4) : '');
export const dayLong = (d, ref) => dayOf(d) + ' de ' + monthIn(d.slice(0, 7), ref);
export const dayShort = (d) => dayOf(d) + ' ' + monthShort(d);
export const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
// Change against another month, always in words.
export const diff = (d, hide) => (Math.abs(d) < 0.005 ? 'igual' : reais(d, hide) + (d > 0 ? ' a mais' : ' a menos'));
// Change in percent, as [what, against what]. With no base, or with a return bigger than the spending, there is no percent.
export function change(a, b, hide, none = 'nada') {
  const tail = 'em relação ao mês anterior';
  if (Math.abs(a - b) < 0.005) return ['Igual', 'ao mês anterior'];
  if (Math.abs(b) < 0.005) return ['', `${none} no mês anterior`];
  if (a < 0 || b < 0) return [diff(a - b, hide), tail];
  const p = Math.round(((a - b) / b) * 100);
  if (p === 0) return ['Quase igual', 'ao mês anterior'];
  if (p >= 1000) return [`${Math.round(a / b)} vezes`, 'o valor do mês anterior'];
  return [`${Math.abs(p)}% ${p > 0 ? 'a mais' : 'a menos'}`, tail];
}
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const ago = (d, ref) => {
  const n = daysBetween(d, ref);
  return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : 'há ' + n + ' dias';
};
