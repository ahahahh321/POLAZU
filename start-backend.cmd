@echo off
setlocal
cd /d "%~dp0backend"
set "JAVA_HOME=C:\Program Files\Java\jdk-23"
call gradlew.bat bootRun
pause
