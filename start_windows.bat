@echo off
cd /d "%~dp0"
echo Starting MyEV (React + Vite)...
call npm install
if errorlevel 1 (echo npm install failed. Install Node.js 20+ and check your internet connection.& pause & exit /b 1)
call npm run dev
pause
