@echo off
title IPARK - Start Services
echo ==========================================
echo Dang khoi dong Backend va Frontend...
echo ==========================================

:: Khoi dong Backend
echo Dang chay Backend...
start "iPARK Backend" cmd /k "cd /d %~dp0backend && npm run dev"

:: Khoi dong Frontend
echo Dang chay Frontend...
start "iPARK Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: Tu dong mo trinh duyet
echo Dang mo trinh duyet...
timeout /t 3 >nul
start http://localhost:3000

echo ==========================================
echo Da khoi dong ca 2 dich vu trong cua so moi!
echo ==========================================
pause