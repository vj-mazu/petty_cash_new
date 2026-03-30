@echo off
title Petty Cash Management System
set NODE_OPTIONS=--dns-result-order=ipv4first
echo ============================================
echo   Petty Cash Management System - Startup
echo ============================================
echo.

:: Install backend dependencies (skip if node_modules exists)
echo [1/4] Checking backend dependencies...
cd /d "%~dp0backend"
if not exist "node_modules\" (
    echo Installing backend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Backend dependency installation failed!
        pause
        exit /b 1
    )
) else (
    echo Backend dependencies already installed. Skipping.
)
echo.

:: Install frontend dependencies (skip if node_modules exists)
echo [2/4] Checking frontend dependencies...
cd /d "%~dp0frontend"
if not exist "node_modules\" (
    echo Installing frontend dependencies...
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo ERROR: Frontend dependency installation failed!
        pause
        exit /b 1
    )
) else (
    echo Frontend dependencies already installed. Skipping.
)
echo.

:: Start backend server in a new window
echo [3/4] Starting backend server...
cd /d "%~dp0backend"
start "Petty Cash - Backend" cmd /k "node start.js"
echo Backend starting on port 5000...
echo.

:: Wait a few seconds for backend to initialize
timeout /t 5 /nobreak >nul

:: Start frontend in a new window
echo [4/4] Starting frontend...
cd /d "%~dp0frontend"
start "Petty Cash - Frontend" cmd /k "npm start"
echo Frontend starting on port 3000...
echo.

echo ============================================
echo   Both servers are starting!
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo ============================================
echo.
echo You can close this window. The servers
echo are running in their own windows.
pause
