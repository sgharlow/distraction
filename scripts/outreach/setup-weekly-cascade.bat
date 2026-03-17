@echo off
REM ============================================================
REM Weekly Cascade - Local tasks that run after the Vercel freeze
REM Publishes to Substack (requires Playwright/browser)
REM Schedule: Sunday 2:00 AM EST (after Vercel freeze at 12:00 AM EST)
REM ============================================================

echo Setting up weekly cascade task...

schtasks /create /tn "DistractionIndex-WeeklyCascade" /tr "cmd /c cd /d C:\Users\sghar\CascadeProjects\distraction && npx tsx scripts/outreach/substack-publish.ts >> scripts\outreach\cascade.log 2>&1" /sc weekly /d SUN /st 02:00 /f
if %errorlevel%==0 (echo   [OK] Weekly cascade - Sunday 2:00 AM) else (echo   [FAIL] Weekly cascade)

echo.
echo Verifying...
schtasks /query /tn "DistractionIndex-WeeklyCascade" /fo LIST | findstr "TaskName Status"
