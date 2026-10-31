@echo off
rem Uma Versus (Modded): double-click to play. No install needed.
rem The first start makes a desktop shortcut and downloads the game (about 55 MB).
cd /d "%~dp0"
if not exist "%~dp0runtime\pythonw.exe" (
  echo.
  echo  The "runtime" folder is missing next to this file.
  echo  Unzip the WHOLE download first: right-click the zip ^> Extract All,
  echo  then double-click "Uma Versus Modded.bat" inside the unzipped folder.
  echo.
  pause
  exit /b 1
)
start "" "%~dp0runtime\pythonw.exe" "%~dp0app\launcher.py"
