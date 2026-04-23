@echo off
REM ============================================================
REM Distraction Index - Full Scheduled Tasks Setup
REM Run as Administrator: right-click > Run as administrator
REM
REM Creates ALL automated tasks:
REM   - 3x/day social media posting (Bluesky, Mastodon, Threads, LinkedIn)
REM   - Weekly Substack publish (after freeze cascade)
REM   - Weekly email follow-ups (7-day cadence)
REM   - Daily Bluesky engagement drafts (user review)
REM ============================================================

echo.
echo ============================================================
echo  Distraction Index - Full Scheduler Setup
echo ============================================================
echo.

set PROJECT_DIR=C:\Users\sghar\CascadeProjects\distraction

REM --- Delete all existing tasks first (ignore errors) ---
schtasks /delete /tn "DistractionIndex-Morning" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-Midday" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-Evening" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-WeeklyCascade" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-EmailFollowups" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-BlueskyEngage" /f >nul 2>&1

echo [1/6] Daily social posting (3x/day)...
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
echo [2/6] Weekly Substack publish (Sunday 2 AM after freeze)...
schtasks /create /tn "DistractionIndex-WeeklyCascade" /tr "cmd /c cd /d %PROJECT_DIR% && node_modules\.bin\tsx scripts/outreach/substack-publish.ts >> scripts\outreach\cascade.log 2>&1" /sc weekly /d SUN /st 02:00 /it /f
if %errorlevel%==0 (echo   [OK] Substack - Sunday 2:00 AM weekly) else (echo   [FAIL] Substack cascade)

echo.
echo [3/6] Weekly email follow-ups (Monday 9 AM)...
schtasks /create /tn "DistractionIndex-EmailFollowups" /tr "cmd /c cd /d %PROJECT_DIR% && node_modules\.bin\tsx scripts/outreach/email-campaign.ts --followup >> scripts\outreach\email-followup.log 2>&1" /sc weekly /d MON /st 09:00 /it /f
if %errorlevel%==0 (echo   [OK] Email   - Monday 9:00 AM weekly) else (echo   [FAIL] Email follow-ups)

echo.
echo [4/6] Daily Bluesky engagement drafts (10 AM)...
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
echo     DistractionIndex-EmailFollowups MON 9:00 AM  Email follow-ups
echo.
echo  Log files:
echo     %PROJECT_DIR%\scripts\outreach\scheduler.log
echo     %PROJECT_DIR%\scripts\outreach\cascade.log
echo     %PROJECT_DIR%\scripts\outreach\email-followup.log
echo     %PROJECT_DIR%\scripts\outreach\engage.log
echo.
echo  To verify: schtasks /query /tn "DistractionIndex-Morning"
echo  To remove all: for %%t in (Morning Midday Evening WeeklyCascade EmailFollowups BlueskyEngage) do schtasks /delete /tn "DistractionIndex-%%t" /f
echo.
pause
