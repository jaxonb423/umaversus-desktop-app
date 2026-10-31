@echo off
rem Starts Uma Versus on localhost and opens it in your browser.
rem Keep this window open while playing; close it to stop the game server.
cd /d "%~dp0"
where py >nul 2>nul && (py play.py & goto :eof)
where python >nul 2>nul && (python play.py & goto :eof)
echo Python not found. Install it from python.org and tick "Add Python to PATH".
pause
