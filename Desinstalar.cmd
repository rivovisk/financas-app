@echo off
setlocal
chcp 65001 >nul
title Financas
if not defined FIN_HOME set "FIN_HOME=%USERPROFILE%\Financas"
set "NODE=%FIN_HOME%\node\node.exe"
if not exist "%NODE%" set "NODE=node"
"%NODE%" "%~dp0app\setup.mjs" remove
set "CODE=%errorlevel%"
rem The Node of this app goes too. Only its two files, and the folders only if nothing else is inside.
if "%CODE%"=="0" (
  del /q "%FIN_HOME%\node\node.exe" "%FIN_HOME%\node\LICENSE" >nul 2>nul
  rd "%FIN_HOME%\node" >nul 2>nul
  rd "%FIN_HOME%" >nul 2>nul
)
pause
exit /b %CODE%
