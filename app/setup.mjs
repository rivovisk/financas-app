// Installs or removes the app on Windows, for this user only, with no administrator. node setup.mjs install|remove
// Installing over an older copy keeps the data: data and keys are in another folder.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { ask } from './lib/proof.mjs';

const FROM = fileURLToPath(new URL('.', import.meta.url));
const HOME = resolve(process.env.FIN_HOME ?? join(homedir(), 'Financas')), APP = join(HOME, 'app');
const DATA = resolve(process.env.FIN_DATA ?? join(homedir(), '.financas-pessoais'));
const PORT = Number(process.env.PORT) || 5092;
const q = (s) => "'" + String(s).replace(/['\u2018\u2019\u201a\u201b]/g, '$&$&') + "'"; // PowerShell takes the curved ones too
// Encoded, so accents and spaces in the person's folder arrive whole.
function ps(script) {
  const r = spawnSync(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from("$ErrorActionPreference='Stop';" + script, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error('powershell');
  return r.stdout.trim();
}
const desktop = process.env.FIN_LINKS ? q(process.env.FIN_LINKS) : "[Environment]::GetFolderPath('Desktop')";
const startup = process.env.FIN_LINKS ? q(join(process.env.FIN_LINKS, 'startup')) : "[Environment]::GetFolderPath('Startup')";

// Stops only the node of this app: a private network (tailscale serve) may listen on the same port, on another address.
async function stop() {
  const h = await ask(PORT, DATA);
  if (h === null) return;
  if (!h) throw new Error('port');
  ps(`foreach ($c in Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort ${PORT} -State Listen) { if ((Get-Process -Id $c.OwningProcess).ProcessName -eq 'node') { Stop-Process -Id $c.OwningProcess -Force } }; Start-Sleep -Milliseconds 800`);
}
const link = (folder, args) => `$null = New-Item -ItemType Directory -Force -Path (${folder}); $l = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path (${folder}) 'Financas.lnk')); $l.TargetPath = ${q(process.execPath)}; $l.Arguments = ${q(`"${join(APP, 'open.mjs')}"${args}`)}; $l.WorkingDirectory = ${q(HOME)}; $l.WindowStyle = 7; $l.Description = 'Financas'; $l.Save();`;

// Erases only a folder that is this app.
function clear() {
  if (!existsSync(APP)) return;
  if (!existsSync(join(APP, 'install.json'))) throw new Error('folder');
  rmSync(APP, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}
const what = process.argv[2];
try {
  if (process.platform !== 'win32') throw new Error('windows');
  if (what === 'install') {
    if (!existsSync(join(FROM, 'install.json'))) throw new Error('package');
    if (resolve(FROM) !== resolve(APP)) {
      await stop();
      clear();
      cpSync(FROM, APP, { recursive: true });
    }
    ps(link(desktop, '') + link(startup, ' --quiet'));
    const r = spawnSync(process.execPath, [join(APP, 'open.mjs'), ...(process.env.FIN_LINKS ? ['--quiet'] : [])], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('open');
    console.log(`\nPronto. O Finanças está em http://127.0.0.1:${PORT}\nHá um atalho na área de trabalho, e ele liga junto com o Windows.\nPode apagar esta pasta: o app foi copiado para ${HOME}`);
  } else if (what === 'remove') {
    await stop();
    ps(`foreach ($f in @((${desktop}), (${startup}))) { $p = Join-Path $f 'Financas.lnk'; if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p } }`);
    clear();
    console.log(`\nO app foi removido. Seus dados e chaves continuam em:\n${DATA}\nPara apagar tudo de vez, apague essa pasta. O histórico do patrimônio não volta.`);
  } else throw new Error('use');
} catch (e) {
  const why = {
    windows: 'Este instalador é só para Windows.', package: 'Faltam arquivos. Baixe o ZIP de novo e extraia tudo.', port: `Outro programa usa a porta ${PORT}.`,
    folder: `A pasta ${APP} tem outra coisa dentro. Mude o nome dela e tente de novo.`,
    powershell: 'O Windows não deixou criar o atalho ou parar o app.', open: 'O app foi copiado, mas não abriu.', use: 'Use: node setup.mjs install ou node setup.mjs remove',
  };
  console.error('\nNão deu certo. ' + (why[e.message] ?? 'Feche o Finanças, reinicie o computador e tente de novo.'));
  process.exitCode = 1;
}
