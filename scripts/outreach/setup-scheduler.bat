@echo off
REM ============================================================
REM Distraction Index - Windows Task Scheduler Setup
REM Creates 3 daily tasks for automated social media posting
REM ============================================================

echo Setting up Distraction Index social media scheduler...
echo.

set PROJECT_DIR=C:\Users\sghar\CascadeProjects\distraction
set NODE_PATH=C:\Program Files\nodejs\node.exe

REM Morning post: runs at 6:30 AM EST daily, scheduler picks random time in 6-8am window
schtasks /create /tn "DistractionIndex-Morning" /tr "cmd /c cd /d %PROJECT_DIR% && npx tsx scripts/outreach/scheduler.ts --post morning >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 06:30 /f
if %errorlevel%==0 (echo   [OK] Morning task created - 6:30 AM daily) else (echo   [FAIL] Morning task)

REM Midday post: runs at 12:30 PM EST daily
schtasks /create /tn "DistractionIndex-Midday" /tr "cmd /c cd /d %PROJECT_DIR% && npx tsx scripts/outreach/scheduler.ts --post midday >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 12:30 /f
if %errorlevel%==0 (echo   [OK] Midday task created - 12:30 PM daily) else (echo   [FAIL] Midday task)

REM Evening post: runs at 6:00 PM EST daily
schtasks /create /tn "DistractionIndex-Evening" /tr "cmd /c cd /d %PROJECT_DIR% && npx tsx scripts/outreach/scheduler.ts --post evening >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 18:00 /f
if %errorlevel%==0 (echo   [OK] Evening task created - 6:00 PM daily) else (echo   [FAIL] Evening task)

echo.
echo Done! Tasks created:
echo   DistractionIndex-Morning  - 6:30 AM daily
echo   DistractionIndex-Midday   - 12:30 PM daily
echo   DistractionIndex-Evening  - 6:00 PM daily
echo.
echo To verify: schtasks /query /tn "DistractionIndex-Morning"
echo To remove:  schtasks /delete /tn "DistractionIndex-Morning" /f
echo.
echo Log file: %PROJECT_DIR%\scripts\outreach\scheduler.log
pause
