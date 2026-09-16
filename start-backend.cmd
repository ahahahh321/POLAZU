@echo off
setlocal
cd /d "%~dp0backend"
set "JAVA_HOME="
call gradlew.bat bootRun
pause
