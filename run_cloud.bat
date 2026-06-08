@echo off
REM JARVIS Hybrid - Cloud Server (Next.js Dev Server)
REM Runs the web app and cloud backend on http://localhost:3000

echo.
echo ============================================================
echo   JARVIS Hybrid - Cloud Backend
echo ============================================================
echo.
echo Starting Next.js dev server on http://localhost:3000
echo Press Ctrl+C to stop
echo.

REM Check if node_modules exists
if not exist node_modules (
    echo Installing npm dependencies first...
    call npm install
)

REM Start Next.js dev server
npm run dev

pause
