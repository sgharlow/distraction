@echo off
REM ============================================================
REM Distraction Index - Windows Task Scheduler Setup
REM Creates 3 daily tasks for automated social media posting
REM Uses external XML files for reliable task creation
REM ============================================================

echo Setting up Distraction Index social media scheduler...
echo.

set SCRIPT_DIR=%~dp0
REM Project folder = two levels above this script (scripts\outreach\), so a moved checkout still works.
for %%I in ("%~dp0..\..") do set "PROJECT_DIR=%%~fI"
REM The task-*.xml files are templates: fill __PROJECT_DIR__ into a temp copy, then import that.
set RENDER_DIR=%TEMP%\distraction-tasks
if not exist "%RENDER_DIR%" mkdir "%RENDER_DIR%"
for %%X in (morning midday evening) do powershell -NoProfile -Command "(Get-Content -Raw '%SCRIPT_DIR%task-%%X.xml').Replace('__PROJECT_DIR__', '%PROJECT_DIR%') | Set-Content -Encoding Unicode '%RENDER_DIR%\task-%%X.xml'"

REM Delete existing tasks first (ignore errors if they don't exist)
schtasks /delete /tn "DistractionIndex-Morning" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-Midday" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-Evening" /f >nul 2>&1

REM Create tasks from XML files
schtasks /create /tn "DistractionIndex-Morning" /xml "%RENDER_DIR%\task-morning.xml" /f
if %errorlevel%==0 (echo   [OK] Morning task - 6:30 AM daily, StartWhenAvailable) else (echo   [FAIL] Morning task)

schtasks /create /tn "DistractionIndex-Midday" /xml "%RENDER_DIR%\task-midday.xml" /f
if %errorlevel%==0 (echo   [OK] Midday task - 12:30 PM daily, StartWhenAvailable) else (echo   [FAIL] Midday task)

schtasks /create /tn "DistractionIndex-Evening" /xml "%RENDER_DIR%\task-evening.xml" /f
if %errorlevel%==0 (echo   [OK] Evening task - 6:00 PM daily, StartWhenAvailable) else (echo   [FAIL] Evening task)

echo.
echo Done! All tasks have StartWhenAvailable enabled.
echo If PC is off during a slot, the post fires when PC wakes up.
echo Each --post also auto-catches-up earlier missed slots.
echo.
echo Startup catch-up shortcut is in: %%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Startup
echo.
echo To verify: schtasks /query /tn "DistractionIndex-Morning"
echo To remove:  schtasks /delete /tn "DistractionIndex-Morning" /f
echo.
echo Log file: %PROJECT_DIR%\scripts\outreach\scheduler.log
pause
