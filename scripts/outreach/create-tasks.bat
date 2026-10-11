@echo off
REM Project folder = two levels above this script (scripts\outreach\), so a moved checkout still works.
for %%I in ("%~dp0..\..") do set "PROJECT_DIR=%%~fI"
echo Creating DistractionIndex Task Scheduler tasks...

schtasks /create /tn "DistractionIndex-Morning" /tr "cmd /c cd /d %PROJECT_DIR% && npx tsx scripts/outreach/scheduler.ts --post morning >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 06:30 /f
if %errorlevel%==0 (echo   [OK] Morning - 6:30 AM) else (echo   [FAIL] Morning - error %errorlevel%)

schtasks /create /tn "DistractionIndex-Midday" /tr "cmd /c cd /d %PROJECT_DIR% && npx tsx scripts/outreach/scheduler.ts --post midday >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 12:30 /f
if %errorlevel%==0 (echo   [OK] Midday - 12:30 PM) else (echo   [FAIL] Midday - error %errorlevel%)

schtasks /create /tn "DistractionIndex-Evening" /tr "cmd /c cd /d %PROJECT_DIR% && npx tsx scripts/outreach/scheduler.ts --post evening >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 18:00 /f
if %errorlevel%==0 (echo   [OK] Evening - 6:00 PM) else (echo   [FAIL] Evening - error %errorlevel%)

echo.
echo Verifying tasks...
schtasks /query /tn "DistractionIndex-Morning" /fo LIST | findstr "TaskName Status"
schtasks /query /tn "DistractionIndex-Midday" /fo LIST | findstr "TaskName Status"
schtasks /query /tn "DistractionIndex-Evening" /fo LIST | findstr "TaskName Status"
