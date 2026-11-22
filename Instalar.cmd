@echo off
setlocal
chcp 65001 >nul
title Financas
if not exist "%~dp0app\setup.mjs" (
  echo Extraia o ZIP inteiro antes: botao direito no ZIP, Extrair tudo.
  pause
  exit /b 1
)
if not defined FIN_HOME set "FIN_HOME=%USERPROFILE%\Financas"
set "NODE=%FIN_HOME%\node\node.exe"
rem The Node of this app, the one of the computer (20 or newer), or a new one, in this order.
if exist "%NODE%" goto run
node -e "process.exit(+process.versions.node.split(String.fromCharCode(46))[0] >= 20 ? 0 : 1)" >nul 2>nul
if not errorlevel 1 (
  set "NODE=node"
  goto run
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0node.ps1" "%FIN_HOME%\node"
if errorlevel 1 (
  pause
  exit /b 1
)
:run
"%NODE%" "%~dp0app\setup.mjs" install
set "CODE=%errorlevel%"
pause
exit /b %CODE%
