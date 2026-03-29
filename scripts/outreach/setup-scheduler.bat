@echo off
REM ============================================================
REM Distraction Index - Windows Task Scheduler Setup
REM Creates 3 daily tasks for automated social media posting
REM Requires: Run as Administrator for StartWhenAvailable
REM ============================================================

echo Setting up Distraction Index social media scheduler...
echo.

set PROJECT_DIR=C:\Users\sghar\CascadeProjects\distraction

REM Delete existing tasks first (ignore errors if they don't exist)
schtasks /delete /tn "DistractionIndex-Morning" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-Midday" /f >nul 2>&1
schtasks /delete /tn "DistractionIndex-Evening" /f >nul 2>&1

REM Create tasks using XML for StartWhenAvailable support
REM Morning task - 6:30 AM daily
echo ^<?xml version="1.0" encoding="UTF-16"?^>^<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"^>^<Triggers^>^<CalendarTrigger^>^<StartBoundary^>2026-01-01T06:30:00^</StartBoundary^>^<Enabled^>true^</Enabled^>^<ScheduleByDay^>^<DaysInterval^>1^</DaysInterval^>^</ScheduleByDay^>^</CalendarTrigger^>^</Triggers^>^<Settings^>^<MultipleInstancesPolicy^>IgnoreNew^</MultipleInstancesPolicy^>^<StartWhenAvailable^>true^</StartWhenAvailable^>^<ExecutionTimeLimit^>PT10M^</ExecutionTimeLimit^>^<AllowStartOnDemand^>true^</AllowStartOnDemand^>^</Settings^>^<Actions^>^<Exec^>^<Command^>cmd^</Command^>^<Arguments^>/c cd /d %PROJECT_DIR% ^&^& npx tsx scripts/outreach/scheduler.ts --post morning ^>^> scripts\outreach\scheduler.log 2^>^&1^</Arguments^>^</Exec^>^</Actions^>^</Task^> > "%TEMP%\di-morning.xml"
schtasks /create /tn "DistractionIndex-Morning" /xml "%TEMP%\di-morning.xml" /f
if %errorlevel%==0 (echo   [OK] Morning task - 6:30 AM daily, StartWhenAvailable) else (echo   [FAIL] Morning task)

REM Midday task - 12:30 PM daily
echo ^<?xml version="1.0" encoding="UTF-16"?^>^<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"^>^<Triggers^>^<CalendarTrigger^>^<StartBoundary^>2026-01-01T12:30:00^</StartBoundary^>^<Enabled^>true^</Enabled^>^<ScheduleByDay^>^<DaysInterval^>1^</DaysInterval^>^</ScheduleByDay^>^</CalendarTrigger^>^</Triggers^>^<Settings^>^<MultipleInstancesPolicy^>IgnoreNew^</MultipleInstancesPolicy^>^<StartWhenAvailable^>true^</StartWhenAvailable^>^<ExecutionTimeLimit^>PT10M^</ExecutionTimeLimit^>^<AllowStartOnDemand^>true^</AllowStartOnDemand^>^</Settings^>^<Actions^>^<Exec^>^<Command^>cmd^</Command^>^<Arguments^>/c cd /d %PROJECT_DIR% ^&^& npx tsx scripts/outreach/scheduler.ts --post midday ^>^> scripts\outreach\scheduler.log 2^>^&1^</Arguments^>^</Exec^>^</Actions^>^</Task^> > "%TEMP%\di-midday.xml"
schtasks /create /tn "DistractionIndex-Midday" /xml "%TEMP%\di-midday.xml" /f
if %errorlevel%==0 (echo   [OK] Midday task - 12:30 PM daily, StartWhenAvailable) else (echo   [FAIL] Midday task)

REM Evening task - 6:00 PM daily
echo ^<?xml version="1.0" encoding="UTF-16"?^>^<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"^>^<Triggers^>^<CalendarTrigger^>^<StartBoundary^>2026-01-01T18:00:00^</StartBoundary^>^<Enabled^>true^</Enabled^>^<ScheduleByDay^>^<DaysInterval^>1^</DaysInterval^>^</ScheduleByDay^>^</CalendarTrigger^>^</Triggers^>^<Settings^>^<MultipleInstancesPolicy^>IgnoreNew^</MultipleInstancesPolicy^>^<StartWhenAvailable^>true^</StartWhenAvailable^>^<ExecutionTimeLimit^>PT10M^</ExecutionTimeLimit^>^<AllowStartOnDemand^>true^</AllowStartOnDemand^>^</Settings^>^<Actions^>^<Exec^>^<Command^>cmd^</Command^>^<Arguments^>/c cd /d %PROJECT_DIR% ^&^& npx tsx scripts/outreach/scheduler.ts --post evening ^>^> scripts\outreach\scheduler.log 2^>^&1^</Arguments^>^</Exec^>^</Actions^>^</Task^> > "%TEMP%\di-evening.xml"
schtasks /create /tn "DistractionIndex-Evening" /xml "%TEMP%\di-evening.xml" /f
if %errorlevel%==0 (echo   [OK] Evening task - 6:00 PM daily, StartWhenAvailable) else (echo   [FAIL] Evening task)

REM Cleanup temp files
del "%TEMP%\di-morning.xml" 2>nul
del "%TEMP%\di-midday.xml" 2>nul
del "%TEMP%\di-evening.xml" 2>nul

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
