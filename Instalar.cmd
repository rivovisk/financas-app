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
for %%I in ("%FIN_HOME%") do set "FIN_HOME=%%~fI"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0node.ps1" "%FIN_HOME%\node"
if errorlevel 1 (
  pause
  exit /b 1
)
"%FIN_HOME%\node\node.exe" "%~dp0app\setup.mjs" install
set "CODE=%errorlevel%"
pause
exit /b %CODE%
