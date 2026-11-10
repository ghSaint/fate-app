@echo off
rem Starts Pillars & Palaces with the local server, so the AI features can use
rem Claude Code (your Claude login) or LM Studio. Close this window to stop it.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b 1)
start "" http://localhost:8787
node server.js
pause
