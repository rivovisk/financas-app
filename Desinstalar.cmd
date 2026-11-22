@echo off
chcp 65001 >nul
title Financas
node "%~dp0app\setup.mjs" remove
pause
