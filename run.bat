@echo off
setlocal EnableDelayedExpansion
title iPARK - Start All Services

cd /d "%~dp0"

echo ==========================================
echo   iPARK - Khoi dong toan bo he thong
echo ==========================================
echo.

REM ---------- Kiem tra dieu kien ----------
if not exist ".venv\Scripts\python.exe" (
    echo [LOI] Khong tim thay Python venv: .venv\Scripts\python.exe
    echo       Tao bang lenh: python -m venv .venv
    echo       Sau do:        .venv\Scripts\pip install -r ai-service\requirements.txt
    goto :fail
)

if not exist "node_modules" (
    echo [LOI] Chua cai node_modules. Chay: npm install
    goto :fail
)

if not exist "backend\.env" (
    echo [CANH BAO] Khong tim thay backend\.env
)

if not exist "ai-service\.env" (
    echo [CANH BAO] Khong tim thay ai-service\.env
)

REM ---------- Kiem tra MongoDB ----------
echo [1/5] Kiem tra MongoDB tren cong 27017...
powershell -NoProfile -Command "if ((Test-NetConnection -ComputerName localhost -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue)) { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo       [CANH BAO] MongoDB khong phan hoi tren 27017.
    echo       Backend se khong ket noi duoc DB. Khoi dong MongoDB truoc.
    echo.
) else (
    echo       MongoDB OK.
)

REM ---------- Giai phong cac cong dang bi chiem ----------
echo [2/5] Giai phong cong 3000 / 4000 / 5050...
powershell -NoProfile -Command "foreach ($p in 3000,4000,5050) { $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; foreach ($x in $c) { try { Stop-Process -Id $x.OwningProcess -Force -ErrorAction Stop; Write-Host ('      Da dong PID ' + $x.OwningProcess + ' (cong ' + $p + ')') } catch {} } }"

REM ---------- Backend ----------
echo [3/5] Khoi dong Backend (cong 4000)...
start "iPARK Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 6 /nobreak >nul

REM ---------- AI / Bridge service ----------
echo [4/5] Khoi dong AI-Service / Bridge (cong 5050)...
start "iPARK AI-Service" cmd /k "cd /d "%~dp0" && ".venv\Scripts\python.exe" "ai-service\app.py""
timeout /t 3 /nobreak >nul

REM ---------- Frontend ----------
echo [5/5] Khoi dong Frontend (cong 3000)...
start "iPARK Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ==========================================
echo   Da khoi dong 3 service trong 3 cua so
echo ==========================================
echo   Frontend    : http://localhost:3000
echo   Backend API : http://localhost:4000/api
echo   AI / Bridge : http://localhost:5050
echo.
echo   Dong toan bo: chay stop.bat
echo ==========================================
echo.
echo Cho frontend bien dich xong roi mo trinh duyet...
timeout /t 12 /nobreak >nul
start "" http://localhost:3000
goto :end

:fail
echo.
echo Khoi dong that bai. Kiem tra lai cac loi o tren.
pause
exit /b 1

:end
echo Xong. Cua so nay co the dong.
pause
exit /b 0
