// Starts the app if it is not running, then opens it in the browser. node open.mjs [--quiet] (no browser).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { ask } from './lib/proof.mjs';
import { setupCode } from './lib/owner.mjs';

const app = fileURLToPath(new URL('.', import.meta.url)), port = Number(process.env.PORT) || 5092, url = 'http://127.0.0.1:' + port; // the address the app listens on, not a name another program could take
const data = process.env.FIN_DATA ?? join(homedir(), '.financas-pessoais');

let up = await ask(port, data);
if (up === null) {
  mkdirSync(data, { recursive: true, mode: 0o700 });
  const log = openSync(join(data, 'app.log'), 'w'); // event names only, never data
  spawn(process.execPath, [join(app, 'server.mjs')], { detached: true, windowsHide: true, cwd: app, stdio: ['ignore', log, log] }).unref();
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 250));
    up = await ask(port, data);
  }
}
if (!up) {
  console.error('O Finanças não abriu. Feche o que usa a porta ' + port + ' ou reinicie o computador e tente de novo.');
  process.exitCode = 1;
} else if (!process.argv.includes('--quiet')) {
  const code = setupCode(data);
  const page = code ? url + '/#owner=' + code : url;
  if (process.platform === 'darwin') {
    const opened = spawnSync('/usr/bin/open', [page], { stdio: 'ignore' });
    if (opened.status !== 0) {
      console.error('O Finanças iniciou, mas não conseguiu abrir o navegador. Confira o navegador padrão do Mac e tente de novo.');
      process.exitCode = 1;
    }
  } else {
    // explorer.exe with an address opens a folder on some Windows 11 computers, and the setup page never appears.
    spawn(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'rundll32.exe'), ['url.dll,FileProtocolHandler', page], { detached: true, stdio: 'ignore' }).unref();
  }
}
