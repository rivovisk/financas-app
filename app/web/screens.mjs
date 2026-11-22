// The pages, as text. Each function receives the app (x) and returns HTML. Every value from the bank goes
// through esc().
import { GROUPS, groupName } from './core/categories.mjs';
import { layout } from './core/balls.mjs';
import * as V from './core/views.mjs';
import { NB, WEEK, ago, cap, change, dayLong, dayOf, dayShort, daysBetween, daysIn, diff, esc, localDate, monthIn, monthName, monthOf, monthShort, plural, reais, round2, weekdayOf } from './core/format.mjs';

// ---- small pieces ----------------------------------------------------------------------------
const svg = (size, box, path, extra = '') => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 ${box} ${box}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"${extra}>${path}</svg>`;
export const ICON = {
  x: svg(18, 18, '<path d="M4 4l10 10M14 4L4 14"/>'), xs: svg(14, 18, '<path d="M4 4l10 10M14 4L4 14"/>'),
  back: svg(20, 18, '<path d="M11 4L6 9l5 5"/>'), find: svg(20, 20, '<circle cx="9" cy="9" r="6"/><path d="M14 14l4 4"/>'),
  eye: svg(22, 24, '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: svg(22, 24, '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20L20 4"/>'),
  gear: svg(22, 24, '<path d="M3 7h10M19 7h2M3 17h2M11 17h10"/><circle cx="16" cy="7" r="3"/><circle cx="8" cy="17" r="3"/>'),
  prev: svg(20, 20, '<path d="M12 4l-6 6 6 6"/>'), next: svg(20, 20, '<path d="M8 4l6 6-6 6"/>'), down: svg(14, 18, '<path d="M4 7l5 5 5-5"/>'),
  list: svg(20, 20, '<path d="M7.5 5h10M7.5 10h10M7.5 15h10M3 5h.01M3 10h.01M3 15h.01"/>'), balls: svg(20, 20, '<circle cx="7.5" cy="8" r="5"/><circle cx="15.2" cy="13.4" r="2.8"/><circle cx="8.2" cy="16.4" r="1.6"/>'),
  inicio: svg(22, 24, '<path d="M4 11l8-7 8 7v8.5a1 1 0 0 1-1 1h-4.5V14h-5v6.5H5a1 1 0 0 1-1-1z"/>'), extrato: svg(22, 24, '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2zM9.5 8.5h5M9.5 12.5h5"/>'),
  patrimonio: svg(22, 24, '<path d="M4 4v16h16"/><path d="M8 15l3.5-4 3 2.5L20 7.5"/>'), faturas: svg(22, 24, '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 14.5h3"/>'),
  go: '<svg class="fin-go" aria-hidden="true" viewBox="0 0 18 18"><path d="M7 4l5 5-5 5"/></svg>',
};
export const color = (g) => (GROUPS.some((o) => o.id === g) ? `var(--cat-${g})` : 'var(--muted)'); // a group may come from the address
export const dot = (c) => `<span class="fin-dot" style="--c:${c}"></span>`;
const OFF = '<span class="fin-dot is-off"></span>';

// Money: the sign and the colour always go together.
export const outText = (x, a) => (a >= -0.004 ? '−' : '+') + NB + reais(a, x.hide);
export const inText = (x, a) => (a >= -0.004 ? '+' : '−') + NB + reais(a, x.hide);
export const entryText = (x, e) => (e.v < 0 ? '−' : '+') + NB + reais(e.v, x.hide);
export const entryClass = (e) => (e.flow === null ? 'fin-muted' : e.v < 0 ? 'fin-out' : 'fin-in');
const short = (x, s) => (x.phone ? s.replace('R$' + NB, '') : s);
const money = (cls, s) => `<span class="fin-money ${cls}">${s}</span>`;

export function pick({ id, label, aria, value, options, set }) {
  return `<span class="pick fin-btn fin-btn-2${set ? ' is-set' : ''}"><span aria-hidden="true">${esc(label)}</span><select id="${id}" data-pick="${id}" aria-label="${esc(aria)}">${options.map(([v, n]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></span>`;
}
export const accName = (a) => `${a.bank}, ${a.label.toLowerCase()}${a.twin ? ' ' + a.twin : ''}`;

// A filter that takes more than one: a pill that opens a list of boxes. on: null (all) or the list of chosen values.
export const many = (v) => (v === undefined || v === null || v === '' ? null : v === '-' ? [] : String(v).split(','));
function multi(x, { k, label, aria, all, options, on, set }) {
  const open = x.menu === k, has = (v) => !on || on.includes(v), full = options.every(([v]) => has(v)), some = !full && options.some(([v]) => has(v));
  const tick = (id, v, n, checked, extra = '') => `<label class="tick"><input type="checkbox" id="tk-${k}-${esc(id)}" data-tick="${k}" value="${esc(v)}"${checked ? ' checked' : ''}${extra}><span>${n}</span></label>`;
  return `<span class="multi"><button type="button" class="fin-btn fin-btn-2${set ? ' is-set' : ''}" id="m-${k}" data-act="menu" data-v="${k}" aria-expanded="${open}"><span class="cutoff">${esc(label)}</span>${ICON.down}</button>${open ? `<div class="menu" id="menu-${k}" role="group" aria-label="${esc(aria)}">${tick('all', '*', all, full, some ? ' data-some="1"' : '')}<hr>${options.map(([v, n, c]) => tick(v, v, (c ? dot(c) : '') + esc(n), has(v))).join('')}<button type="button" class="fin-btn menu-ok" data-act="menu" data-v="${k}">Pronto</button></div>` : ''}</span>`;
}
const said = (names, unit, none) => (!names.length ? none : names.length === 1 ? names[0] : names.length === 2 && names.join().length < 24 ? names.join(' e ') : `${names.length} ${unit}`);
function accPick(x, extra = []) {
  const options = [...x.accounts.map((a) => [a.key, accName(a), x.phone ? a.label : accName(a)]), ...extra.map(([v, n]) => [v, n, n])];
  const label = !x.acc ? (x.phone ? 'Todas' : 'Todas as contas') : said(options.filter(([v]) => x.acc.includes(v)).map((o) => o[2]), 'contas', x.phone ? 'Nenhuma' : 'Nenhuma conta');
  return multi(x, { k: 'a', label, aria: 'Conta', all: 'Selecionar todas', on: x.acc, set: !!x.acc, options: options.map(([v, n]) => [v, n]) });
}
function monthPick(x, all) {
  const m = x.month === 'all' ? null : x.month;
  const label = !m ? (x.phone ? 'Todos' : 'Todos os meses') : x.phone ? cap(monthName(m)) : cap(monthName(m)) + ' de ' + m.slice(0, 4);
  return pick({ id: 'p-month', label, aria: 'Mês', value: x.month, set: true, options: [...(all ? [['all', 'Todos os meses']] : []), ...x.months.slice().reverse().map((k) => [k, cap(monthName(k)) + ' de ' + k.slice(0, 4)])] });
}
const eye = (x) => x.phone
  ? `<button type="button" class="fin-icon" data-act="hide" aria-pressed="${x.hide}" aria-label="Esconder valores">${x.hide ? ICON.eyeOff : ICON.eye}</button>`
  : `<button type="button" class="fin-btn fin-btn-2" data-act="hide" aria-pressed="${x.hide}">${x.hide ? 'Mostrar valores' : 'Esconder valores'}</button>`;
const gear = (x) => (x.phone ? `<a class="fin-icon" href="${x.link('ajustes')}" aria-label="Ajustes">${ICON.gear}</a>` : '');

export function age(x, brief) {
  if (x.job.running) return 'Atualizando';
  if (!x.readDay) return '';
  if (x.trouble) return `Dados de ${dayShort(x.readDay)}${x.readDay.slice(0, 4) !== x.today.slice(0, 4) ? ' ' + x.readDay.slice(0, 4) : ''}${x.readDay === x.today ? '' : ', ' + ago(x.readDay, x.today)}`;
  return `${brief ? '' : 'Atualizado '}${ago(x.readDay, x.today)}, ${x.readTime}`;
}
function topBar(x, { month, all, back, extra } = {}) {
  if (x.phone) {
    return `<div class="top">${back ? `<a class="fin-icon" href="${x.link('inicio')}" aria-label="Voltar ao Início" style="margin-left:-12px">${ICON.back}</a>` : ''}${month ? monthPick(x, all) : ''}${accPick(x, extra)}${month ? '<span class="grow"></span>' : `<span class="fin-small age">${age(x, true)}</span>`}${eye(x)}${back ? '' : gear(x)}</div>${month && !back ? `<p class="age-line">${age(x)}</p>` : ''}`;
  }
  return `<div class="top">${month ? monthPick(x, all) : ''}${accPick(x, extra)}<span class="grow"></span><span class="fin-small">${age(x)}</span>${eye(x)}</div>`;
}
export function notice(x) {
  const n = x.notice;
  if (!n) return '';
  return `<div class="fin-notice" role="status"><p><b>${esc(n.t)}</b> ${esc(n.d)}</p>${n.a ? (n.href ? `<a class="fin-btn" href="${n.href}">${esc(n.a)}</a>` : `<button type="button" class="fin-btn" data-act="${n.act ?? 'refresh'}">${esc(n.a)}</button>`) : ''}<button type="button" class="fin-icon" data-act="close-note" aria-label="Fechar aviso">${ICON.x}</button></div>`;
}
const PLACES = [['inicio', 'Início'], ['extrato', 'Extrato'], ['patrimonio', 'Patrimônio'], ['faturas', 'Faturas']];
export function shell(x, here, html, kind = '') {
  const a = (icon) => ([id, n]) => `<a href="${x.link(id)}"${id === here ? ' aria-current="page"' : ''}>${icon ? ICON[id] ?? ICON.gear : ''}${n}</a>`;
  return `<div class="page"><nav class="fin-side" aria-label="Áreas">${[...PLACES, ['ajustes', 'Ajustes']].map(a(true)).join('')}</nav><main class="main ${kind}">${html}</main></div>${x.phone ? `<div class="dock-wrap"><nav class="fin-dock" aria-label="Áreas">${PLACES.map(a(false)).join('')}</nav></div>` : ''}`;
}
// Months as bars, over the whole history. Each bar carries its amount, so a cut bar still says how much it is.
const inBrief = (x, v, flow) => {
  const n = x.hide ? '••••' : Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1).replace('.', ',') + NB + 'mil' : String(Math.round(Math.abs(v)));
  const minus = flow === 'out' ? v > 0.004 : flow === 'in' ? v < -0.004 : false;
  return flow === 'all' || Math.abs(v) < 0.005 ? n : (minus ? '−' : '+') + NB + n;
};
const slide = (id, dir) => `<button type="button" class="fin-icon" id="${id}-${dir < 0 ? 'prev' : 'next'}" data-act="slide" data-for="${id}" data-dir="${dir}" aria-label="${dir < 0 ? 'Ver meses anteriores' : 'Ver meses seguintes'}">${dir < 0 ? ICON.prev : ICON.next}</button>`;
function monthChart(x, { id, rows, flow, tall, to, tone, soft = tone, verb }) {
  const sc = V.barScale(rows.map((r) => r.v)), cuts = rows.some((r) => r.v > sc.cut);
  const bar = ({ m, v }) => {
    const cut = v > sc.cut, h = v > 0.004 ? (cut ? tall : Math.max(4, Math.round((v / sc.top) * tall))) : 0, now = !!to && m === x.month;
    const in_ = `<small class="${flow === 'out' ? (v < -0.004 ? 'fin-in' : 'fin-out') : flow === 'in' ? (v < -0.004 ? 'fin-out' : 'fin-in') : ''}">${inBrief(x, v, flow)}</small><i${cut ? ' class="is-cut"' : ''} style="height:${h}px;--c:${now ? tone : soft}"></i><b>${monthShort(m)}${m.slice(0, 4) === x.today.slice(0, 4) ? '' : ' ' + m.slice(2, 4)}</b>`;
    const says = `aria-label="${esc(`${monthName(m)} de ${m.slice(0, 4)}${verb ? ', ' + verb : ''} ${reais(v, x.hide)}`)}"`;
    return to ? `<a href="${to(m)}" data-m="${m}"${now ? ' aria-current="true"' : ''} ${says}>${in_}</a>` : `<button type="button" data-month="${m}" data-m="${m}" ${says}>${in_}</button>`;
  };
  return { body: `<div class="mc" id="${id}">${rows.map(bar).join('')}</div>`, note: cuts ? 'Barra cortada: o mês passa muito da escala dos outros.' : '' };
}
const seg = (x, on) => `<div class="fin-seg seg-full" role="group" aria-label="O que ver">${[['out', 'Saídas'], ['in', 'Entradas'], ['mes', 'Mês a mês']].map(([v, n]) => `<a href="${x.link('inicio', { v: v === 'out' ? null : v })}"${v === on ? ' aria-current="true"' : ''}>${n}</a>`).join('')}</div>`;

// ---- Início ----------------------------------------------------------------------------------
export function inicio(x) {
  const view = x.route.q.v === 'in' ? 'in' : 'out', out = view === 'out';
  if (x.route.q.v === 'mes') return mes(x);
  const s = V.summary(x.entries, x);
  const rows = out ? V.groupTotals(s) : V.payerTotals(s);
  const off = x.off[view], prev = monthIn(s.p.prev.month, x.today), here = monthName(x.month);
  const say = V.sentence(s, rows, off, view, x.today, x.hide);
  const paint = (r) => out ? [color(r.id), `var(--on-cat-${r.id})`] : [['--in', '--in-2', '--in-3'][r.tone], ['--on-in', '--on-in-2', '--on-in-3'][r.tone]].map((n) => `var(${n})`);
  const to = (r) => x.link('extrato', out ? { f: 'out', g: r.id } : r.key !== null ? { f: 'in', k: r.key || null } : { f: 'in' });
  const vis = rows.filter((r) => !off.includes(r.id)), gone = rows.filter((r) => off.includes(r.id));
  const word = out ? 'saiu' : 'entrou', sign = out ? 'fin-out' : 'fin-in', txt = out ? outText : inText;
  const list = out ? s.out : s.in;
  const balls = () => {
    const W = Math.min(x.inner, 1180), L = layout(vis.filter((r) => r.a > 0.004).map((r) => ({ ...r, n: r.name })), W, x.phone ? Math.round(W * 1.25) : 480);
    return `<div class="balls" style="width:${L.w}px;height:${L.h}px">${L.balls.map((r) => { const [c, t] = paint(r), says = esc(`${r.n}, ${word} ${reais(r.a, x.hide)}`); return `<a class="fin-ball" href="${to(r)}" aria-label="${says}" title="${says}" style="left:${r.left}px;top:${r.top}px;width:${r.d}px;height:${r.d}px;--c:${c};--t:${t};font-size:${r.fs}px">${r.lines.map(esc).join('<br>')}</a>`; }).join('')}</div>${gone.length ? `<p class="fin-small" style="margin:12px 0 0;text-align:center">Fora da comparação: ${esc(gone.map((r) => r.name).join(', '))}.</p>` : ''}`;
  };
  const catRow = (r) => {
    const on = !off.includes(r.id), [c] = paint(r), [what, tail] = change(r.a, r.b, x.hide, out ? 'nenhum gasto' : 'nenhuma entrada');
    const delta = !on ? (x.phone ? 'fora da comparação' : 'fora da comparação, dentro do total') : s.comparable ? `${what}${what ? ' ' : ''}<span class="tail">${tail}</span>` : '';
    return `<div class="cat-row"><button type="button" class="flip" id="flip-${r.id}" data-act="flip" data-v="${r.id}" aria-pressed="${on}" aria-label="${esc((on ? `Tirar ${r.name} da comparação` : `Trazer ${r.name} de volta`))}"><i style="border-color:${on ? c : 'var(--edge)'};background:${on ? c : 'var(--paper)'}"></i></button><a href="${to(r)}"><span><span class="med">${esc(r.name)}</span> <small>${delta}</small></span>${money(on ? (r.a < -0.004 ? (out ? 'fin-in' : 'fin-out') : sign) : 'fin-muted', short(x, txt(x, r.a)))}${ICON.go}</a></div>`;
  };
  const cats = !list.length
    ? `<div class="empty">${svg(x.phone ? 120 : 132, 132, '<circle cx="66" cy="66" r="64" stroke="var(--edge)" stroke-width="1.5"/>')}<p>${esc(say.h)}</p><a class="fin-link" href="${x.link('inicio', { v: out ? null : 'in' }, { m: s.p.prev.month })}">Ver ${prev}</a></div>`
    : x.balls ? balls() : `<div class="cat-list">${[...vis, ...gone].map(catRow).join('')}</div>`;
  const how = !list.length ? '' : x.balls ? `Quanto maior o círculo, mais ${word}. A diferença de tamanho é suavizada.` : `${s.comparable ? `Comparado com ${s.p.open ? `1 a ${dayOf(s.p.prev.to)} de ${prev}` : `${prev} inteiro`}. ` : ''}Toque na cor para tirar da comparação.`;
  const eyes = !list.length ? '' : `<div class="fin-seg views" role="group" aria-label="Como ver">${[['list', 'Ver em lista'], ['balls', 'Ver em círculos']].map(([v, n]) => `<button type="button" id="view-${v}" data-act="view" data-v="${v}" aria-pressed="${(v === 'balls') === x.balls}" aria-label="${n}" title="${n}">${ICON[v]}</button>`).join('')}</div>`;
  const chart_ = monthChart(x, { id: 'mc-inicio', flow: view, tall: x.phone ? 130 : 150, verb: word, tone: `var(--${view})`, soft: `var(--${view}-soft)`, to: (m) => x.link('inicio', { v: out ? null : 'in' }, { m }), rows: x.months.map((m) => ({ m, v: V.monthTotal(x.entries, m, { ...x, flow: view }) })) });
  const three = !list.length && x.months.length < 2 ? '' : `<div class="trio sect">
    ${list.length ? `<section><h2 class="fin-h2">${out ? 'Como o dinheiro saiu' : 'Como o dinheiro entrou'}</h2>${V.byPay(list, out).map((t) => `<a class="line" href="${x.link('extrato', { f: view, p: t.n })}"><span>${t.n}</span>${money(sign, short(x, txt(x, t.v)))}${ICON.go}</a>`).join('')}</section>` : ''}
    <section><div class="h-arrows"><h2 class="fin-h2">${out ? 'Saídas' : 'Entradas'}, mês a mês</h2><span>${slide('mc-inicio', -1)}${slide('mc-inicio', 1)}</span></div>${chart_.body}${chart_.note ? `<p class="fin-small" style="margin:8px 0 0">${chart_.note}</p>` : ''}</section>
    ${list.length ? `<section><h2 class="fin-h2">${out ? 'Maiores saídas' : 'Maiores entradas'}</h2>${V.largest(list).map((e) => `<a class="line" href="${x.over({ e: e.id })}"><span><span class="med">${esc(e.name || e.head)}</span> <small>${e.pay}, ${dayShort(e.d)}</small></span>${money(sign, short(x, entryText(x, e)))}${ICON.go}</a>`).join('')}</section>` : ''}</div>`;
  const span = s.p.open ? `De 1 a ${dayOf(s.p.to)} de ${here}` : `${cap(here)} inteiro`;
  const left = round2(s.got - s.spent);
  return shell(x, 'inicio', `${topBar(x, { month: true })}${notice(x)}
  <div class="head"><section class="fin-sum" aria-label="Entrou, saiu e sobra"><div><span>Entrou</span><b class="fin-in">${inText(x, s.got)}</b></div><div><span>Saiu</span><b class="fin-out">${outText(x, s.spent)}</b></div><hr><div><span>Sobra</span><b>=${NB}${left < -0.004 ? '−' + NB : ''}${reais(left, x.hide)}</b></div></section>
  <div class="head-say"><h1 class="fin-say">${esc(say.h)} <span>${esc(say.s)}</span></h1><p>${span}${s.comparable ? `, contra ${s.p.open ? 'os mesmos dias de ' : ''}${prev}${s.p.open ? '' : ' inteiro'}` : ''}.</p></div></div>
  <section class="sect is-plain" aria-label="Categorias"><div class="cat-head">${x.phone ? seg(x, view) : ''}<div><div class="title-line"><h2 class="fin-h1">${out ? 'Para onde o seu dinheiro saiu' : 'De onde o seu dinheiro veio'}</h2>${eyes}</div>${how ? `<p>${how}</p>` : ''}</div>${x.phone ? '' : seg(x, view)}</div>${cats}</section>${three}`);
}

// ---- Mês a mês -------------------------------------------------------------------------------
const mix = (c, p) => `color-mix(in srgb, ${c} ${p}%, var(--paper))`;
function mes(x) {
  const s = V.summary(x.entries, x), six = V.monthsAround(x.months, x.month, 6), prev = monthIn(s.p.prev.month, x.today);
  const cards = GROUPS.map((g) => ({ ...g, bars: six.map((m) => V.monthTotal(x.entries, m, { ...x, g: g.id })), now: V.spent(s.out.filter((e) => e.g === g.id)), b: V.spent(s.oldOut.filter((e) => e.g === g.id)) }))
    .filter((g) => g.bars.some((v) => Math.abs(v) > 0.004)).sort((a, b) => b.now - a.now);
  const H = x.phone ? 62 : 90;
  const card = (g) => {
    const sc = V.barScale(g.bars), high = (v) => (v > sc.cut ? H : Math.max(5, Math.round((v / sc.top) * H)));
    const d = !s.comparable ? '' : Math.abs(g.now - g.b) < 0.005 ? `Igual a ${prev}` : diff(g.now - g.b, x.hide);
    return `<a class="fin-card" href="${x.link('extrato', { f: 'out', g: g.id })}" style="--c:${color(g.id)};--cb:${mix(color(g.id), x.phone ? 8 : 11)};background:var(--cb)"><span class="card-n">${dot(color(g.id))}${g.name}</span><span class="card-v fin-money ${g.now < -0.004 ? 'fin-in' : 'fin-out'}">${short(x, outText(x, g.now))}</span><span class="card-d">${d}</span><span class="grow"></span><span class="card-b">${g.bars.map((v, i) => `<span><i${v > sc.cut ? ' class="is-cut"' : ''} style="height:${v > 0.004 ? high(v) : 0}px;background:${six[i] === x.month ? color(g.id) : mix(color(g.id), 45)}"></i>${x.phone ? monthName(six[i])[0] : monthShort(six[i])}</span>`).join('')}</span></a>`;
  };
  const left = round2(s.got - s.spent);
  const C = monthChart(x, { id: 'mc-mes', flow: 'out', tall: x.phone ? 130 : 170, verb: 'saíram', tone: 'var(--out)', soft: 'var(--out-soft)', to: (m) => x.link('inicio', { v: 'mes' }, { m }), rows: x.months.map((m) => ({ m, v: V.monthTotal(x.entries, m, x) })) });
  const head = `<div><h1 class="fin-h1">Saídas, mês a mês</h1><p class="${x.phone ? 'fin-small' : 'lead'}" style="margin:6px 0 0">Toque em um mês para ver as categorias dele.</p></div>`;
  const cardsHead = `<div><h2 class="fin-h2">Categorias, de ${monthIn(six[0], x.today)} a ${monthIn(six[5], x.today)}</h2>${x.phone ? '<p class="fin-small" style="margin:4px 0 0">Cada cartão usa a própria escala.</p>' : ''}</div>`;
  const span = s.p.open ? `1 a ${dayOf(s.p.to)} de ${monthName(x.month)} com 1 a ${dayOf(s.p.prev.to)} de ${prev}` : `${monthName(x.month)} com ${prev}`;
  return shell(x, 'inicio', `${topBar(x, { month: x.phone })}${notice(x)}${x.phone ? seg(x, 'mes') + head : `<div class="cat-head" style="margin:0">${head}${seg(x, 'mes')}</div>`}
  <div><div class="mc-side">${slide('mc-mes', -1)}${C.body}${slide('mc-mes', 1)}</div>${C.note ? `<p class="fin-small" style="margin:8px 0 0">${C.note}</p>` : ''}</div>
  ${cards.length ? `${cardsHead}<div class="cards">${cards.map(card).join('')}${x.phone ? '' : `<section class="card-sum"><h2>${cap(monthName(x.month))}${s.p.open ? ` até o dia ${dayOf(s.p.to)}` : ''}</h2><div class="fin-money"><p style="margin:0"><span>Entrou</span><b class="fin-in">${inText(x, s.got)}</b></p><p style="margin:0"><span>Saiu</span><b class="fin-out" style="font-weight:600">${outText(x, s.spent)}</b></p><p style="margin:0"><span>Sobra</span><b>=${NB}${left < -0.004 ? '−' + NB : ''}${reais(left, x.hide)}</b></p></div></section>`}</div>` : `<div class="empty"><p>Nenhum gasto nesses meses.</p></div>`}
  <p class="fin-small" style="margin:0">${x.phone ? '' : 'Cada cartão usa a própria escala, então as barras de um cartão não se comparam com as de outro. Barra cortada passa muito da escala. '}${s.comparable ? `"A mais" e "a menos" comparam ${span}.` : ''}</p>`, 'is-mes');
}

// ---- Extrato ---------------------------------------------------------------------------------
const FLOWS = { out: 'Saídas', in: 'Entradas', none: 'Não contam' };
const DAY = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
export function readFilters(x) {
  const q = x.route.q, card = q.b && q.b.startsWith('open-') ? q.b.slice(5) : null;
  const raw = q.f ?? (q.b ? 'all' : 'out'), flows = Object.keys(FLOWS).filter((k) => raw === 'all' || many(raw).includes(k));
  let g = many(q.g)?.filter((k) => GROUPS.some((o) => o.id === k)) ?? null; // only groups that exist
  if (g && !g.length && q.g !== '-') g = null;
  const f = { acc: x.acc, month: x.month, flows, flow: flows.length === 3 ? 'all' : flows.length === 1 ? flows[0] : flows, g, sub: q.s, pay: many(q.p), key: q.k, q: q.q, min: +q.min || 0, max: +q.max || 0, day: DAY.test(q.d ?? '') ? q.d : undefined, bill: card ? 'open' : q.b };
  if (card) f.openIds = new Set(x.cards.find((c) => c.account.key === card)?.charges.map((e) => e.id) ?? []);
  return f;
}
export function extrato(x) {
  const q = x.route.q, f = readFilters(x), has = (k) => f.flows.includes(k);
  const g1 = f.g?.length === 1 ? f.g[0] : null, groups = f.g && GROUPS.filter((g) => f.g.includes(g.id)).map((g) => g.name);
  const flowName = f.flow === 'all' ? 'Tudo' : cap(f.flows.map((k) => FLOWS[k].toLowerCase()).join(' e ') || 'nada marcado');
  const cut = V.filter(x.entries, { ...f, day: null, sub: null }, x.today);
  const sub = f.sub ? cut.filter((e) => (g1 ? e.sub : e.g) === f.sub) : cut;
  const list = f.day ? sub.filter((e) => e.d === f.day) : sub;
  const one = f.flow === 'in' ? 'entrada' : f.flow === 'out' ? 'gasto' : 'lançamento', many = one + 's';
  const named = f.key && x.entries.find((e) => e.key === f.key)?.name;
  const bill = f.bill && f.bill !== 'open' ? x.cards.flatMap((c) => c.closed).find((b) => b.key === f.bill) : null;
  const title = f.bill ? (bill ? `Fatura de ${monthIn(bill.month, x.today)}` : 'Fatura aberta') : named || (groups ? said(groups, 'categorias', 'Nenhuma categoria') : flowName);
  const O = V.spent(list.filter((e) => e.flow === 'out')), I = V.sum(list.filter((e) => e.flow === 'in'));
  let total;
  if (f.bill) total = `<p class="fin-money fin-out big">${outText(x, V.spent(list))}</p>`;
  else if (f.flow === 'in') total = `<p class="fin-money fin-in big">${inText(x, I)}</p>`;
  else if (f.flow === 'out') total = `<p class="fin-money ${O < -0.004 ? 'fin-in' : 'fin-out'} big">${outText(x, O)}</p>`;
  else if (f.flow === 'none') total = `<p class="fin-money fin-muted big">${reais(round2(list.reduce((s, e) => s + Math.abs(e.v), 0)), x.hide)}</p>`;
  else total = `${has('in') ? `<p class="fin-money fin-in big" style="margin-bottom:8px">${inText(x, I)}</p>` : ''}${has('out') ? `<p class="fin-money fin-out big">${outText(x, O)}</p>` : ''}`;
  // Change against the month before, for the whole cut.
  let change = '';
  if (x.month !== 'all' && !f.bill && (f.flow === 'out' || f.flow === 'in') && !f.day && !f.sub) {
    const s = V.summary(x.entries, x);
    if (s.comparable) {
      const old = V.filter(x.entries, { ...f, month: s.p.prev.month, day: null, sub: null }, x.today).filter((e) => e.d <= s.p.prev.to);
      const d = f.flow === 'in' ? I - V.sum(old) : O - V.spent(old);
      change = ` No mês, ${Math.abs(d) < 0.005 ? 'igual a ' + monthIn(s.p.prev.month, x.today) : diff(d, x.hide) + ' que em ' + monthIn(s.p.prev.month, x.today)}.`;
    }
  }
  // Chips: subcategories inside a group, groups otherwise.
  const by = new Map();
  for (const e of cut) {
    const k = g1 ? e.sub : f.flow === 'in' ? null : e.g;
    if (k) by.set(k, round2((by.get(k) ?? 0) + e.v));
  }
  const chips = [...by].sort((a, b) => a[1] - b[1]).slice(0, 14);
  const chip = ([k, v]) => `<button type="button" class="fin-btn fin-btn-2" id="chip-${esc(k)}" data-set="s" data-v="${esc(f.sub === k ? '' : k)}" aria-pressed="${f.sub === k}">${g1 ? '' : dot(color(k))}${esc(g1 ? k : groupName(k))} ${money('', ((v < 0 ? '−' : '+') + NB + reais(v, x.hide)))}</button>`;

  const tone = g1 ? color(g1) : f.flow === 'in' ? 'var(--in)' : f.flow === 'out' ? 'var(--out)' : 'var(--ink)';
  let map = '';
  if (x.month !== 'all' && !f.bill) {
    const n = daysIn(x.month), D = Array.from({ length: n }, (_, i) => x.month + '-' + String(i + 1).padStart(2, '0'));
    const amount = (d) => Math.abs(round2(sub.filter((e) => e.d === d).reduce((s, e) => s + (f.flow === 'out' ? -e.v : f.flow === 'in' ? e.v : Math.abs(e.v)), 0)));
    const A = D.map(amount), most = x.phone ? 38 : Math.min(66, Math.floor(((x.inner >= 976 ? 520 + (x.inner - 976) / 2 : x.inner) - 144) / 7)), k = Math.min(most / 10, most / Math.sqrt(Math.max(1, ...A)));
    const at = x.months.indexOf(x.month), turn = (m, id, icon) => `<button type="button" class="fin-icon" id="${id}" data-set="m" data-v="${m ?? ''}" aria-label="${m ? `Ver ${monthName(m)} de ${m.slice(0, 4)}` : 'Não há outro mês'}"${m ? '' : ' disabled'}>${icon}</button>`;
    const before = turn(x.months[at - 1], 'cal-prev', ICON.prev), after = turn(x.months[at + 1], 'cal-next', ICON.next);
    const verb = f.flow === 'in' ? 'entrou' : f.flow === 'out' ? 'saiu' : 'passou';
    map = `<div class="cal-side">${before}${x.phone ? `<b class="med">${cap(monthName(x.month))} de ${x.month.slice(0, 4)}</b>${after}` : ''}<div class="cal-in"><div class="week" aria-hidden="true">${WEEK.map((w) => `<span>${w.slice(0, 3)}</span>`).join('')}</div><div class="cal">${'<span></span>'.repeat(weekdayOf(D[0]))}${D.map((d, i) => `<button type="button" id="day-${i + 1}" data-set="d" data-v="${f.day === d ? '' : d}" aria-pressed="${f.day === d}" aria-label="${esc(dayLong(d, x.today) + (A[i] ? `, ${verb} ${reais(A[i], x.hide)}` : `, sem ${many}`))}"${A[i] ? '' : ' disabled'}${d > x.today ? ' class="is-future"' : ''}><span>${i + 1}</span>${A[i] ? `<i style="width:${Math.max(10, Math.round(Math.sqrt(A[i]) * k))}px;height:${Math.max(10, Math.round(Math.sqrt(A[i]) * k))}px;background:${tone}"></i>` : ''}</button>`).join('')}</div></div>${x.phone ? '' : after}</div><p class="fin-small" style="margin:0">Quanto maior o círculo, mais ${verb} no dia. Toque para ver só esse dia.</p>`;
  } else if (!f.bill) {
    const M = x.months.map((m) => ({ m, v: Math.abs(round2(sub.filter((e) => monthOf(e.d) === m).reduce((s, e) => s + (f.flow === 'out' || f.flow === 'in' ? e.v : Math.abs(e.v)), 0))) }));
    const C = monthChart(x, { id: 'mc-extrato', rows: M, flow: 'all', tall: 150, tone });
    map = `<div class="mc-side">${slide('mc-extrato', -1)}${C.body}${slide('mc-extrato', 1)}</div><p class="fin-small" style="margin:0">Toque em um mês para ver só ele. ${C.note}</p>`;
  }
  const pill = (k, label) => `<button type="button" class="fin-btn fin-btn-2 is-set" id="off-${k}" data-set="${k}" data-v="" aria-label="Tirar o filtro ${esc(label)}">${esc(label)} ${ICON.xs}</button>`;
  const pays = [...new Set(x.entries.map((e) => e.pay))].sort();
  const range = f.min || f.max ? (f.min && f.max ? `De ${f.min} a ${f.max}` : f.min ? `A partir de ${f.min}` : `Até ${f.max}`) : '';
  const filters = [
    f.bill ? pill('b', title) : multi(x, { k: 'f', label: flowName, aria: 'Saídas ou entradas', all: 'Selecionar todas', on: f.flows, set: f.flow !== 'all', options: Object.entries(FLOWS) }),
    f.key ? pill('k', named || 'Sem nome') : '',
    has('out') ? multi(x, { k: 'g', label: groups ? said(groups, 'categorias', 'Nenhuma categoria') : 'Categoria', aria: 'Categoria', all: 'Selecionar todas', on: f.g, set: !!f.g, options: GROUPS.map((g) => [g.id, g.name, color(g.id)]) }) : '',
    multi(x, { k: 'p', label: f.pay ? said(pays.filter((p) => f.pay.includes(p)), 'tipos', 'Nenhum tipo') : 'Tipo', aria: 'Tipo', all: 'Selecionar todos', on: f.pay, set: !!f.pay, options: pays.map((p) => [p, p]) }),
    range ? pill('range', range) : `<button type="button" class="fin-btn fin-btn-2" data-act="range" aria-expanded="${!!x.range}">Valor</button>`,
  ].join('');
  const rangeBox = x.range ? `<form class="range" data-form="range"><label class="fin-field"><span class="fin-muted">De</span><input id="r-min" name="min" inputmode="decimal" autocomplete="off" aria-label="Valor mínimo" value="${esc(q.min ?? '')}"></label><label class="fin-field"><span class="fin-muted">Até</span><input id="r-max" name="max" inputmode="decimal" autocomplete="off" aria-label="Valor máximo" value="${esc(q.max ?? '')}"></label><button class="fin-btn">Aplicar</button></form>` : '';
  const search = `<label class="fin-field">${ICON.find}<span class="sr">Buscar</span><input id="q" type="search" placeholder="Pessoa, loja ou valor" autocomplete="off" value="${esc(f.q ?? '')}"></label>`;
  const when = f.bill ? 'da fatura' : f.day ? 'de ' + dayLong(f.day, x.today) : x.month === 'all' ? 'de todos os meses' : 'de ' + monthIn(x.month, x.today);
  const shown = list.slice(0, x.more);
  const days = [...new Set(shown.map((e) => e.d))];
  const row = (e) => `<a class="fin-row" href="${x.over({ e: e.id })}">${e.flow === 'out' ? dot(color(e.g)) : e.flow === 'in' ? dot('var(--in)') : OFF}<span><b>${esc(e.name || e.head)}</b><small>${esc([e.flow === 'out' ? (g1 ? e.sub : groupName(e.g)) : e.flow === null ? e.why : null, e.pay, e.inst ? `parcela ${e.inst[0]} de ${e.inst[1]}` : null, e.pend ? 'pendente' : null].filter(Boolean).join(' · '))}</small></span>${money(entryClass(e), entryText(x, e))}${ICON.go}</a>`;
  const rows = `<div class="day-head"><h2 class="fin-h2">${cap(many)} ${when}</h2>${f.day ? `<button type="button" class="fin-link" data-set="d" data-v="">Ver o mês todo</button>` : ''}</div>${list.length ? '' : `<div class="none"><p>Nenhum ${one} com esse filtro.</p><button type="button" class="fin-btn" data-act="clear">Limpar filtro</button></div>`}${days.map((d) => `<section class="day"><h3>${dayLong(d, x.today)}, ${WEEK[weekdayOf(d)]}</h3>${shown.filter((e) => e.d === d).map(row).join('')}</section>`).join('')}${list.length > shown.length ? `<button type="button" class="fin-btn fin-btn-2" data-act="more">Mostrar mais ${Math.min(200, list.length - shown.length)}</button>` : ''}`;
  const gap = bill && !f.q && !f.pay && !f.day && !f.sub && !f.min && !f.max && !f.g ? round2(bill.total - V.spent(list)) : 0;
  if (Math.abs(gap) > 0.004) change = ` A fatura fechou em ${reais(bill.total, x.hide)}. A diferença é saldo da fatura anterior, pagamento adiantado ou compra mais antiga que os dados.`;
  const head = `<div><h1 class="fin-h1" style="margin-bottom:12px">${esc(title)}</h1>${total}<p>${plural(list.length, one, many)}.${change}</p></div>${chips.length > 1 || f.sub ? `<div class="chips${x.phone && chips.length > 3 ? ' is-scroll' : ''}">${chips.map(chip).join('')}</div>` : ''}`;
  const tools = `<div class="tools is-scroll">${filters}</div>`;
  return shell(x, 'extrato', x.phone
    ? `${topBar(x, { month: true, all: true, back: true })}${notice(x)}<div class="cut"><div class="cut-l">${head}${map}</div>${search}${tools}${rangeBox}<div class="cut-r">${rows}</div></div><p class="fin-small" style="margin:0">${age(x)}</p>`
    : `${topBar(x, { month: true, all: true })}${notice(x)}<div class="tools">${search}${filters}</div>${rangeBox}<div class="cut"><div class="cut-l">${head}${map}</div><div class="cut-r">${rows}</div></div>`, 'is-cut');
}

// ---- Patrimônio ------------------------------------------------------------------------------
export function patrimonio(x) {
  const w = x.wealth, scope = x.acc, sees = (k) => V.inside(scope, k);
  const months = { 6: 6, 12: 12, 0: 0 }[x.route.q.t ?? 6] ?? 6;
  const line = V.wealthLine(x.photos, months, x.today, scope);
  const cards = w.cards.filter((c) => sees(c.account.key)), banks = w.banks.filter((a) => sees(a.key)), inv = sees('inv') ? w.inv : [];
  const named = scope && said([...x.accounts.filter((a) => sees(a.key)).map(accName), ...(sees('inv') ? ['investimentos'] : [])], 'contas', 'nenhuma conta');
  const graph = line.length > 3, long = V.wealthLine(x.photos, 0, x.today, scope).length > 3;
  const inAcc = round2(banks.reduce((s, a) => s + a.balance, 0)), invested = round2(inv.reduce((s, i) => s + i.balance, 0)), open = round2(cards.reduce((s, c) => s + c.open, 0)), unpaid = round2(cards.reduce((s, c) => s + c.unpaid, 0));
  const total = round2(inAcc + invested - open - unpaid), R = (n) => (n < 0 ? '−' + NB : '') + reais(n, x.hide);
  const parts = [banks.length && `<span><b class="med">${R(inAcc)}</b> <span class="fin-muted">em contas</span></span>`, inv.length && `<span>${banks.length ? '+ ' : ''}<b class="med">${R(invested)}</b> <span class="fin-muted">investidos</span></span>`, cards.length && `<span class="fin-out">− <b class="med">${reais(open, x.hide)}</b> da fatura aberta</span>`, unpaid > 0.004 && `<span class="fin-out">− <b class="med">${reais(unpaid, x.hide)}</b> da fatura fechada</span>`].filter(Boolean);
  // Against the last photo of an earlier month.
  const old = x.photos.filter((p) => monthOf(p.d) < monthOf(x.today)).at(-1);
  let say;
  if (scope) say = '';
  else if (old) {
    const d = total - old.total, pm = monthOf(old.d), dayEnd = dayOf(old.d) >= daysIn(pm) - 2 ? 'no fim de ' + monthIn(pm, x.today) : 'em ' + dayLong(old.d, x.today);
    const bit = (n, v) => (Math.abs(v) < 0.005 ? '' : `${n}: ${diff(v, x.hide)}.`);
    say = `<p class="fin-say" style="max-width:460px">${Math.abs(d) < 0.005 ? `Você tem o mesmo que ${dayEnd}.` : `Você tem ${diff(d, x.hide)} que ${dayEnd}.`} <span>${[bit('Investimentos', invested - old.invested), bit('Contas', inAcc - old.accounts), bit('Faturas', open + unpaid - old.owed)].filter(Boolean).join(' ')}</span></p>`;
  } else say = `<p class="fin-say" style="max-width:460px">O histórico começou em ${x.photos[0] ? dayLong(x.photos[0].d, x.today) : 'breve'}. <span>O banco não dá o passado dos investimentos. O app guarda uma foto por dia. O gráfico aparece com quatro fotos, e a comparação no mês que vem.</span></p>`;
  const tones = [...inv.map((i) => i.balance), ...banks.map((a) => a.balance)];
  const tone = (i) => mix('var(--ink)', tones.length < 2 ? 100 : Math.round(100 - (82 * i) / (tones.length - 1)));
  const pos = round2(invested + Math.max(0, inAcc)), pc = (v) => Math.round((v / pos) * 100) + '%';
  const where = pos > 0 ? `<div class="where" role="img" aria-label="Onde está: ${[inv.length && 'investimentos ' + pc(invested), banks.length && 'contas ' + pc(Math.max(0, inAcc))].filter(Boolean).join(', ')}">${tones.map((v, i) => (v > 0 ? `<span style="flex:${v};background:${tone(i)}"></span>` : '')).join('')}</div>` : '';
  const row = (href, c, n, s, v, cls = '') => `<a class="fin-row" href="${href}">${dot(c)}<span><b>${esc(n)}</b><small>${esc(s)}</small></span>${money(cls, v)}${ICON.go}</a>`;
  const due = (c) => `${c.account.bank}${c.next ? `, fecha em ${dayLong(c.next.close, x.today)}` : ''}`;
  const owed = cards.map((c) => row(x.link('faturas'), 'var(--out)', 'Fatura aberta', due(c), outText(x, c.open), 'fin-out') + (c.unpaid > 0.004 ? row(x.link('faturas'), 'var(--out)', 'Fatura fechada', `${c.account.bank}, vence em ${dayLong(c.last.due, x.today)}`, outText(x, c.unpaid), 'fin-out') : '')).join('');
  const cols = [
    !sees('inv') ? '' : `<section><h2 class="fin-h2">Investimentos</h2>${inv.length ? inv.map((i, n) => row(x.over({ i: i.key }), tone(n), i.name, [i.bank, i.name === i.kind ? '' : i.kind].filter(Boolean).join(' · '), R(i.balance))).join('') : '<p class="fin-muted" style="margin:8px 0">Nenhum investimento neste banco.</p>'}</section>`,
    banks.length ? `<section><h2 class="fin-h2">Contas</h2>${banks.map((a, n) => row(x.link('extrato', { f: 'all' }, { a: a.key }), tone(inv.length + n), a.bank, a.label, R(a.balance))).join('')}</section>` : '',
    cards.length ? `<section><h2 class="fin-h2">A pagar</h2>${owed}</section>` : '',
  ].join('');
  const periods = [[6, '6 meses'], [12, '1 ano'], [0, 'Tudo']];
  const down = w.banks.some((a) => x.items.find((i) => i.key === a.item)?.problem) && x.items.length > 1 ? `<p class="fin-small" style="margin:0">${esc(x.items.filter((i) => i.problem).map((i) => i.bank ?? 'Um banco').join(' e '))} não respondeu. O valor é da última leitura.</p>` : '';
  return shell(x, 'patrimonio', `${topBar(x, { extra: w.inv.length ? [['inv', 'Investimentos']] : [] })}${notice(x)}<div class="wealth-head"><div><h1 class="fin-h1" style="margin-bottom:12px">Patrimônio${named ? ', ' + esc(named) : ''}</h1><p class="fin-money big">${R(total)}</p><p class="parts">${parts.join('')}</p></div>${long ? `<div class="fin-seg" role="group" aria-label="Período">${periods.map(([v, n]) => `<button type="button" id="t-${v}" data-set="t" data-v="${v}" aria-pressed="${v === months}">${n}</button>`).join('')}</div>` : ''}</div>${down}${graph ? chart(x, line) : ''}${say}<section class="sect" style="display:flex;flex-direction:column;gap:20px;padding-top:24px"><h2 class="fin-h2">Onde está</h2>${where}<div class="cols">${cols}</div></section>`);
}
function chart(x, line) {
  if (!line.length) return '';
  const W = Math.max(280, x.inner), H = x.phone ? 210 : 300, floor = H - 28, pad = 14, f = line[0], l = line.at(-1);
  const span = Math.max(1, daysBetween(f.d, l.d)), lo = Math.min(...line.map((p) => p.v)), hi = Math.max(...line.map((p) => p.v));
  const X = (d) => (line.length === 1 ? W - pad : pad + (daysBetween(f.d, d) / span) * (W - 2 * pad));
  const Y = (v) => (hi - lo < 0.005 ? floor * 0.5 : floor - 60 - ((v - lo) / (hi - lo)) * (floor - 60 - 30));
  const pts = line.map((p) => `${X(p.d).toFixed(1)} ${Y(p.v).toFixed(1)}`);
  // One label per month; days instead when everything is inside one month.
  let marks = line.filter((p, i) => i === 0 || monthOf(p.d) !== monthOf(line[i - 1].d)).map((p) => [p.d, monthShort(p.d)]);
  if (marks.length === 1) marks = line.length === 1 ? [[f.d, dayShort(f.d)]] : [[f.d, dayShort(f.d)], [l.d, dayShort(l.d)]];
  const room = Math.max(1, Math.floor((W - 28) / 52));
  if (marks.length > room) marks = marks.filter((_, i) => i % Math.ceil(marks.length / room) === 0);
  const anchor = (px) => (px < 30 ? 'start' : px > W - 30 ? 'end' : 'middle');
  return `<svg class="chart" role="img" aria-label="${esc(line.length === 1 ? `Patrimônio em ${dayLong(f.d, x.today)}, ${reais(f.v, x.hide)}` : `Patrimônio de ${dayLong(f.d, x.today)}, ${reais(f.v, x.hide)}, a ${dayLong(l.d, x.today)}, ${reais(l.v, x.hide)}`)}" viewBox="0 0 ${W} ${H}"><path d="M0 ${floor}H${W}" stroke="var(--line)"/>${pts.length > 1 ? `<path d="M${pts.join('L')}" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` : ''}<circle cx="${X(l.d)}" cy="${Y(l.v)}" r="9" fill="var(--ink)"/>${marks.map(([d, n]) => `<text x="${X(d)}" y="${H - 6}" text-anchor="${anchor(X(d))}">${n}</text>`).join('')}${line.length > 1 ? `<text x="${X(f.d)}" y="${Math.min(floor - 6, Y(f.v) + 26)}">${(f.v < 0 ? '−' : '') + reais(f.v, x.hide)}</text>` : ''}</svg>`;
}

// ---- Faturas ---------------------------------------------------------------------------------
export function faturas(x) {
  const cards = x.cards.filter((c) => V.inside(x.acc, c.account.key));
  const subs = V.subscriptions(x.entries, x), mx = subs.reduce((s, e) => s + e.v, 0);
  const block = (c, i) => {
    const open = { m: c.month, v: c.open, href: x.link('extrato', { b: 'open-' + c.account.key }, { m: x.todayMonth }), on: true };
    const six = [...c.closed.slice(0, 5).reverse().filter((b) => b.month < c.month).map((b) => ({ m: b.month, v: b.total, href: x.link('extrato', { b: b.key }) })), open];
    const top = Math.max(1, ...six.map((b) => b.v)), n = c.next ? daysBetween(x.today, c.next.close) : null;
    const when = n === null ? '' : n > 1 ? `, em ${n} dias` : n === 1 ? ', amanhã' : n === 0 ? ', hoje' : '';
    const dates = c.next ? `<div class="dates"><span><span class="fin-muted">${n < 0 ? 'Fechou' : 'Fecha'}</span> <b class="med">${dayLong(c.next.close, x.today)}${when}</b></span><span><span class="fin-muted">Vence</span> <b class="med">${dayLong(c.next.due, x.today)}</b></span></div><p class="fin-small" style="margin:8px 0 0">Datas previstas. O banco só confirma quando a fatura fecha.</p>` : '<p class="fin-small" style="margin:14px 0 0">As datas aparecem depois de duas faturas fechadas.</p>';
    const H = i === 0 ? 'h1' : 'h2';
    const body = c.has ? `<div><${H} class="fin-h1" style="margin-bottom:12px">Fatura aberta, ${esc(c.account.bank)}</${H}><p class="fin-money ${c.open < -0.004 ? 'fin-in' : 'fin-out'} big">${outText(x, c.open)}</p>${dates}</div><a class="fin-btn tall" href="${open.href}">Ver os gastos da fatura</a>` : `<div><${H} class="fin-h1" style="margin-bottom:12px">${esc(c.account.bank)}</${H}><p class="lead">Nenhuma fatura aberta.</p></div>`;
    return `<div class="pair"><section class="fin-block bill">${body}</section><div class="fin-block"><section><h2 class="fin-h2" style="margin-bottom:6px">${['', 'Uma fatura', 'Duas faturas', 'Três faturas', 'Quatro faturas', 'Cinco faturas', 'Seis faturas'][six.length]}</h2><div class="fin-bars" style="height:200px;grid-auto-columns:minmax(0,1fr)">${six.map((b) => `<a href="${b.href}" aria-label="${esc(`${monthName(b.m)}, ${reais(b.v, x.hide)}`)}"><i style="height:${b.v > 0 ? Math.max(4, Math.round(b.v / top * 170)) : 0}px;--c:var(--${b.on ? 'out' : 'out-soft'})"></i>${monthShort(b.m)}</a>`).join('')}</div><p class="fin-small" style="margin:8px 0 0">${cap(monthName(c.month))} ainda está aberta.</p></section></div></div>`;
  };
  const past = (c) => c.closed.slice(0, 11).map((b) => `<a class="fin-row no-dot" href="${x.link('extrato', { b: b.key })}"><span><b>${cap(monthIn(b.month, x.today))}</b><small>${b.part ? `paga em parte, ${reais(b.got, x.hide)} até ${dayLong(b.when, x.today)}` : b.when ? `paga em ${dayLong(b.when, x.today)}` : b.due >= x.today ? `vence em ${dayLong(b.due, x.today)}` : `venceu em ${dayLong(b.due, x.today)}`}</small></span>${money('fin-out', outText(x, b.total))}${ICON.go}</a>`).join('');
  const subRow = (s) => `<a class="fin-row" href="${x.link('extrato', { f: 'out', k: s.key }, { m: 'all' })}">${dot(color(s.g))}<span><b>${esc(s.name)}</b><small>${s.fixedDay ? `todo dia ${dayOf(s.d)}` : `última em ${dayLong(s.d, x.today)}`}</small></span>${money('fin-out', outText(x, s.v))}${ICON.go}</a>`;
  const subBox = `<section><div class="h-line"><h2 class="fin-h2">Assinaturas</h2>${subs.length ? `<span class="fin-money fin-out med">${outText(x, round2(mx))} por mês</span>` : ''}</div>${subs.length ? subs.map(subRow).join('') : `<p class="fin-muted" style="margin:8px 0">${x.months.length < 3 ? 'O app precisa de dois meses para achar o que se repete.' : 'Nada se repetiu nos últimos dois meses.'}</p>`}</section>`;
  const pastBox = cards.some((c) => c.closed.length) ? `<section><h2 class="fin-h2">Faturas passadas</h2>${cards.map((c) => (cards.length > 1 ? `<p class="fin-small" style="margin:10px 0 0">${esc(c.account.bank)}</p>` : '') + past(c)).join('')}</section>` : '';
  return shell(x, 'faturas', `${topBar(x)}${notice(x)}${cards.length ? cards.map(block).join('') : `<div class="empty"><h1 class="fin-h1">Faturas</h1><p>Nenhum cartão nesta conta.</p></div>`}<div class="cols">${subBox}${pastBox}</div>`);
}

// ---- Ajustes, Regras, Conectar ---------------------------------------------------------------
const segBtn = (act, on, opts) => `<div class="fin-seg" role="group" aria-label="${act === 'theme' ? 'Tema' : 'Abrir com valores escondidos'}">${opts.map(([v, n]) => `<button type="button" id="${act}-${v}" data-act="${act}" data-v="${v}" aria-pressed="${v === on}">${n}</button>`).join('')}</div>`;
export function ajustes(x) {
  const at = x.readDay ? `O banco foi lido ${ago(x.readDay, x.today)}, ${x.readTime}. ` : '';
  const line = x.job.running ? 'Buscando no Pluggy.' : x.justRead ? `Atualizado agora. ${at}` : `${age(x)}. Atualiza sozinho uma vez por dia.`;
  const says = { expired: 'Autorização vencida', bank: 'Não respondeu', item: 'Conexão não encontrada', keys: 'Chaves recusadas' };
  const bank = (i) => {
    const mine = x.accounts.filter((a) => a.item === i.key), inv = x.wealth.inv.some((v) => v.item === i.key);
    const has = [mine.some((a) => a.type === 'BANK') && 'conta', mine.some((a) => a.type === 'CARD') && 'cartão', inv && 'investimentos'].filter(Boolean);
    const list = cap(has.length > 1 ? has.slice(0, -1).join(', ') + ' e ' + has.at(-1) : has[0] ?? 'sem dados');
    return `<div class="set"><span><b class="med">${esc(i.bank ?? 'Banco')}</b><small>${list}${i.until ? ` · autorização até ${dayLong(localDate(i.until).slice(0, 10), '0000')}` : ''}</small></span><span>${says[i.problem] ?? 'Conectado'}</span></div>`;
  };
  const own = x.entries.some((e) => e.why === 'Transferência própria');
  return shell(x, 'ajustes', `<div class="set-head"><div><h1 class="fin-h1">Ajustes</h1><p>${line}</p></div><button type="button" class="fin-btn tall" data-act="refresh"${x.job.running ? ' disabled' : ''}>${x.job.running ? 'Atualizando' : 'Atualizar agora'}</button></div>${notice(x)}<div class="narrow">
  <section><h2 class="fin-h2" style="margin-bottom:4px">Bancos</h2>${x.items.map(bank).join('')}<p class="fin-small" style="margin:12px 0 0">Para incluir outro banco, conecte no Meu Pluggy e coloque o Item ID dele junto do primeiro, separado por vírgula. O limite grátis é de 5.${own ? ' Uma conta sua que não está ligada não aparece aqui, nem o que sai dela.' : ''}</p><a class="fin-link" href="${x.link('conectar')}">Chaves e reconexão</a></section>
  <section><h2 class="fin-h2" style="margin-bottom:4px">Regras</h2><a class="set" href="${x.link('regras')}"><b class="med">${x.rules.length ? plural(x.rules.length, 'regra por destinatário', 'regras por destinatário') : 'Nenhuma regra por destinatário'}</b>${ICON.go}</a></section>
  <section><h2 class="fin-h2" style="margin-bottom:4px">Tela</h2><div class="set"><b class="med">Tema</b>${segBtn('theme', x.theme, [['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Do sistema']])}</div><div class="set"><b class="med">Abrir com valores escondidos</b>${segBtn('open-hidden', x.openHidden ? '1' : '0', [['0', 'Não'], ['1', 'Sim']])}</div></section>
  <section><h2 class="fin-h2" style="margin-bottom:4px">Seus dados</h2><p class="lead">O app só lê, nunca move dinheiro. Os dados ficam só neste computador, fora da nuvem. CPF, endereço e renda não são guardados.</p></section>${x.version ? `<section><h2 class="fin-h2" style="margin-bottom:4px">App</h2><div class="set"><b class="med">Versão ${esc(x.version)}</b>${x.up.next && x.here ? `<button type="button" class="fin-btn fin-btn-2" id="up" data-act="update"${x.up.running || x.job.running ? ' disabled' : ''}>${x.up.running ? 'Atualizando' : `Atualizar para ${esc(x.up.next)}`}</button>` : `<span>${x.up.next ? `Há a versão ${esc(x.up.next)}` : 'Em dia'}</span>`}</div></section>` : ''}</div>`);
}
export const treatName = (r) => (r.treat === 'none' ? (r.dir === 'in' ? 'Não é entrada' : 'Não é gasto') : groupName(r.treat));
export function regras(x) {
  const n = (r) => x.entries.filter((e) => e.rule === r.id).length;
  const row = (r) => `<div class="rule"><span>${r.treat === 'none' ? OFF : dot(color(r.treat))}<span><b class="med">${esc(r.name)}</b><small>${treatName(r)} · ${plural(n(r), r.dir === 'in' ? 'entrada' : 'gasto', r.dir === 'in' ? 'entradas' : 'gastos')} · criada em ${dayLong(r.at, x.today)}</small></span></span><button type="button" class="fin-btn fin-btn-2" id="undo-${r.id}" data-act="undo" data-v="${r.id}" aria-label="Desfazer a regra de ${esc(r.name)}">Desfazer</button></div>`;
  const u = x.lastUndone;
  return shell(x, 'ajustes', `<div><h1 class="fin-h1">Regras</h1><p class="lead">Como o app trata o que você manda a cada destinatário. Crie uma regra dentro de um gasto.</p></div>${x.rules.length ? `<div style="max-width:760px">${x.rules.slice().reverse().map(row).join('')}</div>` : '<p style="margin:0;font:500 20px/1.3 Outfit,sans-serif">Nenhuma regra.</p>'}${u ? `<div class="fin-notice" role="status" style="max-width:760px;box-sizing:border-box"><p>Regra de <b>${esc(u.name)}</b> desfeita. ${u.dir === 'in' ? 'O dinheiro voltou a ser entrada.' : `Os gastos voltaram para ${esc(groupName(u.back))}.`}</p><button type="button" class="fin-btn" data-act="restore" data-v="${u.id}">Trazer de volta</button></div>` : ''}<a class="fin-link" href="${x.link('ajustes')}" style="align-self:flex-start">Voltar aos ajustes</a>`);
}
const WRONG = {
  keys: ['O Pluggy não aceitou as chaves.', 'Confira o Client ID e o Client Secret e tente de novo.'],
  item: ['O Pluggy não achou a conexão.', 'Confira o Item ID e tente de novo.'],
  bank: ['O banco não respondeu.', 'Suas chaves estão certas. Tente de novo em alguns minutos.'],
  expired: ['A autorização venceu.', 'Renove no Meu Pluggy e volte aqui.'],
};
const DASH = '<a class="inline" href="https://dashboard.pluggy.ai/" target="_blank" rel="noopener noreferrer">Dashboard do Pluggy</a>';
const MEU = '<a class="inline" href="https://meu.pluggy.ai/" target="_blank" rel="noopener noreferrer">Meu Pluggy</a>';
export function conectar(x) {
  const run = x.job.running || x.connected, bad = !run && WRONG[x.sync.problem];
  const steps = ['Chaves conferidas', 'Trazendo 12 meses de gastos', 'Separando por categoria'], n = x.connected ? 3 : x.job.step;
  const field = (id, label, type, hint) => `<div class="f"><label for="${id}">${label}</label><div class="fin-field"><input id="${id}" name="${id}" type="${type}" autocomplete="off" spellcheck="false" aria-describedby="${id}-h" required></div><span id="${id}-h" class="fin-small">${hint}</span></div>`;
  const form = x.here
    ? `<form data-form="connect">${field('id', 'Client ID', 'text', `Em ${MEU}, no Dashboard, em Aplicações.`)}${field('secret', 'Client Secret', 'password', 'O Pluggy mostra uma vez só, quando cria a chave.')}${field('item', 'Item ID', 'text', 'O código da sua conexão com o MeuPluggy. Mais de um banco: separe por vírgula.')}<button class="fin-btn tall">Conectar</button></form>`
    : `<p class="lead">As chaves só podem ser digitadas no computador onde o app está. Abra lá o endereço <b class="med">http://127.0.0.1:${location.port || 5092}</b>.</p>`;
  const how = x.readAt ? `<section><h2 class="fin-h2" style="margin-bottom:10px">Como reconectar</h2><ol><li>No Dashboard do Pluggy, abra a sua aplicação e clique em Demo.</li><li>Clique em Connect Account e escolha MeuPluggy. Não escolha o seu banco.</li><li>Entre com a sua conta do ${MEU}. A autorização vale por mais um ano.</li><li>Confira se o Item ID continua o mesmo. Se mudou, coloque o novo aqui.</li></ol></section>` : x.here ? `<section><h2 class="fin-h2" style="margin-bottom:10px">Como criar as chaves</h2><ol><li>Crie sua conta no ${MEU} e conecte o seu banco lá. Vá até o fim da tela do banco.</li><li>Entre no ${DASH} com o mesmo e-mail e crie uma aplicação. Ignore o aviso de teste de 15 dias.</li><li>Na aplicação, copie o Client ID e o Client Secret.</li><li>Abra a aplicação em Demo, clique em Connect Account e escolha MeuPluggy. Não escolha o seu banco.</li><li>Na mesma página, clique na conexão e copie o Item ID dela.</li></ol></section>` : '';
  const inner = `<div style="display:grid;gap:14px"><h1>Ligue o seu banco.</h1><p style="margin:0;color:var(--muted)">O app <b class="med" style="color:var(--ink)">só lê</b>. Ele nunca move dinheiro. Os dados e as chaves ficam <b class="med" style="color:var(--ink)">só neste computador</b>.</p></div>${bad ? `<div class="fin-notice" role="alert"><p><b>${bad[0]}</b> ${bad[1]}</p></div>` : ''}${run ? `<div role="status">${steps.map((t, i) => `<div class="step${n > i ? ' is-done' : n === i ? ' is-on' : ''}"><i></i><span>${t}</span><small class="fin-small">${n > i ? 'pronto' : n === i ? 'agora' : ''}</small></div>`).join('')}</div>${n >= 3 ? `<a class="fin-btn tall" href="${x.link('inicio')}" data-act="enter">Ver o meu mês</a>` : '<button type="button" class="fin-btn tall" disabled>Ver o meu mês</button>'}` : how + form}${x.readAt && !run ? `<a class="fin-link" style="justify-self:start;align-self:flex-start" href="${x.link('ajustes')}">Voltar aos ajustes</a>` : ''}`;
  const B = [[250, 'pessoas'], [130, 'casa'], [84, 'mercado'], [66, 'comida-fora'], [48, 'transporte']];
  const back = x.readAt && !run;
  return `<div class="connect${back ? ' has-back' : ''}"><main>${back ? `<a class="fin-icon back" href="${x.link('ajustes')}" aria-label="Voltar aos ajustes">${ICON.back}</a>` : ''}${inner}</main><div class="deco" aria-hidden="true">${B.map(([d, c]) => `<i style="width:${d}px;height:${d}px;background:${color(c)}"></i>`).join('')}</div></div>`;
}

// ---- side panel: Gasto, Regra, investment ----------------------------------------------------
const close = `<button type="button" class="fin-icon" data-act="close" aria-label="Fechar">${ICON.x}</button>`;
const item = (t, d) => (d ? `<div><dt>${t}</dt><dd>${d}</dd></div>` : '');
export function gasto(x, e) {
  const inc = e.flow === 'in', name = e.name || e.head || 'Sem nome';
  const L = e.key ? x.entries.filter((o) => o.key === e.key && (e.v < 0 ? o.v < 0 : o.v > 0) && o.d <= x.today) : [];
  const six = V.lastMonths(x.todayMonth, 6), B = six.map((m) => Math.abs(round2(L.filter((o) => monthOf(o.d) === m).reduce((s, o) => s + o.v, 0)))), mx = Math.max(1, ...B);
  const in6 = L.filter((o) => monthOf(o.d) >= six[0]), same = in6.every((o) => o.pay === 'Pix');
  const person = e.pay === 'Pix' || e.pay === 'TED';
  const head = e.v > 0 ? 'Você recebeu em 6 meses' : person ? 'Você mandou em 6 meses' : 'Você gastou aqui em 6 meses';
  const acc = x.accounts.find((a) => a.key === e.acc);
  const tone = e.flow === 'out' ? color(e.g) : e.flow === 'in' ? 'var(--in)' : 'var(--ink)';
  const total = round2(in6.reduce((s, o) => s + o.v, 0));
  const can = e.key && (e.flow !== null || e.soft || e.rule);
  const cur = e.cur ? `${e.cur === 'USD' ? 'US$' : e.cur === 'EUR' ? '€' : esc(e.cur)}${NB}${x.hide ? '••••' : e.orig.toFixed(2).replace('.', ',')}` : '';
  return `<div class="bar"><h1 class="fin-h2">${esc(name)}</h1>${close}</div><p class="fin-money ${entryClass(e)} big">${entryText(x, e)}</p><dl>${item('Quando', dayLong(e.d, x.today) + (e.t ? ', ' + e.t : ''))}${e.flow === 'out' ? item('Categoria', `<span class="with-dot">${dot(color(e.g))}${groupName(e.g)}</span>`) + item('Detalhe', e.sub && e.g !== 'pessoas' && e.sub !== groupName(e.g) ? esc(e.sub) : '') : ''}${e.flow === null ? item('Não conta', esc(e.why)) : ''}${item(inc || e.v > 0 ? 'Como entrou' : 'Como saiu', e.special ? '' : e.pay)}${item('Conta', acc ? esc(accName(acc)) : '')}${item('Parcela', e.inst ? `${e.inst[0]} de ${e.inst[1]}` : '')}${item('Comprado em', e.inst && e.bought ? dayLong(e.bought, x.today) : '')}${item('Valor original', cur)}${item('Situação', e.special ? 'Calculado pelo app' : e.pend ? 'Pendente' : 'Confirmado')}</dl>${e.special ? '<p class="fin-small" style="margin:0">A fatura veio maior que a soma das compras. O Pluggy não diz o que é essa diferença.</p>' : ''}${L.length ? `<div><h2 class="s">${head}</h2><div class="fin-bars" style="height:130px;grid-auto-columns:minmax(0,1fr)">${B.map((v, i) => `<span><i style="height:${v ? Math.max(4, Math.round(v / mx * 92)) : 0}px;--c:${six[i] === monthOf(e.d) ? tone : 'var(--edge)'}"></i>${monthShort(six[i])}</span>`).join('')}</div><p class="fin-small" style="margin:8px 0 0">${in6.length ? `${same ? in6.length + ' Pix' : plural(in6.length, 'lançamento', 'lançamentos')}, <span class="fin-money ${total < 0 ? 'fin-out' : 'fin-in'}">${(total < 0 ? '−' : '+') + NB + reais(total, x.hide)}</span> no total.` : 'Nada nos últimos 6 meses.'}</p></div>` : ''}<span class="rest"></span><div class="go">${e.key ? `<a class="fin-btn tall" href="${x.link('extrato', { f: 'all', k: e.key }, { m: 'all', a: null })}">Ver tudo com ${esc(name.length > 26 ? name.slice(0, 25) + '…' : name)}</a>` : ''}${can ? `<a class="fin-btn fin-btn-2 tall" href="${x.over({ e: e.id, r: 1 })}">${e.rule ? 'Mudar a regra' : 'Criar uma regra'}</a>` : `<p class="fin-small" style="margin:0">${e.key ? 'Este lançamento não é gasto nem entrada, então não precisa de regra.' : 'Este lançamento veio sem nome. Sem nome não dá para criar uma regra.'}</p>`}</div>`;
}
export function regra(x, e, ui) {
  const inc = e.v > 0 && (e.flow === 'in' || (e.flow === null && e.baseFlow === 'in')), dir = inc ? 'in' : 'out';
  const name = e.name || e.key, nowNone = e.flow === null;
  const L = x.entries.filter((o) => o.key === e.key && (inc ? o.baseFlow === 'in' : o.baseFlow !== 'in' && o.v < 0) && o.d <= x.today);
  const total = Math.abs(round2(L.reduce((s, o) => s + o.v, 0))), first = L.at(-1)?.d, pixs = L.every((o) => o.pay === 'Pix');
  const what = (n) => (inc ? plural(n, 'entrada', 'entradas') : pixs ? n + ' Pix' : plural(n, 'gasto', 'gastos'));
  const since = first ? `desde ${monthIn(monthOf(first), x.today)}` : '';
  const curName = nowNone ? (inc ? 'Não é entrada' : 'Não é gasto') : inc ? 'Entrada' : groupName(e.g);
  const k = ui.k ?? (nowNone || inc ? 'A' : 'C'), cat = ui.cat ?? (e.g === 'casa' || nowNone ? 'outros' : 'casa');
  const m = x.month === 'all' ? x.todayMonth : x.month, s = V.summary(x.entries, { ...x, month: m });
  const before = inc ? s.got : s.spent, mine = Math.abs(round2(L.filter((o) => o.d >= s.p.from && o.d <= s.p.to && V.inside(x.acc, o.acc)).reduce((t, o) => t + o.v, 0)));
  const one = L.length === 1;
  let t, d;
  if (ui.done) [t, d] = ui.said;
  else if (k === 'A') [t, d] = ['Nada muda.', 'Já é assim. Escolha outra opção para criar a regra.'];
  else if (k === 'B') [t, d] = nowNone ? [`${what(L.length)} ${one ? 'volta' : 'voltam'} a ser gasto, em ${groupName(cat)}.`, `São ${reais(total, x.hide)} ${since}. Vale para o passado.`] : [`${plural(L.length, 'gasto vai', 'gastos vão')} de ${curName} para ${groupName(cat)}.`, `São ${reais(total, x.hide)} ${since}. O total do mês não muda.`];
  else if (nowNone) [t, d] = [`${what(L.length)} ${one ? 'volta' : 'voltam'} a ser entrada.`, `São ${reais(total, x.hide)} ${since}. Vale para o passado.`];
  else [t, d] = [`${what(L.length)} ${one ? 'deixa' : 'deixam'} de ser ${inc ? 'entrada' : 'gasto'}.`, mine > 0.004 ? `O que ${inc ? 'entrou' : 'saiu'} em ${monthName(m)} cai de ${reais(before, x.hide)} para ${reais(before - mine, x.hide)}. Vale para o passado.` : `São ${reais(total, x.hide)} ${since}. Vale para o passado.`];
  ui.said = [t, d];
  const bar = `<div class="bar">${ui.done ? '<span></span>' : `<a class="fin-icon" href="${x.over({ e: e.id })}" data-act="back" aria-label="Voltar ao gasto" style="margin-left:-12px">${ICON.back}</a>`}${close}</div>`;
  if (ui.done) return `${bar}<h1 class="fin-h1">Regra criada.</h1><p style="margin:0">${t} ${d}</p><p style="margin:0" class="fin-muted">${inc ? `O que ${esc(name)} mandar já entra assim.` : pixs ? `Os próximos Pix para ${esc(name)} já entram assim.` : `Os próximos gastos com ${esc(name)} já entram assim.`}</p><span class="rest"></span><div class="go"><button type="button" class="fin-btn tall" data-act="close">Voltar</button><button type="button" class="fin-btn fin-btn-2 tall" data-act="undo-here">Desfazer</button></div>`;
  const opt = (v, n, small) => `<label class="opt"><input type="radio" name="trato" id="opt-${v}" value="${v}" data-opt="${v}"${k === v ? ' checked' : ''}><span><b class="med">${n}</b><small>${small}</small></span></label>`;
  const opts = opt('A', curName, 'É assim hoje') + (inc ? '' : opt('B', nowNone ? 'É gasto' : 'Outra categoria', nowNone ? 'Volta a contar, na categoria que você escolher' : 'Continua sendo gasto, com outro nome')) + (nowNone ? (inc ? opt('C', 'Entrada', 'Volta a contar como dinheiro que entrou') : '') : opt('C', inc ? 'Não é entrada' : 'Não é gasto', inc ? 'Empréstimo devolvido ou dinheiro que só volta' : 'Empréstimo, investimento ou dinheiro que volta'));
  return `${bar}<h1 class="fin-h1">${inc ? `Como tratar o que ${esc(name)} manda para você?` : person(e) ? `Como tratar o que você manda para ${esc(name)}?` : `Como tratar o que você gasta com ${esc(name)}?`}</h1><div role="radiogroup" aria-label="Como tratar">${opts}</div>${k === 'B' ? `<div class="chips">${GROUPS.filter((g) => nowNone || g.id !== e.g).map((g) => `<button type="button" class="fin-btn fin-btn-2" id="cat-${g.id}" data-cat="${g.id}" aria-pressed="${g.id === cat}">${dot(color(g.id))}${g.name}</button>`).join('')}</div>` : ''}<span class="rest"></span><div class="fin-block" style="padding:18px 20px" role="status"><b class="med">${t}</b><span style="display:block" class="fin-muted">${d}</span></div><button type="button" class="fin-btn tall" data-act="save-rule" data-k="${k}" data-cat="${cat}" data-dir="${dir}"${k === 'A' ? ' disabled' : ''}>Sempre tratar assim</button>`;
}
const person = (e) => e.pay === 'Pix' || e.pay === 'TED';
export function investimento(x, i) {
  const rate = i.rate && i.index ? `${String(i.rate).replace('.', ',')}% do ${i.index}` : i.fixed ? `${String(i.fixed).replace('.', ',')}% ao ano` : i.index ?? '';
  return `<div class="bar"><h1 class="fin-h2">${esc(i.name)}</h1>${close}</div><p class="fin-money big">${reais(i.balance, x.hide)}</p><dl>${item('Tipo', esc(i.kind))}${item('Banco', esc(i.bank))}${item('Rendimento', esc(rate))}${item('Vence em', i.due ? dayLong(i.due, '0000') : '')}${item('Valor de', i.date ? dayLong(i.date, x.today) : '')}</dl>${i.moves?.length ? `<div><h2 class="s">Movimentos</h2>${i.moves.slice(0, 12).map((m) => `<div class="line" style="grid-template-columns:minmax(0,1fr) auto"><span>${m.out ? 'Resgate' : 'Aplicação'} <small>${dayLong(m.d, x.today)}</small></span>${money('', reais(m.v, x.hide))}</div>`).join('')}</div>` : ''}<p class="fin-small" style="margin:0">Valor líquido, como o banco informou. O banco não dá o rendimento dia a dia.</p>`;
}
