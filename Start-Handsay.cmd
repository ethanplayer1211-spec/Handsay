@echo off
cd /d "%~dp0"
node scripts/launch-desktop.mjs
if errorlevel 1 pause
