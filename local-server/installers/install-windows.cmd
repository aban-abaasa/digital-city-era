@echo off
setlocal

if not exist "%~dp0install.js" (
  echo The installer files are incomplete because this script was run from the ZIP preview.
  echo In File Explorer, right-click the ZIP, choose "Extract All", then run this file
  echo from the extracted local-server\installers folder.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install it, then run this installer again.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)

rem Git for Windows keeps bash.exe outside the default command search path on
rem some installations. Add its common locations for this installer process.
if exist "%ProgramFiles%\Git\bin\bash.exe" set "PATH=%ProgramFiles%\Git\bin;%PATH%"
if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "PATH=%ProgramFiles(x86)%\Git\bin;%PATH%"

node "%~dp0install.js"
set "INSTALL_EXIT=%ERRORLEVEL%"
if not "%INSTALL_EXIT%"=="0" (
  echo.
  echo Installer stopped with exit code %INSTALL_EXIT%.
)
pause
exit /b %INSTALL_EXIT%
