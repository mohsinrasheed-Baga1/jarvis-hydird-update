
@echo off
REM JARVIS Hybrid - Windows Setup Script
REM Sets up local development environment: Python venv, dependencies, and npm packages

echo.
echo ============================================================
echo   JARVIS Hybrid - Windows Local Setup
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11+ from https://www.python.org
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo [1/5] Python version:
python --version
echo.

REM Create virtual environment
echo [2/5] Creating Python virtual environment (.venv)...
if exist .venv (
    echo Virtual environment already exists
) else (
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment
        pause
        exit /b 1
    )
)
echo.

REM Activate virtual environment
echo [3/5] Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)
echo.

REM Upgrade pip
echo [4/5] Upgrading pip...
python -m pip install --upgrade pip -q
echo.

REM Install Python dependencies
echo [5/5] Installing Python dependencies...
if exist desktop\requirements.txt (
    pip install -r desktop\requirements.txt
    if errorlevel 1 (
        echo WARNING: Some Python dependencies failed to install
        echo This might be OK if you only need basic automation
    )
) else (
    echo ERROR: desktop/requirements.txt not found
    pause
    exit /b 1
)
echo.

REM Install npm packages (at root)
echo [6/6] Installing Node.js dependencies...
if exist package.json (
    call npm install
    if errorlevel 1 (
        echo WARNING: npm install failed - make sure Node.js is installed
    )
) else (
    echo WARNING: package.json not found at root
)
echo.

REM Optional: Install Playwright browsers for browser automation
echo.
echo Would you like to install Playwright browsers? (optional, for browser automation)
choice /C YN /M "Install Playwright browsers [Y/N]? "
if errorlevel 2 goto skip_playwright
if errorlevel 1 (
    echo Installing Playwright browsers...
    python -m playwright install
    echo Playwright browsers installed
)

:skip_playwright
echo.
echo ============================================================
echo   Setup Complete!
echo ============================================================
echo.
echo Next steps:
echo   1. Open TWO terminal windows in VS Code
echo   2. In terminal 1, run: run_cloud.bat
echo   3. In terminal 2, run: run_desktop.bat
echo   4. Test with commands like:
echo      - "take screenshot"
echo      - "open notepad"
echo      - "google search python tutorials"
echo      - "open youtube and search relaxing music"
echo.
echo Virtual environment is active. To activate it later, run:
echo   .venv\Scripts\activate.bat
echo.
pause
