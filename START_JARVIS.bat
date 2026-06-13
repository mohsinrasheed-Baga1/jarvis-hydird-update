@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
set "ROOT=%~dp0"
set "BACKEND_URL=http://127.0.0.1:3000"
set "LOG_DIR=%LOCALAPPDATA%\JARVIS-HYBRID"
set "BACKEND_LOG=%LOG_DIR%\backend.log"
set "PYTHON_LOG=%LOG_DIR%\python-agent.log"
set "ELECTRON_LOG=%LOG_DIR%\electron.log"
set "JARVIS_ROOT=%ROOT%"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul

if /I "%~1"=="--check" goto CHECK_ONLY

call :ENSURE_DEPS
call :ENSURE_BACKEND
call :START_PYTHON_AGENT
call :START_ELECTRON_UI
exit /b 0

:ENSURE_DEPS
if not exist "%ROOT%node_modules" (
    call npm.cmd install >> "%BACKEND_LOG%" 2>&1
)

if not exist "%ROOT%desktop-app\node_modules" (
    pushd "%ROOT%desktop-app"
    call npm.cmd install >> "%ELECTRON_LOG%" 2>&1
    popd
)
exit /b 0

:ENSURE_BACKEND
call :HEALTH_CHECK
if "%ERRORLEVEL%"=="0" exit /b 0

call :PORT_3000_PROJECT_RUNNING
if "%ERRORLEVEL%"=="0" (
    call :STOP_PROJECT_BACKEND
) else if "%ERRORLEVEL%"=="2" (
    echo Port 3000 is in use by another application. See %BACKEND_LOG% for details.>> "%BACKEND_LOG%"
    exit /b 1
)

start "JARVIS Backend" /D "%ROOT%" /min npm.cmd run dev -- --hostname 127.0.0.1 --port 3000

for /L %%I in (1,1,60) do (
    timeout /t 1 /nobreak >nul
    call :HEALTH_CHECK
    if "!ERRORLEVEL!"=="0" exit /b 0
)

exit /b 1

:START_PYTHON_AGENT
call :PYTHON_AGENT_RUNNING
if "%ERRORLEVEL%"=="0" exit /b 0

set "PYTHON_EXE=python"
if exist "%ROOT%.venv\Scripts\python.exe" set "PYTHON_EXE=%ROOT%.venv\Scripts\python.exe"

start "JARVIS Automation Agent" /D "%ROOT%desktop" /min "%PYTHON_EXE%" -m jarvis.main --cloud-url %BACKEND_URL% --no-voice --background
exit /b 0

:START_ELECTRON_UI
set "JARVIS_SKIP_SERVICE_LAUNCH=1"
set "JARVIS_LOAD_DIST=1"
set "ELECTRON_RUN_AS_NODE="
call :STOP_PROJECT_ELECTRON
if exist "%ROOT%desktop-app\dist" rmdir /s /q "%ROOT%desktop-app\dist" >nul 2>nul
pushd "%ROOT%desktop-app"
call npx.cmd vite build >> "%ELECTRON_LOG%" 2>&1
set "BUILD_RESULT=%ERRORLEVEL%"
popd
if not "%BUILD_RESULT%"=="0" exit /b %BUILD_RESULT%
start "JARVIS Hybrid" /D "%ROOT%desktop-app" /min "%ROOT%desktop-app\node_modules\.bin\electron.cmd" .
exit /b 0

:HEALTH_CHECK
curl.exe -fsS --max-time 2 "%BACKEND_URL%/api/health" >nul 2>nul
exit /b %ERRORLEVEL%

:PORT_3000_PROJECT_RUNNING
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:JARVIS_ROOT.TrimEnd('\'); $conn=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if (-not $conn) { exit 1 }; $p=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $conn.OwningProcess); if ($p.CommandLine -and $p.CommandLine.Contains($root)) { exit 0 } else { exit 2 }" >nul 2>nul
exit /b %ERRORLEVEL%

:STOP_PROJECT_BACKEND
echo Restarting stale JARVIS backend on port 3000...>> "%BACKEND_LOG%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:JARVIS_ROOT.TrimEnd('\'); $conns=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; foreach ($conn in $conns) { $p=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $conn.OwningProcess); if ($p.CommandLine -and $p.CommandLine.Contains($root)) { Stop-Process -Id $conn.OwningProcess -Force } }" >> "%BACKEND_LOG%" 2>&1
timeout /t 2 /nobreak >nul
exit /b 0

:STOP_PROJECT_ELECTRON
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:JARVIS_ROOT.TrimEnd('\'); Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($root) -and ($_.CommandLine -like '*desktop-app*') -and ($_.Name -like 'electron*' -or $_.CommandLine -like '*electron.cmd*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >> "%ELECTRON_LOG%" 2>&1
timeout /t 1 /nobreak >nul
exit /b 0

:PYTHON_AGENT_RUNNING
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*jarvis.main*' -and $_.CommandLine -like '*--background*' }; if ($p) { exit 0 } else { exit 1 }" >nul 2>nul
exit /b %ERRORLEVEL%

:CHECK_ONLY
echo JARVIS launcher check
echo Root: %ROOT%

if exist "%ROOT%desktop-app\package.json" (
    echo OK desktop-app package found
) else (
    echo ERROR desktop-app package missing
    exit /b 1
)

if exist "%ROOT%package.json" (
    echo OK backend package found
) else (
    echo ERROR backend package missing
    exit /b 1
)

if exist "%ROOT%START_JARVIS.vbs" (
    echo OK VBS wrapper found
) else (
    echo ERROR START_JARVIS.vbs missing
    exit /b 1
)

call :HEALTH_CHECK
if "%ERRORLEVEL%"=="0" (
    echo Backend health: online
) else (
    echo Backend health: offline
)

echo OK launcher files validated
exit /b 0
