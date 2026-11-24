@echo off
setlocal
chcp 65001 >nul
title Financas
if not defined FIN_HOME set "FIN_HOME=%USERPROFILE%\Financas"
for %%I in ("%FIN_HOME%") do set "FIN_HOME=%%~fI"
if not exist "%FIN_HOME%\app\install.json" (
  echo O Financas nao esta instalado nesta pasta.
  pause
  exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0node.ps1" "%FIN_HOME%\node"
if errorlevel 1 (
  pause
  exit /b 1
)
"%FIN_HOME%\node\node.exe" "%~dp0app\setup.mjs" remove
set "CODE=%errorlevel%"
if "%CODE%"=="0" (
  del /q "%FIN_HOME%\node\node.exe" "%FIN_HOME%\node\LICENSE" >nul 2>nul
  rd "%FIN_HOME%\node" >nul 2>nul
  rd "%FIN_HOME%" >nul 2>nul
)
pause
exit /b %CODE%
