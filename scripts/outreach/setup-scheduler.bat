@echo off
REM ============================================================
REM Distraction Index - Windows Task Scheduler Setup
REM Creates 3 daily tasks for automated social media posting
REM Uses external XML files for reliable task creation
REM ============================================================

echo Setting up Distraction Index social media scheduler...
echo.

set SCRIPT_DIR=%~dp0

REM Delete existing tasks first (ignore errors if they don't exist)
schtasks /delete /tn "DistractionIndex-Morning" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-Midday" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-Evening" /f >nul 2>&1

REM Create tasks from XML files
schtasks /create /tn "DistractionIndex-Morning" /xml "%SCRIPT_DIR%task-morning.xml" /f
if %errorlevel%==0 (echo   [OK] Morning task - 6:30 AM daily, StartWhenAvailable) else (echo   [FAIL] Morning task)

schtasks /create /tn "DistractionIndex-Midday" /xml "%SCRIPT_DIR%task-midday.xml" /f
if %errorlevel%==0 (echo   [OK] Midday task - 12:30 PM daily, StartWhenAvailable) else (echo   [FAIL] Midday task)

schtasks /create /tn "DistractionIndex-Evening" /xml "%SCRIPT_DIR%task-evening.xml" /f
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
echo Log file: C:\Users\sghar\CascadeProjects\distraction\scripts\outreach\scheduler.log
pause
