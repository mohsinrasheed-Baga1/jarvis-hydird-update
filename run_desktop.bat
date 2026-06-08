@echo off
REM JARVIS Hybrid - Desktop App
REM Runs the modern Electron desktop app. Electron starts the cloud backend and Python automation agent.

cd /d "%~dp0"

echo.
echo ============================================================
echo   JARVIS Hybrid - Desktop Agent
echo ============================================================
echo.

if not exist node_modules (
    echo Installing root backend dependencies...
    call npm install
)

if not exist desktop-app\node_modules (
    echo Installing desktop app dependencies...
    cd /d "%~dp0desktop-app"
    call npm install
    cd /d "%~dp0"
)

echo.
echo Starting modern desktop app...
echo.
echo Electron will start:
echo   - Modern React desktop UI
echo   - Local cloud backend
echo   - Python automation agent
echo.

cd /d "%~dp0desktop-app"
call npm.cmd run dev

pause
