@echo off
REM ============================================================
REM Distraction Index - Full Scheduled Tasks Setup
REM Run as Administrator: right-click > Run as administrator
REM
REM Creates ALL automated tasks:
REM   - 3x/day social media posting (Bluesky, Mastodon, Threads, LinkedIn)
REM   - Weekly Substack publish (after freeze cascade)
REM   - Daily Bluesky engagement drafts (user review)
REM
REM DistractionIndex-EmailFollowups was RETIRED 2026-10-13: its contact list
REM (outreach-contacts.csv) no longer exists, so every run failed. This script
REM still deletes it (below) but never creates it.
REM ============================================================

echo.
echo ============================================================
echo  Distraction Index - Full Scheduler Setup
echo ============================================================
echo.

REM Project folder = two levels above this script (scripts\outreach\), so a moved checkout still works.
for %%I in ("%~dp0..\..") do set "PROJECT_DIR=%%~fI"

REM --- Delete all existing tasks first (ignore errors) ---
schtasks /delete /tn "DistractionIndex-Morning" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-Midday" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-Evening" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-WeeklyCascade" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-EmailFollowups" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-BlueskyEngage" /f >nul 2>&1

echo [1/3] Daily social posting (3x/day)...
echo.

REM Morning: 6:30 AM daily
schtasks /create /tn "DistractionIndex-Morning" /tr "cmd /c cd /d %PROJECT_DIR% && node_modules\.bin\tsx scripts/outreach/scheduler.ts --post morning >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 06:30 /it /f
if %errorlevel%==0 (echo   [OK] Morning  - 6:30 AM daily) else (echo   [FAIL] Morning - run as Administrator?)

REM Midday: 12:30 PM daily
schtasks /create /tn "DistractionIndex-Midday" /tr "cmd /c cd /d %PROJECT_DIR% && node_modules\.bin\tsx scripts/outreach/scheduler.ts --post midday >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 12:30 /it /f
if %errorlevel%==0 (echo   [OK] Midday   - 12:30 PM daily) else (echo   [FAIL] Midday - run as Administrator?)

REM Evening: 6:00 PM daily
schtasks /create /tn "DistractionIndex-Evening" /tr "cmd /c cd /d %PROJECT_DIR% && node_modules\.bin\tsx scripts/outreach/scheduler.ts --post evening >> scripts\outreach\scheduler.log 2>&1" /sc daily /st 18:00 /it /f
if %errorlevel%==0 (echo   [OK] Evening  - 6:00 PM daily) else (echo   [FAIL] Evening - run as Administrator?)

echo.
echo [2/3] Weekly Substack publish (Sunday 2 AM after freeze)...
schtasks /create /tn "DistractionIndex-WeeklyCascade" /tr "cmd /c cd /d %PROJECT_DIR% && node_modules\.bin\tsx scripts/outreach/substack-publish.ts >> scripts\outreach\cascade.log 2>&1" /sc weekly /d SUN /st 02:00 /it /f
if %errorlevel%==0 (echo   [OK] Substack - Sunday 2:00 AM weekly) else (echo   [FAIL] Substack cascade)

echo.
echo [3/3] Daily Bluesky engagement drafts (10 AM)...
schtasks /create /tn "DistractionIndex-BlueskyEngage" /tr "cmd /c cd /d %PROJECT_DIR% && node_modules\.bin\tsx scripts/outreach/bluesky-engage.ts >> scripts\outreach\engage.log 2>&1" /sc daily /st 10:00 /it /f
if %errorlevel%==0 (echo   [OK] Engage  - 10:00 AM daily) else (echo   [FAIL] Bluesky engagement)

echo.
echo ============================================================
echo  Summary of scheduled tasks:
echo ============================================================
echo.
echo   DAILY:
echo     DistractionIndex-Morning       6:30 AM   Social (4 platforms)
echo     DistractionIndex-Midday       12:30 PM   Social (4 platforms)
echo     DistractionIndex-Evening       6:00 PM   Social (4 platforms)
echo     DistractionIndex-BlueskyEngage 10:00 AM   Engagement drafts
echo.
echo   WEEKLY:
echo     DistractionIndex-WeeklyCascade SUN 2:00 AM  Substack publish
echo.
echo  Log files:
echo     %PROJECT_DIR%\scripts\outreach\scheduler.log
echo     %PROJECT_DIR%\scripts\outreach\cascade.log
echo     %PROJECT_DIR%\scripts\outreach\engage.log
echo.
echo  To verify: schtasks /query /tn "DistractionIndex-Morning"
echo  To remove all: for %%t in (Morning Midday Evening WeeklyCascade EmailFollowups BlueskyEngage) do schtasks /delete /tn "DistractionIndex-%%t" /f
echo.
pause
