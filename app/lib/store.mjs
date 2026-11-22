// JSON files in the data folder. Written to a temporary file and renamed, so a crash never leaves half a
// file, and the version before stays as .bak.
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA } from './config.mjs';

const file = (name) => join(DATA, name + '.json');
export function load(name, empty) {
  for (const p of [file(name), file(name) + '.bak']) {
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch { /* try the copy, then start empty */ }
  }
  return structuredClone(empty);
}
export function save(name, value) {
  const p = file(name);
  writeFileSync(p + '.new', JSON.stringify(value));
  if (existsSync(p)) copyFileSync(p, p + '.bak');
  renameSync(p + '.new', p);
}
export const EMPTY = {
  data: { readAt: null, items: [], accounts: [], entries: [], bills: [], investments: [] },
  rules: { rules: [], undone: [] },
  wealth: { photos: [] },
  sync: { lastTry: null, lastOk: null, problem: null },
  settings: { hosts: [], frames: [] },
};
