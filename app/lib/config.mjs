// Where things live. Nothing personal: every path comes from the machine or from an environment variable.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const APP = resolve(fileURLToPath(import.meta.url), '../..');
// Not in AppData: Windows shows packaged programs (the Claude app is one) a private copy of it, so the app
// started by one and by the other would keep two different histories.
export const DATA = resolve(process.env.FIN_DATA ?? join(homedir(), '.financas-pessoais'));
export const PORT = Number(process.env.PORT) || 5092;
export const API = process.env.PLUGGY_API_URL ?? 'https://api.pluggy.ai'; // the override is for tests
// Only an installed copy has install.json: its version, where new ones are published and who signs them.
export const INSTALL = (() => { try { return JSON.parse(readFileSync(join(APP, 'install.json'), 'utf8')); } catch { return null; } })();
export const now = () => (process.env.FIN_NOW ? Date.parse(process.env.FIN_NOW) : Date.now()); // fixed clock for tests
export const NAMES = ['PLUGGY_CLIENT_ID', 'PLUGGY_CLIENT_SECRET', 'PLUGGY_ITEM_ID'];

mkdirSync(DATA, { recursive: true });

// The keys live with the data, outside the app folder, so a new version can never erase them.
export const envPath = () => resolve(process.env.FIN_ENV ?? join(DATA, '.env'));
export function keys() {
  let text = '';
  try { text = readFileSync(envPath(), 'utf8'); } catch { return null; }
  const get = (n) => (text.match(new RegExp(`^[ \t]*${n}[ \t]*=[ \t]*(.*)$`, 'm'))?.[1] ?? '').trim().replace(/^(["'])(.*)\1$/, '$2');
  const [id, secret, item] = NAMES.map(get);
  if (!id || !secret || !item) return null;
  return { id, secret, items: item.split(',').map((s) => s.trim()).filter(Boolean) };
}
// Replaces only the three lines of this app; every other line stays as it was.
export function saveKeys(values) {
  const path = envPath();
  let text = '';
  try { text = readFileSync(path, 'utf8'); } catch { /* first run */ }
  for (const n of NAMES) {
    const line = `${n}=${values[n]}`, re = new RegExp(`^[ \t]*${n}[ \t]*=.*$`, 'm');
    text = re.test(text) ? text.replace(re, () => line) : text + (text && !text.endsWith('\n') ? '\n' : '') + line + '\n';
  }
  writeFileSync(path, text, { mode: 0o600 });
}
