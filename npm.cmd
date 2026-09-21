@echo off
setlocal
set "POLAZU_NODE=%~dp0.tools\node-v24.19.0-win-x64"
set "PATH=%POLAZU_NODE%;%PATH%"
call "%POLAZU_NODE%\npm.cmd" %*
exit /b %errorlevel%
