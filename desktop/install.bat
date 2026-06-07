@echo off
REM JARVIS Hybrid - Desktop Agent Setup (Windows)
REM Run this to set up the desktop agent on Windows

echo ==========================================
echo   🤖 JARVIS HYBRID - Desktop Setup
echo ==========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python 3 is required. Install from python.org
    pause
    exit /b 1
)

echo ✅ Python found

REM Check git
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git is required. Install from git-scm.com
    pause
    exit /b 1
)

echo ✅ Git found

REM Clone if needed
if not exist "JARVIS-HYBRID" (
    echo.
    echo 📥 Cloning JARVIS-HYBRID repository...
    git clone https://github.com/mohsinrasheed-Baga1/JARVIS-HYBRID.git
    cd JARVIS-HYBRID
) else (
    cd JARVIS-HYBRID
    echo 📥 Updating repository...
    git pull origin main
)

REM Install Python dependencies
echo.
echo 📦 Installing Python dependencies...
cd desktop
pip install -r requirements.txt

echo.
echo ✅ Setup complete!
echo.
echo 🚀 To start JARVIS Desktop Agent:
echo.
echo   python jarvis\main.py --gui --monitor-whatsapp --auto-job-search --auto-update
echo.
echo 📱 Don't forget to edit config.json with your API keys!
echo.
pause
