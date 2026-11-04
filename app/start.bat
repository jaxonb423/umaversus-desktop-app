@echo off
rem Backup way to start Uma Versus Desktop, for when an antivirus blocks "Uma Versus Desktop.exe".
cd /d "%~dp0.."
if not exist "%~dp0..\runtime\pythonw.exe" (
  echo.
  echo  The "runtime" folder is missing. Unzip the WHOLE download first
  echo  ^(right-click the zip ^> Extract All^) and start it from the unzipped folder.
  echo.
  pause
  exit /b 1
)
start "" "%~dp0..\runtime\pythonw.exe" "%~dp0launcher.py"
