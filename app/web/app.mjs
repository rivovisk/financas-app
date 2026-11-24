// State, addresses (hash) and events. The screens themselves are in screens.mjs.
import { classify } from './core/classify.mjs';
import * as V from './core/views.mjs';
import { dayLong, daysBetween, localDate, monthOf } from './core/format.mjs';
import * as S from './screens.mjs';

const $ = (id) => document.getElementById(id);
const store = (kind) => ({
  get: (k) => { try { return window[kind].getItem(k); } catch { return null; } },
  set: (k, v) => { try { window[kind].setItem(k, v); } catch { /* private window */ } },
});
const local = store('localStorage'), tab = store('sessionStorage');
const narrow = matchMedia('(max-width:719px)');
const ownerKey = 'fin-owner-session';
let session = tab.get(ownerKey), setupCode = /^#owner=([0-9a-f]{64})$/.exec(location.hash)?.[1];
if (setupCode) history.replaceState(history.state, '', location.pathname + location.search);
function remember(token) { session = token; tab.set(ownerKey, token ?? ''); }

const st = { data: null, off: { out: [], in: [] }, closed: new Set(), more: 200, range: false, menu: null, rule: {}, lastUndone: null, justRead: false, connected: false, loadedAt: 0 };
st.balls = tab.get('fin-view') === 'balls';
st.hide = (tab.get('fin-hide') ?? local.get('fin-open-hidden')) === '1';
history.scrollRestoration = 'manual';

// ---- addresses -------------------------------------------------------------------------------
const parse = () => {
  const [name, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: name || 'inicio', q: Object.fromEntries(new URLSearchParams(query)) };
};
const make = (name, q) => {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== null && v !== undefined && v !== ''));
  return '#/' + name + (String(p) ? '?' + p : '');
};
function go(hash, replace) {
  if (hash === location.hash) return;
  history.replaceState({ ...history.state, y: scrollY }, '');
  if (replace) history.replaceState({ ...history.state, y: scrollY }, '', hash);
  else history.pushState({ y: 0, over: /[?&](e|i)=/.test(hash), n: (history.state?.n ?? 0) + 1 }, '', hash);
}

// ---- what every screen receives --------------------------------------------------------------
const inner = (x) => Math.round(x.phone ? x.width - 40 : $('app').querySelector('.main')?.clientWidth || x.width - (x.width < 900 ? 64 : 296));
function context() {
  const d = st.data, route = parse(), q = route.q;
  const entries = st.classified ?? (st.classified = classify(d.entries, d.rules, d.bills));
  const count = {};
  const accounts = d.accounts.filter((a) => !a.gone).map((a) => ({ ...a, twin: (count[a.bank + a.label] = (count[a.bank + a.label] ?? 0) + 1) > 1 ? count[a.bank + a.label] : 0 }));
  const months = V.monthsWithData(entries, d.today), todayMonth = monthOf(d.today);
  const month = q.m === 'all' && route.name === 'extrato' ? 'all' : months.includes(q.m) ? q.m : todayMonth;
  // One account, several, none (-) or all (null). Investments are an account only in Patrimônio.
  const known = [...accounts.map((a) => a.key), ...(route.name === 'patrimonio' && d.investments.some((i) => i.balance >= 0.01) ? ['inv'] : [])];
  let acc = S.many(q.a)?.filter((k) => known.includes(k)) ?? null;
  if (acc && ((!acc.length && q.a !== '-') || acc.length === known.length)) acc = null;
  const reads = d.items.map((i) => i.readAt).filter(Boolean).sort();
  const read = reads[0] ? localDate(reads[0]) : null;
  const old = read ? daysBetween(read.slice(0, 10), d.today) : 0;
  const problem = d.sync.problem ?? (d.items.find((i) => i.until && Date.parse(i.until) <= Date.parse(d.now)) ? 'expired' : null);
  const x = {
    ...d, route, entries, accounts, months, todayMonth, month, acc, hide: st.hide, off: st.off, more: st.more, range: st.range, menu: st.menu, balls: st.balls, lastUndone: st.lastUndone, justRead: st.justRead, connected: st.connected,
    phone: narrow.matches, width: document.documentElement.clientWidth, readDay: read?.slice(0, 10) ?? null, readTime: read?.slice(11, 16), trouble: !!problem || old > 2, problem,
    theme: local.get('fin-theme') ?? 'system', openHidden: local.get('fin-open-hidden') === '1',
    // Month and account follow the person from one place to the other.
    link: (name, params = {}, over = {}) => make(name, { m: 'm' in over ? over.m : q.m === 'all' ? null : q.m, a: 'a' in over ? over.a : q.a, ...params }),
    over: (params) => make(route.name, { ...q, e: null, i: null, r: null, ...params }),
  };
  x.inner = inner(x);
  x.wealth = V.wealthNow({ ...d, accounts, entries, today: d.today });
  x.cards = x.wealth.cards;
  x.notice = note(x);
  return x;
}
function note(x) {
  const on = (kind, n) => (st.closed.has(kind) ? null : { kind, ...n });
  if (x.up?.running) return { kind: 'up', t: `Atualizando o app para a versão ${x.up.next}.`, d: 'Ele fecha e volta sozinho em alguns segundos.' };
  if (x.job.running) return on('run', { t: 'Atualizando agora.', d: x.readDay ? `Os valores abaixo são de ${x.readDay === x.today ? 'hoje' : dayLong(x.readDay, x.today)}, ${x.readTime}.` : '' });
  const since = x.readDay ? dayLong(x.readDay, x.today) : '', n = x.readDay ? daysBetween(x.readDay, x.today) : 0;
  const until = x.items.map((i) => i.until).filter(Boolean).sort()[0];
  if (x.problem === 'expired') {
    const gone = x.items.find((i) => i.problem === 'expired' && i.until) ?? x.items.find((i) => i.until && Date.parse(i.until) <= Date.parse(x.now));
    return on('expired', { t: 'A autorização do banco venceu.', d: `Os dados pararam em ${gone?.until && Date.parse(gone.until) <= Date.parse(x.now) ? dayLong(localDate(gone.until).slice(0, 10), '0000') : since}. Reconecte no Meu Pluggy para continuar.`, a: 'Ver como reconectar', href: x.link('conectar') });
  }
  if (x.problem === 'keys' || x.problem === 'nokeys') return on('keys', { t: 'O Pluggy não aceitou as chaves.', d: `Você está vendo os dados de ${since}. Nada se perdeu.`, a: 'Ver as chaves', href: x.link('conectar') });
  if (x.problem === 'item') return on('item', { t: 'O Pluggy não achou a conexão.', d: `Você está vendo os dados de ${since}. Confira o Item ID.`, a: 'Ver como reconectar', href: x.link('conectar') });
  if (x.problem) {
    const who = x.items.length > 1 ? x.items.filter((i) => i.problem).map((i) => i.bank).filter(Boolean).join(' e ') : '';
    return on('bank', { t: who ? `${who} não respondeu.` : 'O banco não respondeu.', d: `Você está vendo os dados de ${since}${n === 1 ? ', de ontem' : n > 1 ? `, há ${n} dias` : ''}. Nada se perdeu.`, a: 'Tentar de novo' });
  }
  if (n > 2) return on('old', { t: 'Os dados estão parados.', d: `A última leitura do banco foi em ${since}, há ${n} dias.`, a: 'Tentar de novo' });
  if (until) {
    const left = daysBetween(x.today, localDate(until).slice(0, 10));
    if (left >= 0 && left <= 30 && !st.closed.has('soon')) return on('soon', { t: left === 0 ? 'A autorização vence hoje.' : left === 1 ? 'A autorização vence amanhã.' : `A autorização vence em ${left} dias.`, d: 'Depois disso o app para de receber dados novos.', a: 'Ver como reconectar', href: x.link('conectar') });
  }
  if (x.up?.problem) return on('up-bad', { t: 'A versão nova não baixou.', d: 'Nada mudou. Confira a internet e tente de novo.', a: x.here && 'Tentar de novo', act: 'update' });
  if (x.up?.undone && !x.up.next) return on('up-undone', { t: `A versão ${x.up.undone} não abriu.`, d: 'O app voltou para a versão anterior. Seus dados estão iguais.' });
  if (x.up?.next) return on('up', { t: `Há uma versão nova, a ${x.up.next}.`, d: x.here ? x.up.notes : 'Atualize no computador onde o app está.', a: x.here && 'Atualizar', act: 'update' });
  return null;
}

// ---- drawing ---------------------------------------------------------------------------------
const PAGES = { inicio: S.inicio, extrato: S.extrato, patrimonio: S.patrimonio, faturas: S.faturas, ajustes: S.ajustes, regras: S.regras, conectar: S.conectar };
const TITLES = { inicio: 'Início', extrato: 'Extrato', patrimonio: 'Patrimônio', faturas: 'Faturas', ajustes: 'Ajustes', regras: 'Regras', conectar: 'Conectar' };
function keepFocus(root, draw) {
  const el = document.activeElement, id = root.contains(el) ? el.id : '', at = id && 'selectionStart' in el ? el.selectionStart : null;
  const slid = () => [...root.querySelectorAll('.mc,.is-scroll,.menu')].map((s, i) => [s.id || s.className + i, s]);
  const was = new Map(slid().map(([k, s]) => [k, [s.scrollLeft, s.scrollTop]]));
  draw();
  for (const [k, s] of slid()) [s.scrollLeft, s.scrollTop] = was.get(k) ?? [0, 0];
  if (!id) return;
  const next = $(id);
  if (!next) return;
  next.focus({ preventScroll: true });
  if (at !== null) try { next.setSelectionRange(at, at); } catch { /* not a text field */ }
}
let last = '';
function draw() {
  if (!st.data) return;
  let x = context();
  const first = (!x.readAt || st.connected) && x.route.name !== 'conectar';
  const name = st.page = first || !Object.hasOwn(PAGES, x.route.name) ? (first ? 'conectar' : 'inicio') : x.route.name;
  document.title = TITLES[name] + ' · Finanças';
  const html = PAGES[name](x);
  keepFocus($('app'), () => { if (html !== last) $('app').innerHTML = last = html; });
  if (['inicio', 'extrato', 'patrimonio'].includes(name) && inner(x) !== x.inner) { // drawn as wide as the page
    x = context();
    $('app').innerHTML = last = PAGES[name](x);
  }
  if (!$('app').querySelector('.mc')) st.slid = null;
  for (const c of $('app').querySelectorAll('.mc')) { // the chosen month comes into view once, then the person slides freely
    const now = c.querySelector('[aria-current]') ?? c.lastElementChild, key = c.id + (now?.dataset.m ?? '');
    if (now && st.slid !== key && (now.offsetLeft < c.scrollLeft || now.offsetLeft + now.offsetWidth > c.scrollLeft + c.clientWidth)) c.scrollLeft = now.offsetLeft - (c.clientWidth - now.offsetWidth) / 2;
    st.slid = key;
    edges(c);
  }
  for (const t of $('app').querySelectorAll('[data-some]')) t.indeterminate = true;
  const menu = $('app').querySelector('.menu');
  if (menu && !x.phone && menu.getBoundingClientRect().right > x.width - 16) menu.classList.add('is-right');
  layer(x);
}
function edges(c) {
  for (const b of $('app').querySelectorAll(`[data-for="${c.id}"]`)) b.disabled = +b.dataset.dir < 0 ? c.scrollLeft < 2 : c.scrollLeft > c.scrollWidth - c.clientWidth - 2;
}
function closeMenu(focus) {
  if (!st.menu) return;
  const b = $('m-' + st.menu);
  st.menu = null;
  last = '';
  b?.setAttribute('aria-expanded', 'false');
  b?.parentElement.querySelector('.menu')?.remove();
  if (focus) b?.focus();
}
function layer(x) {
  const dlg = $('layer'), q = x.route.q;
  const e = q.e && x.entries.find((o) => o.id === q.e), i = q.i && x.investments.find((o) => o.key === q.i);
  const open = x.readAt && (e || i);
  if (open) {
    const html = i ? S.investimento(x, i) : q.r ? S.regra(x, e, st.rule) : S.gasto(x, e);
    dlg.setAttribute('aria-label', i ? 'Investimento' : q.r ? 'Regra' : 'Gasto');
    const fresh = dlg.dataset.k !== (q.e ?? q.i) + (q.r ?? '');
    keepFocus(dlg, () => { dlg.innerHTML = html; });
    if (!dlg.open) dlg.showModal();
    if (fresh) {
      dlg.dataset.k = (q.e ?? q.i) + (q.r ?? '');
      dlg.scrollTop = 0;
      dlg.querySelector('[data-act="close"]')?.focus({ preventScroll: true });
    }
  } else if (dlg.open) {
    dlg.close();
    dlg.dataset.k = '';
  }
  document.documentElement.classList.toggle('is-layered', !!open);
}
function moved(restore) {
  const before = st.at ?? '', r = parse();
  st.at = r.name;
  if (!r.q.r) st.rule = {};
  if (r.name !== before) {
    st.more = 200;
    st.range = false;
    st.menu = null;
    st.justRead = false;
    if (r.name !== 'regras') st.lastUndone = null;
    if (r.name !== 'conectar') st.connected = false;
  }
  draw();
  if (restore !== undefined) scrollTo(0, restore);
}

// ---- server ----------------------------------------------------------------------------------
let locked = false;
function unlockForm(setup) {
  st.data = st.classified = null;
  st.page = 'owner';
  last = '';
  const dlg = $('layer');
  if (dlg.open) dlg.close();
  dlg.replaceChildren();
  document.documentElement.classList.remove('is-layered');
  document.title = 'Acesso · Finanças';
  locked = true;
  const canSetup = setup && setupCode;
  const title = setup ? 'Proteja seu Finanças' : 'Entre no Finanças';
  const transport = window.isSecureContext;
  const canEnter = transport && (!setup || canSetup);
  const submit = setup ? 'Criar senha' : 'Entrar';
  const accessPath = setup ? '/api/owner/setup' : '/api/owner/login';
  $('app').innerHTML = `<main class="connect owner"><div><h1 id="owner-title">${title}</h1>
    ${canEnter ? `<form id="owner-form" data-setup="${Boolean(canSetup)}" action="${accessPath}" method="post" aria-labelledby="owner-title">
      <div class="f"><label for="owner-password">Senha</label>
      <input class="fin-field" id="owner-password" name="password" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" enterkeyhint="done" minlength="12" maxlength="128" aria-describedby="owner-help owner-error" required>
      <p class="fin-small" id="owner-help">${setup ? 'Escolha uma senha com pelo menos 12 caracteres.' : 'Use a senha que você criou no computador do app.'}</p></div>
      <label><input id="owner-show" type="checkbox"> Mostrar senha</label>
      <button type="submit" class="fin-btn tall">${submit}</button><p id="owner-error" role="status"></p>
    </form>` : `<p class="lead">${transport ? 'Abra o Finanças pelo atalho no computador do app para criar sua senha.' : 'Abra o Finanças pelo atalho ou use o endereço HTTPS da rede privada.'}</p>`}
    </div></main>`;
  $('owner-password')?.focus();
}
async function api(path, init = {}) {
  const token = session, headers = new Headers(init.headers);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const r = await fetch(path, { ...init, headers });
  if (r.status === 401) {
    const info = await r.clone().json();
    if (token !== session) return r;
    remember(null);
    if (!locked) unlockForm(info.setup);
  }
  return r;
}
async function load() {
  const token = session, r = await api('/api/state');
  if (!r.ok) throw new Error('state');
  const data = await r.json();
  if (token !== session) throw new Error('session');
  st.data = data;
  st.classified = null;
  st.loadedAt = Date.now();
}
const post = async (path, body = {}) => {
  const r = await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok ? r.json() : null;
};
async function enterOwner(form) {
  const error = $('owner-error'), field = $('owner-password'), button = form.querySelector('button[type=submit]');
  if (button.disabled) return;
  const setup = form.dataset.setup === 'true';
  button.disabled = true;
  field.removeAttribute('aria-invalid');
  error.textContent = '';
  try {
    const r = await fetch(form.getAttribute('action'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: field.value, ...(setup ? { code: setupCode } : {}) }),
    });
    const info = await r.json();
    if (!r.ok) {
      if (r.status === 409) { setupCode = null; location.reload(); return; }
      error.textContent = ({
        'setup-code': 'Abra o app novamente pelo atalho. O código deste acesso venceu.',
        'password-length': 'A senha precisa ter de 12 a 128 caracteres.',
        password: 'Senha incorreta. Confira e tente de novo.',
        wait: 'Aguarde alguns segundos e tente de novo.',
      })[info.error] ?? 'O acesso não pôde ser concluído. Tente de novo.';
      if (info.error === 'password' || info.error === 'password-length') {
        field.setAttribute('aria-invalid', 'true');
        field.focus();
      }
      return;
    }
    remember(info.token);
    setupCode = null;
    form.reset();
    locked = false;
    await start();
  } catch {
    error.textContent = 'O app não respondeu. Tente de novo.';
  } finally { button.disabled = false; }
}
let watching = false;
async function watch() {
  if (watching || !st.data) return;
  watching = true;
  const first = !st.data.readAt || parse().name === 'conectar';
  for (;;) {
    await new Promise((r) => setTimeout(r, 700));
    let j = null;
    try { const r = await api('/api/job'); if (r.ok) j = await r.json(); } catch { /* the server is restarting */ }
    if (!st.data) { watching = false; return; }
    if (!j) continue;
    st.data.job = j.job;
    if (!j.job.running) break;
    draw();
  }
  watching = false;
  await load().catch(() => {});
  if (!st.data) return;
  st.closed.delete('run');
  st.justRead = !st.data.sync.problem;
  if (first) st.connected = !st.data.sync.problem && !!st.data.readAt;
  draw();
}
async function refresh() {
  st.closed.clear();
  st.data.job = { running: true, step: 0 };
  draw();
  await post('/api/refresh');
  watch();
}

async function update() {
  const was = st.data.version;
  st.closed.clear();
  st.data.up = { ...st.data.up, running: true, problem: null };
  draw();
  if (!(await post('/api/update').catch(() => null))) { await load().catch(() => {}); return draw(); }
  let gone = false;
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 700));
    let j = null;
    try { const r = await api('/api/job'); if (r.ok) j = await r.json(); } catch { gone = true; }
    if (!st.data) return;
    if (!j) continue;
    if (j.up.version !== was) return location.reload();
    if (gone || j.up.problem || j.up.undone) break;
  }
  if (gone) await new Promise((r) => setTimeout(r, 1500)); // swap.mjs writes what happened after the app is back
  await load().catch(() => {});
  draw();
}

// ---- events ----------------------------------------------------------------------------------
function setParam(k, v) {
  const r = parse();
  if (k === 'range') Object.assign(r.q, { min: null, max: null });
  else r.q[k] = v || null;
  if (k === 'g' || k === 'f') r.q.s = null;
  if (k === 's' || k === 'q') r.q.d = k === 'q' ? null : r.q.d;
  if (k === 'b') r.q.f = null;
  if (k === 'm') r.q.d = null;
  st.more = 200;
  go(make(r.name, r.q), true);
  draw();
}
const closeLayer = () => {
  const r = parse();
  if (history.state?.over && history.state.n > 0) return history.back();
  go(make(r.name, { ...r.q, e: null, i: null, r: null }), true);
  moved();
};
const ACT = {
  hide() { st.hide = !st.hide; tab.set('fin-hide', st.hide ? '1' : '0'); draw(); },
  refresh,
  update,
  reload: () => location.reload(),
  async 'sign-out'() {
    await post('/api/owner/logout').catch(() => {});
    remember(null);
    unlockForm(false);
  },
  enter() { st.connected = false; go('#/inicio'); moved(0); },
  'close-note'() { const n = context().notice; if (n) st.closed.add(n.kind); draw(); },
  flip(el) {
    const view = parse().q.v === 'in' ? 'in' : 'out', L = st.off[view], v = el.dataset.v;
    st.off[view] = L.includes(v) ? L.filter((o) => o !== v) : [...L, v];
    draw();
  },
  view(el) { st.balls = el.dataset.v === 'balls'; tab.set('fin-view', el.dataset.v); draw(); },
  slide(el) { const c = $(el.dataset.for); c.scrollBy({ left: +el.dataset.dir * Math.max(200, c.clientWidth * 0.8), behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' }); },
  menu(el) {
    if (st.menu === el.dataset.v) return closeMenu(true);
    st.menu = el.dataset.v;
    draw();
  },
  range() { st.range = !st.range; draw(); if (st.range) $('r-min')?.focus(); },
  clear() { const r = parse(); go(make('extrato', { m: r.q.m, a: r.q.a === '-' ? null : r.q.a, f: r.q.f === 'all' ? 'all' : null }), true); st.range = false; draw(); },
  more() { st.more += 200; draw(); },
  theme(el) { local.set('fin-theme', el.dataset.v); window.finTheme(); draw(); },
  'open-hidden'(el) { local.set('fin-open-hidden', el.dataset.v); draw(); },
  close: closeLayer,
  back() { if (history.state?.over) history.back(); else closeLayer(); },
  async undo(el) {
    const id = el.dataset.v, rule = st.data.rules.find((r) => r.id === id);
    if (!(await post('/api/rules/undo', { id }))) return;
    await load();
    const e = classify(st.data.entries, st.data.rules, st.data.bills).find((o) => o.key === rule.key && o.flow === 'out');
    st.lastUndone = { ...rule, back: e?.g ?? 'outros' };
    draw();
  },
  async restore(el) { if (await post('/api/rules/restore', { id: el.dataset.v })) { st.lastUndone = null; await load(); draw(); } },
  async 'save-rule'(el) {
    const e = context().entries.find((o) => o.id === parse().q.e), { k, cat, dir } = el.dataset;
    if (!e) return;
    el.disabled = true;
    const had = st.data.rules.find((r) => r.key === e.key && r.dir === dir);
    let r;
    if (dir === 'in' && e.flow === null) r = had ? await post('/api/rules/undo', { id: had.id }) : null;
    else r = await post('/api/rules', { key: e.key, name: e.name, dir, treat: k === 'B' ? cat : 'none' });
    if (!r) return draw();
    st.rule = { ...st.rule, k, cat, done: r.rule.id, undoing: dir === 'in' && e.flow === null };
    await load();
    draw();
  },
  async 'undo-here'() {
    const { done, undoing } = st.rule;
    await post(undoing ? '/api/rules/restore' : '/api/rules/undo', { id: done });
    st.rule = {};
    await load();
    draw();
  },
};
document.addEventListener('click', (ev) => {
  if (st.menu && !ev.target.closest('.multi')) closeMenu();
  const el = ev.target.closest('[data-act],[data-set],[data-month],[data-cat],a[href^="#/"]');
  if (!el || el.disabled) {
    if (ev.target === $('layer')) { // a touch outside the panel
      const b = $('layer').getBoundingClientRect();
      if (ev.clientX < b.left) closeLayer();
    }
    return;
  }
  if (el.dataset.act && Object.hasOwn(ACT, el.dataset.act)) {
    ev.preventDefault();
    return void ACT[el.dataset.act](el);
  }
  if (el.dataset.set) return void setParam(el.dataset.set, el.dataset.v);
  if (el.dataset.month) return void setParam('m', el.dataset.month);
  if (el.dataset.cat && el.tagName === 'BUTTON') { st.rule.cat = el.dataset.cat; return void draw(); }
  if (el.matches('a') && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.button === 0) {
    ev.preventDefault();
    const to = el.getAttribute('href'), same = to.split('?')[0] === location.hash.split('?')[0] && /[?&](e|i)=/.test(to + location.hash);
    go(to);
    moved(same ? undefined : 0);
  }
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.id === 'owner-show') { $('owner-password').type = el.checked ? 'text' : 'password'; return; }
  if (!st.data) return;
  if (el.dataset.opt) { st.rule.k = el.dataset.opt; return draw(); }
  if (el.dataset.tick) {
    const k = el.dataset.tick, all = [...el.closest('.menu').querySelectorAll('[data-tick]')].slice(1), on = el.value === '*' ? (el.checked ? all : []) : all.filter((o) => o.checked);
    return setParam(k, on.length === all.length ? (k === 'f' ? 'all' : null) : on.map((o) => o.value).join() || '-');
  }
  const p = el.dataset.pick;
  if (!p) return;
  if (p === 'p-month') { const r = parse(); r.q.m = el.value; r.q.d = null; go(make(r.name, r.q), true); draw(); }
});
document.addEventListener('scroll', (ev) => { if (ev.target.classList?.contains('mc')) edges(ev.target); }, true);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && st.menu) closeMenu(true); });
document.addEventListener('focusout', (ev) => { if (st.menu && ev.relatedTarget && ev.target.closest?.('.multi') && !ev.relatedTarget.closest('.multi')) closeMenu(); });
let typing;
document.addEventListener('input', (ev) => {
  if (ev.target.id !== 'q') return;
  clearTimeout(typing);
  typing = setTimeout(() => setParam('q', ev.target.value), 120);
});
document.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (locked && ev.target === $('owner-form')) return enterOwner(ev.target);
  if (!st.data) return;
  const f = new FormData(ev.target);
  if (ev.target.dataset.form === 'range') {
    const n = (s) => { const v = parseFloat(String(s ?? '').replace(/\./g, '').replace(',', '.')); return v > 0 ? String(v) : null; };
    const r = parse();
    Object.assign(r.q, { min: n(f.get('min')), max: n(f.get('max')), d: null });
    st.range = false;
    go(make(r.name, r.q), true);
    draw();
  }
  if (ev.target.dataset.form === 'connect' && st.page === 'conectar') { // keys are typed on that page only
    const body = Object.fromEntries(f);
    const r = await post('/api/connect', body);
    ev.target.reset();
    if (!st.data) return;
    st.connected = false;
    if (!r) st.data.sync.problem = 'keys';
    else {
      st.data.job = { running: true, step: 0 };
      watch();
    }
    draw();
  }
});
$('layer').addEventListener('cancel', (ev) => { ev.preventDefault(); closeLayer(); });
addEventListener('popstate', () => moved(history.state?.y ?? 0));
narrow.addEventListener('change', draw);
let size, wide = innerWidth;
addEventListener('resize', () => { if (innerWidth !== wide) st.slid = null; wide = innerWidth; clearTimeout(size); size = setTimeout(draw, 120); });
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !st.data || Date.now() - st.loadedAt < 5 * 60000) return;
  await load().catch(() => {});
  draw();
  if (st.data?.job.running) watch();
});

setInterval(() => { if (!document.hidden && st.data && !st.data.job.running && Date.now() - st.loadedAt > 15 * 60000) load().then(draw, () => {}); }, 60000);

async function start() {
  await load();
  if (!history.state) history.replaceState({ y: 0, n: 0 }, '');
  moved();
  if (st.data.job.running || (!st.data.readAt && st.data.hasKeys && !st.data.sync.problem)) watch();
}
start().catch(() => {
  if (locked) return;
  $('app').innerHTML = '<main class="connect"><div><h1>O app não respondeu.</h1><p class="lead">Confira se o computador está ligado e tente de novo.</p><button type="button" class="fin-btn tall" data-act="reload">Tentar de novo</button></div></main>';
});
