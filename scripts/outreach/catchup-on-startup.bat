@echo off
REM ============================================================
REM Distraction Index - Startup Catch-up
REM Runs on user logon to catch up any missed social media posts.
REM Waits 60s for network connectivity before posting.
REM ============================================================

timeout /t 60 /nobreak >nul

cd /d C:\Users\sghar\CascadeProjects\distraction
npx tsx scripts/outreach/scheduler.ts --catchup >> scripts\outreach\scheduler.log 2>&1
