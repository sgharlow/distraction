@echo off
echo Creating DistractionIndex Task Scheduler tasks...

schtasks /create /tn "DistractionIndex-Morning" /tr "cmd /c cd /d C:\Users\sghar\CascadeProjects\distraction && npx tsx scripts/outreach/scheduler.ts --post morning >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 06:30 /f
if %errorlevel%==0 (echo   [OK] Morning - 6:30 AM) else (echo   [FAIL] Morning - error %errorlevel%)

schtasks /create /tn "DistractionIndex-Midday" /tr "cmd /c cd /d C:\Users\sghar\CascadeProjects\distraction && npx tsx scripts/outreach/scheduler.ts --post midday >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 12:30 /f
if %errorlevel%==0 (echo   [OK] Midday - 12:30 PM) else (echo   [FAIL] Midday - error %errorlevel%)

schtasks /create /tn "DistractionIndex-Evening" /tr "cmd /c cd /d C:\Users\sghar\CascadeProjects\distraction && npx tsx scripts/outreach/scheduler.ts --post evening >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 18:00 /f
if %errorlevel%==0 (echo   [OK] Evening - 6:00 PM) else (echo   [FAIL] Evening - error %errorlevel%)

echo.
echo Verifying tasks...
schtasks /query /tn "DistractionIndex-Morning" /fo LIST | findstr "TaskName Status"
schtasks /query /tn "DistractionIndex-Midday" /fo LIST | findstr "TaskName Status"
schtasks /query /tn "DistractionIndex-Evening" /fo LIST | findstr "TaskName Status"
