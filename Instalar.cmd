@echo off
chcp 65001 >nul
title Financas
if not exist "%~dp0app\setup.mjs" (
  echo Extraia o ZIP inteiro antes: botao direito no ZIP, Extrair tudo.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Falta o Node. A pagina dele vai abrir. Instale a versao LTS e clique aqui de novo.
  start "" https://nodejs.org/pt/download
  pause
  exit /b 1
)
node -e "process.exit(+process.versions.node.split(String.fromCharCode(46))[0] >= 20 ? 0 : 1)"
if errorlevel 1 (
  echo O Node deste computador e antigo. Instale a versao LTS e clique aqui de novo.
  start "" https://nodejs.org/pt/download
  pause
  exit /b 1
)
node "%~dp0app\setup.mjs" install
pause
