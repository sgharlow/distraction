@echo off
echo Updating Task Scheduler tasks with wake-to-run...

REM Delete and recreate with /RL HIGHEST and wake capability
schtasks /delete /tn "DistractionIndex-Morning" /f >nul 2>&1
schtasks /create /tn "DistractionIndex-Morning" /tr "cmd /c cd /d C:\Users\sghar\CascadeProjects\distraction && npx tsx scripts/outreach/scheduler.ts --post morning >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 06:30 /f /rl HIGHEST
if %errorlevel%==0 (echo   [OK] Morning - 6:30 AM) else (echo   [FAIL] Morning)

schtasks /delete /tn "DistractionIndex-Midday" /f >nul 2>&1
schtasks /create /tn "DistractionIndex-Midday" /tr "cmd /c cd /d C:\Users\sghar\CascadeProjects\distraction && npx tsx scripts/outreach/scheduler.ts --post midday >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 12:30 /f /rl HIGHEST
if %errorlevel%==0 (echo   [OK] Midday - 12:30 PM) else (echo   [FAIL] Midday)

schtasks /delete /tn "DistractionIndex-Evening" /f >nul 2>&1
schtasks /create /tn "DistractionIndex-Evening" /tr "cmd /c cd /d C:\Users\sghar\CascadeProjects\distraction && npx tsx scripts/outreach/scheduler.ts --post evening >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 18:00 /f /rl HIGHEST
if %errorlevel%==0 (echo   [OK] Evening - 6:00 PM) else (echo   [FAIL] Evening)

echo.
echo Verifying all 3 tasks exist...
schtasks /query /tn "DistractionIndex-Morning" /fo LIST | findstr "TaskName Status"
schtasks /query /tn "DistractionIndex-Midday" /fo LIST | findstr "TaskName Status"
schtasks /query /tn "DistractionIndex-Evening" /fo LIST | findstr "TaskName Status"
echo.
echo Done. Tasks will run even with lid closed (Modern Standby).
echo Note: Bluesky + Mastodon (API) always work. Threads + LinkedIn (Playwright) may
echo fail when system is in low-power idle - they only reliably post when laptop is open.
