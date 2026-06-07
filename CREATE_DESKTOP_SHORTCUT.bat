@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "ROOT=%~dp0"
set "TARGET=%ROOT%START_JARVIS.vbs"
set "ICON=%ROOT%desktop-app\assets\icon.png"
set "SCRIPT=%TEMP%\create_jarvis_shortcut.vbs"

if not exist "%TARGET%" (
    echo ERROR: START_JARVIS.vbs not found.
    exit /b 1
)

> "%SCRIPT%" echo Set shell = CreateObject("WScript.Shell")
>> "%SCRIPT%" echo desktop = shell.SpecialFolders("Desktop")
>> "%SCRIPT%" echo linkPath = desktop ^& "\JARVIS Hybrid.lnk"
>> "%SCRIPT%" echo Set shortcut = shell.CreateShortcut(linkPath)
>> "%SCRIPT%" echo shortcut.TargetPath = "%TARGET%"
>> "%SCRIPT%" echo shortcut.Arguments = ""
>> "%SCRIPT%" echo shortcut.WorkingDirectory = "%ROOT%"
>> "%SCRIPT%" echo shortcut.WindowStyle = 7
>> "%SCRIPT%" echo shortcut.Description = "JARVIS Hybrid"
if exist "%ICON%" (
    >> "%SCRIPT%" echo shortcut.IconLocation = "%ICON%"
)
>> "%SCRIPT%" echo shortcut.Save

cscript.exe //nologo "%SCRIPT%"
set "RESULT=%ERRORLEVEL%"
del "%SCRIPT%" >nul 2>nul

if not "%RESULT%"=="0" (
    echo ERROR: Could not create desktop shortcut.
    exit /b %RESULT%
)

echo Created desktop shortcut: JARVIS Hybrid
exit /b 0
