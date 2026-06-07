@echo off
REM JARVIS Hybrid - Start All Services
REM Launches both cloud and desktop agents in separate windows

echo.
echo ============================================================
echo   JARVIS Hybrid - Starting All Services
echo ============================================================
echo.

REM Check if setup was done
if not exist .venv (
    echo ERROR: Virtual environment not found!
    echo Please run setup_windows.bat first
    pause
    exit /b 1
)

echo Starting cloud backend (Next.js)...
start "JARVIS Cloud" cmd /k call run_cloud.bat

timeout /t 3 /nobreak

echo Starting desktop agent (Python)...
start "JARVIS Desktop" cmd /k call run_desktop.bat

echo.
echo Both services are starting...
echo.
echo Cloud backend:  http://localhost:3000
echo Desktop agent:  Connected to cloud
echo.
echo Close these windows to stop the services.
echo.
pause
