// The state of the app: reads, rules, wealth photos. The server and the tools use this, nothing else writes.
import { randomUUID } from 'node:crypto';
import { keys, now } from './config.mjs';
import { collect } from './collect.mjs';
import { isDue } from './schedule.mjs';
import { EMPTY, load, save } from './store.mjs';
import { Problem } from './pluggy.mjs';
import { cleanName } from './normalize.mjs';
import { classify } from '../web/core/classify.mjs';
import { GROUPS } from '../web/core/categories.mjs';
import { photo, wealthNow } from '../web/core/views.mjs';
import { today } from '../web/core/format.mjs';

export const state = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, load(k, EMPTY[k])]));
export const job = { running: false, step: 0, problem: null };
const log = (text) => console.log(new Date().toISOString(), text); // event names only, never data

export function takePhoto() {
  const d = today(now());
  const entries = classify(state.data.entries, state.rules.rules, state.data.bills);
  const p = photo(wealthNow({ ...state.data, entries, today: d }), d);
  state.wealth.photos = [...state.wealth.photos.filter((x) => x.d !== d), p].sort((a, b) => (a.d < b.d ? -1 : 1));
  save('wealth', state.wealth);
}

export async function refresh(withKeys = keys()) {
  if (job.running) return job;
  Object.assign(job, { running: true, step: 0, problem: null, accepted: false });
  const at = new Date(now()).toISOString();
  try {
    if (!withKeys) throw new Problem('nokeys');
    const r = await collect(withKeys, state.data, now(), (n) => { job.step = n; });
    job.accepted = true; // Pluggy took the keys, whatever the bank answered
    state.data = r.data;
    save('data', state.data);
    if (r.good) {
      takePhoto();
      job.step = 3;
    }
    state.sync = { lastTry: at, lastOk: r.good ? at : state.sync.lastOk, problem: r.problem };
    job.problem = r.problem;
  } catch (e) {
    const kind = e instanceof Problem ? e.kind : 'bank';
    if (!(e instanceof Problem)) log('read failed: internal ' + e.name);
    state.sync = { ...state.sync, lastTry: at, problem: kind };
    job.problem = kind;
  } finally {
    try { if (job.problem !== 'nokeys') save('sync', state.sync); } catch { log('could not save'); }
    job.running = false;
    log('read ' + (job.problem ? 'problem: ' + job.problem : 'ok'));
  }
  return job;
}
export function tick() {
  if (!job.running && keys() && isDue(state.sync, state.data.items, now())) return refresh();
}

// Rules are by recipient, one per direction. Undone ones stay in a list, so they can come back.
const TREATS = new Set([...GROUPS.map((g) => g.id), 'none']);
export function addRule({ key, name, dir, treat }) {
  if (typeof key !== 'string' || !key || key.length > 200 || !['out', 'in'].includes(dir) || !TREATS.has(treat) || (dir === 'in' && treat !== 'none')) return null;
  if (!state.data.entries.some((e) => e.key === key) && key !== 'COBRANCA SEM NOME NA FATURA') return null;
  const rule = { id: randomUUID().slice(0, 8), key, name: cleanName(String(name ?? '').slice(0, 120)) || key, dir, treat, at: today(now()) };
  const old = state.rules.rules.find((r) => r.key === key && r.dir === dir);
  if (old) rule.before = { treat: old.treat, at: old.at };
  state.rules.rules = [...state.rules.rules.filter((r) => r !== old), rule];
  save('rules', state.rules);
  return rule;
}
export function undoRule(id) {
  const rule = state.rules.rules.find((r) => r.id === id);
  if (!rule) return null;
  state.rules.rules = state.rules.rules.filter((r) => r !== rule);
  if (rule.before) state.rules.rules.push({ ...rule, ...rule.before, id: randomUUID().slice(0, 8), before: undefined }); // the rule it replaced comes back
  state.rules.undone = [...state.rules.undone.filter((r) => !(r.key === rule.key && r.dir === rule.dir)), rule].slice(-50);
  save('rules', state.rules);
  return rule;
}
export function restoreRule(id) {
  const rule = state.rules.undone.find((r) => r.id === id);
  if (!rule || state.rules.rules.some((r) => r.key === rule.key && r.dir === rule.dir)) return null;
  state.rules.undone = state.rules.undone.filter((r) => r !== rule);
  state.rules.rules = [...state.rules.rules, rule];
  save('rules', state.rules);
  return rule;
}
